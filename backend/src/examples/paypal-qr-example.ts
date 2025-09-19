/**
 * Ejemplo de uso de las nuevas funcionalidades de PayPal con QR codes
 * y descripciones mejoradas
 */

import { PaymentService } from '../services/payment.service';

// Ejemplo 1: Crear pago básico (sin detalles del modpack)
async function createBasicPayment() {
    const payment = await PaymentService.createPayment({
        amount: "9.99",
        currency: "USD",
        description: "Compra de modpack",
        modpackId: "modpack-uuid",
        userId: "user-uuid",
        gatewayType: "paypal"
    });

    console.log('Pago básico creado:', {
        paymentId: payment.paymentId,
        approvalUrl: payment.approvalUrl,
        hasQR: !!payment.qrCode
    });
}

// Ejemplo 2: Crear pago con detalles del modpack y QR code
async function createEnhancedPayment() {
    const payment = await PaymentService.createPayment({
        amount: "9.99",
        currency: "USD",
        description: "Compra de modpack",
        modpackId: "modpack-uuid",
        userId: "user-uuid",
        gatewayType: "paypal",
        includeModpackDetails: true, // ✅ Habilita QR y descripciones detalladas
        countryCode: "US"
    });

    console.log('Pago mejorado creado:', {
        paymentId: payment.paymentId,
        approvalUrl: payment.approvalUrl,
        hasQR: !!payment.qrCode,
        qrCodeLength: payment.qrCode?.length,
        metadata: payment.metadata
    });

    // El QR code está en payment.qrCode como base64
    // La URL del QR está en payment.qrCodeUrl
    return payment;
}

// Ejemplo 3: Capturar pago aprobado
async function capturePayment(paymentId: string) {
    const capture = await PaymentService.capturePayment("paypal", paymentId);

    console.log('Pago capturado:', {
        paymentId: capture.paymentId,
        status: capture.status,
        hasQR: !!capture.qrCode
    });

    return capture;
}

// Ejemplo de uso en frontend
function handlePaymentResponse(payment: any) {
    // Mostrar opciones de pago
    console.log('Opciones de pago:');
    console.log('- Desktop:', payment.approvalUrl);
    console.log('- Móvil QR:', payment.qrCode ? 'Disponible' : 'No disponible');

    // En React/Vue/Angular:
    // <img src={payment.qrCode} alt="QR para pago móvil" />
    // <a href={payment.approvalUrl} target="_blank">Pagar en navegador</a>

    return {
        desktopUrl: payment.approvalUrl,
        mobileQR: payment.qrCode,
        paymentId: payment.paymentId
    };
}

// Ejemplo completo
async function completePaymentFlow() {
    try {
        // 1. Crear pago con QR
        const payment = await createEnhancedPayment();

        // 2. Mostrar opciones al usuario
        const options = handlePaymentResponse(payment);

        // 3. Usuario paga (simulado)
        console.log('Usuario puede pagar via:', options);

        // 4. Capturar pago (después de aprobación)
        // const capture = await capturePayment(payment.paymentId);

    } catch (error) {
        console.error('Error en flujo de pago:', error);
    }
}

export {
    createBasicPayment,
    createEnhancedPayment,
    capturePayment,
    handlePaymentResponse,
    completePaymentFlow
};