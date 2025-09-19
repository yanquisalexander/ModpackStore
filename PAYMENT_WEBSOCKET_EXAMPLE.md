# Ejemplo de Uso - Sistema de Pagos con WebSocket

## 🎯 Escenario: Usuario compra un modpack

### 1. **Usuario selecciona modpack y hace clic en "Comprar"**

```typescript
// En ModpackAcquisitionDialog.tsx
const handlePurchase = async () => {
  try {
    // Crear orden de pago con QR code
    const paymentData = await invoke('create_payment_order', {
      modpackId: selectedModpack.id,
      includeModpackDetails: true, // Para QR code
      userId: currentUser.id
    });

    // Mostrar diálogo con QR code
    setPaymentData(paymentData);
    setShowPaymentDialog(true);

    // Conectar WebSocket para actualizaciones
    connectWebSocket();

  } catch (error) {
    toast.error('Error al crear orden de pago');
  }
};
```

### 2. **Backend procesa la solicitud**

```typescript
// En payment.service.ts
export const createPaymentOrder = async (params: CreatePaymentParams) => {
  const { modpackId, includeModpackDetails, userId } = params;

  // Obtener datos del modpack
  const modpack = await Modpack.findOne({ where: { id: modpackId } });
  if (!modpack) throw new Error('Modpack not found');

  // Crear orden en PayPal con descripción detallada
  const paypalOrder = await paypalGateway.createOrder({
    amount: modpack.price,
    currency: 'USD',
    description: generatePaymentDescription(modpack),
    includeQR: includeModpackDetails
  });

  // Guardar en base de datos
  const payment = await Payment.create({
    userId,
    modpackId,
    paypalOrderId: paypalOrder.id,
    amount: modpack.price,
    status: 'pending'
  });

  // Preparar respuesta con QR code
  const response = {
    paymentId: payment.id,
    paypalOrderId: paypalOrder.id,
    qrCode: includeModpackDetails ? await generateQRCode(paypalOrder.approveUrl) : null,
    approveUrl: paypalOrder.approveUrl,
    status: 'pending',
    modpackName: modpack.name,
    amount: modpack.price
  };

  return response;
};
```

### 3. **Usuario escanea QR o hace clic en el link**

```typescript
// QR Code generado automáticamente
const generateQRCode = async (url: string): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL; // base64 image
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};
```

### 4. **PayPal envía webhook cuando se aprueba**

```typescript
// En paypal.gateway.ts - Webhook handler
export const processWebhook = async (webhookData: any) => {
  const { event_type, resource } = webhookData;

  if (event_type === 'CHECKOUT.ORDER.APPROVED') {
    const orderId = resource.id;
    const orderStatus = resource.status;

    // Buscar el pago en nuestra base de datos
    const payment = await Payment.findOne({
      where: { paypalOrderId: orderId }
    });

    if (!payment) {
      console.error('Payment not found for order:', orderId);
      return;
    }

    // Notificar procesamiento
    await wsManager.sendToUser(payment.userId, 'payment_processing', {
      paymentId: payment.id,
      modpackId: payment.modpackId,
      status: 'processing',
      message: 'Procesando pago...'
    });

    // Capturar el pago automáticamente
    try {
      const captureResult = await paypalGateway.captureOrder(orderId);

      // Actualizar estado del pago
      payment.status = 'completed';
      payment.capturedAt = new Date();
      await payment.save();

      // Crear adquisición del modpack
      const acquisition = await AcquisitionService.createAcquisition({
        userId: payment.userId,
        modpackId: payment.modpackId,
        paymentId: payment.id
      });

      // Notificar éxito
      await wsManager.sendToUser(payment.userId, 'payment_completed', {
        paymentId: payment.id,
        modpackId: payment.modpackId,
        acquisitionId: acquisition.id,
        modpackName: payment.modpack.name,
        status: 'completed',
        message: `¡Pago completado! Has adquirido ${payment.modpack.name}`,
        amount: { total: payment.amount, currency: 'USD' },
        processingTimeMs: Date.now() - payment.createdAt.getTime()
      });

    } catch (captureError) {
      console.error('Error capturing payment:', captureError);

      // Notificar error
      await wsManager.sendToUser(payment.userId, 'payment_failed', {
        paymentId: payment.id,
        modpackId: payment.modpackId,
        status: 'failed',
        message: 'Error al procesar el pago'
      });
    }
  }
};
```

### 5. **Frontend recibe actualización en tiempo real**

```typescript
// En ModpackAcquisitionDialog.tsx
useEffect(() => {
  if (!paymentData?.paymentId || !isConnected) return;

  const handlePaymentProcessing = (payload: any) => {
    setPaymentData(prev => ({
      ...prev,
      status: 'processing'
    }));
    toast.info('Procesando pago...');
  };

  const handlePaymentCompleted = (payload: any) => {
    setPaymentData(prev => ({
      ...prev,
      status: 'completed'
    }));

    toast.success(payload.message, {
      duration: 5000,
      action: {
        label: 'Ver mis modpacks',
        onClick: () => navigate('/my-modpacks')
      }
    });

    // Cerrar diálogo automáticamente después de 3 segundos
    setTimeout(() => {
      onSuccess();
      handleClose();
    }, 3000);
  };

  const handlePaymentFailed = (payload: any) => {
    setPaymentData(prev => ({
      ...prev,
      status: 'failed'
    }));
    toast.error(payload.message);
  };

  // Suscribirse a eventos
  const unsubscribeProcessing = on('payment_processing', handlePaymentProcessing);
  const unsubscribeCompleted = on('payment_completed', handlePaymentCompleted);
  const unsubscribeFailed = on('payment_failed', handlePaymentFailed);

  return () => {
    unsubscribeProcessing();
    unsubscribeCompleted();
    unsubscribeFailed();
  };
}, [paymentData?.paymentId, isConnected]);
```

## 🎨 UI Resultante

### Estados Visuales del Pago

```tsx
// Indicador de estado con colores y iconos
const getStatusDisplay = (status: PaymentStatus) => {
  switch (status) {
    case 'pending':
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        icon: <LucideClock className="w-5 h-5" />,
        text: 'Pago pendiente de confirmación'
      };
    case 'processing':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: <LucideLoader2 className="w-5 h-5 animate-spin" />,
        text: 'Procesando pago...'
      };
    case 'completed':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: <LucideCheckCircle className="w-5 h-5" />,
        text: '¡Pago completado exitosamente!'
      };
    case 'failed':
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: <LucideXCircle className="w-5 h-5" />,
        text: 'Error en el pago'
      };
  }
};
```

### Diálogo de Pago Completo

```tsx
<Dialog open={showPaymentDialog} onOpenChange={handleClose}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Comprar {paymentData?.modpackName}</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      {/* Estado del pago */}
      <div className={`p-4 rounded-lg ${statusDisplay.bgColor}`}>
        <div className="flex items-center space-x-3">
          {statusDisplay.icon}
          <span className={`font-medium ${statusDisplay.color}`}>
            {statusDisplay.text}
          </span>
        </div>
      </div>

      {/* QR Code */}
      {paymentData?.qrCode && paymentData.status === 'pending' && (
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            Escanea el código QR con tu teléfono
          </p>
          <img
            src={paymentData.qrCode}
            alt="QR Code para pago"
            className="mx-auto w-48 h-48"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(paymentData.approveUrl, '_blank')}
          >
            <LucideExternalLink className="w-4 h-4 mr-2" />
            Abrir en navegador
          </Button>
        </div>
      )}

      {/* Indicador de conexión WebSocket */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Conexión en tiempo real</span>
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

## 🚀 Resultado Final

El usuario experimenta:

1. **Clic en "Comprar"** → Se muestra QR code instantáneamente
2. **Escanea QR** → Se redirige a PayPal
3. **Aprueba pago** → PayPal envía webhook
4. **Backend procesa** → Captura automática + notificación WebSocket
5. **UI se actualiza** → Estado cambia a "completado" en tiempo real
6. **Diálogo se cierra** → Usuario ve confirmación de éxito

¡Flujo completo sin recargas de página y con feedback instantáneo! 🎉