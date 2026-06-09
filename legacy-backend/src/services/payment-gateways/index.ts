export * from './interfaces';
export * from './paypal.gateway';
export * from './mercadopago.gateway';
export * from './manager';

// Re-export the manager instance for easy access
import { PaymentGatewayManager } from './manager';
export const paymentGatewayManager = PaymentGatewayManager.getInstance();