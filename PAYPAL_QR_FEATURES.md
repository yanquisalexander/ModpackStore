# PayPal Payment Gateway - QR Code & Enhanced Descriptions

## 🚀 Nuevas Funcionalidades

### QR Codes para Pagos Móviles

El sistema ahora genera automáticamente códigos QR para que los usuarios puedan completar sus pagos desde dispositivos móviles.

```typescript
// Ejemplo de respuesta con QR code
{
  "success": true,
  "paymentId": "PAY-1234567890",
  "approvalUrl": "https://www.paypal.com/checkoutnow?token=...",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...", // Base64 encoded QR
  "qrCodeUrl": "https://www.paypal.com/checkoutnow?token=...", // Same as approval URL
  "gatewayType": "paypal",
  "status": "pending"
}
```

### Descripciones Mejoradas

Las descripciones de pago ahora incluyen detalles completos del modpack:

```
Compra de modpack: SkyFactory 4 v4.2.4 por Feed The Beast
Un modpack de skyblock con más de 200 mods optimizados para la mejor experiencia de juego.
```

## 📱 Uso en Aplicación Frontend

### Mostrar QR Code
```typescript
// En tu componente React
import { useState } from 'react';

const PaymentModal = ({ payment }) => {
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="payment-modal">
      <h3>Completa tu pago</h3>

      {/* Opción desktop */}
      <button onClick={() => window.open(payment.approvalUrl)}>
        Pagar en navegador
      </button>

      {/* Opción móvil con QR */}
      <button onClick={() => setShowQR(!showQR)}>
        {showQR ? 'Ocultar' : 'Mostrar'} QR para móvil
      </button>

      {showQR && payment.qrCode && (
        <div className="qr-container">
          <img src={payment.qrCode} alt="QR Code para pago" />
          <p>Escanea con tu teléfono para pagar</p>
        </div>
      )}
    </div>
  );
};
```

### Solicitar Detalles del Modpack

```typescript
// Al crear el pago, incluye detalles del modpack
const paymentRequest = {
  amount: "10.00",
  currency: "USD",
  description: "Compra de modpack",
  modpackId: "modpack-uuid",
  userId: "user-uuid",
  includeModpackDetails: true, // ✅ Habilita descripciones detalladas y QR
  gatewayType: "paypal"
};

const response = await fetch('/api/payments/create', {
  method: 'POST',
  body: JSON.stringify(paymentRequest)
});
```

## 🔧 Configuración

### Instalar Dependencias

```bash
npm install qrcode @types/qrcode
```

### Variables de Entorno

Asegúrate de tener configuradas las variables de PayPal:

```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_BASE_URL=https://api.sandbox.paypal.com  # o production
```

## 📋 API Endpoints

### Crear Pago con QR
```http
POST /api/modpacks/{modpackId}/acquire
Content-Type: application/json

{
  "gatewayType": "paypal",
  "countryCode": "US",
  "includeModpackDetails": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "paymentId": "PAY-1234567890",
  "approvalUrl": "https://paypal.com/checkout/...",
  "qrCode": "data:image/png;base64,...",
  "qrCodeUrl": "https://paypal.com/checkout/...",
  "gatewayType": "paypal",
  "status": "pending",
  "metadata": {
    "modpackDetails": {
      "name": "SkyFactory 4",
      "version": "4.2.4",
      "author": "Feed The Beast",
      "description": "Modpack de skyblock..."
    }
  }
}
```

## 🎯 Beneficios

- ✅ **Compatibilidad móvil**: QR codes para pagos desde teléfonos
- ✅ **Mejores descripciones**: Información clara de lo que se compra
- ✅ **UX mejorada**: Múltiples opciones de pago (desktop/móvil)
- ✅ **Tracking mejorado**: Metadatos detallados para analytics
- ✅ **API moderna**: PayPal Orders API v2 sin redirect URLs

## 🔍 Troubleshooting

### QR Code no aparece
- Verifica que `includeModpackDetails: true` esté en la solicitud
- Asegúrate de que la librería `qrcode` esté instalada
- Revisa logs del servidor para errores de generación de QR

### Descripción genérica
- Confirma que el modpack existe en la base de datos
- Verifica que `includeModpackDetails: true` esté activado
- Revisa que las relaciones de Publisher estén cargadas

### Error de PayPal
- Verifica credenciales de PayPal
- Confirma que estés usando sandbox para pruebas
- Revisa la configuración de `PAYPAL_BASE_URL`