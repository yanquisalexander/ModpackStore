
import { Client, Environment, LogLevel, SubscriptionsController } from '@paypal/paypal-server-sdk';

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: 'test',
        oAuthClientSecret: 'test'
    },
    environment: Environment.Sandbox,
});

const subscriptionsController = new SubscriptionsController(client);

console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(subscriptionsController)));
