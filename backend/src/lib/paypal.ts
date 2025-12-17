import { Client, Environment, LogLevel, OrdersController } from '@paypal/paypal-server-sdk';



const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || ''
    },
    timeout: 0,
    environment: Environment.Sandbox,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: {
            logBody: true
        },
        logResponse: {
            logHeaders: true
        }
    },
});

const ordersController = new OrdersController(client);

export { client as paypal, ordersController };
