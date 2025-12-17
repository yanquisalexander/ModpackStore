require('dotenv').config();
const { Client, Environment, OrdersController } = require('@paypal/paypal-server-sdk');

async function testPayPalCredentials() {
    console.log('🧪 Probando credenciales de PayPal...\n');

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    console.log('PAYPAL_CLIENT_ID:', clientId ? `${clientId.substring(0, 10)}...` : '❌ MISSING');
    console.log('PAYPAL_CLIENT_SECRET:', clientSecret ? `${clientSecret.substring(0, 10)}...` : '❌ MISSING');

    if (!clientId || !clientSecret) {
        console.log('\n❌ Error: Credenciales de PayPal no configuradas');
        return;
    }

    if (clientId === clientSecret) {
        console.log('\n❌ Error: CLIENT_ID y CLIENT_SECRET no pueden ser iguales');
        return;
    }

    try {
        const client = new Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: clientId,
                oAuthClientSecret: clientSecret
            },
            environment: Environment.Sandbox,
        });

        const ordersController = new OrdersController(client);

        // Intentar crear una orden de prueba mínima
        const collect = {
            body: {
                intent: 'CAPTURE',
                purchaseUnits: [{
                    amount: {
                        currencyCode: 'USD',
                        value: '0.01'
                    }
                }]
            }
        };

        const { result } = await ordersController.createOrder(collect);
        console.log('\n✅ Éxito: Credenciales de PayPal válidas');
        console.log('Order ID de prueba:', result.id);

    } catch (error) {
        console.log('\n❌ Error: Credenciales de PayPal inválidas');
        console.log('Detalle:', error.message);

        if (error.statusCode === 401) {
            console.log('\n💡 Solución: Verifica que las credenciales sean correctas en https://developer.paypal.com/');
        }
    }
}

testPayPalCredentials();