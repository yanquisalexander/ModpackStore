
require('dotenv').config();

console.log('--- PayPal Env Check ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PAYPAL_CLIENT_ID Length:', process.env.PAYPAL_CLIENT_ID ? process.env.PAYPAL_CLIENT_ID.length : 'MISSING');
console.log('PAYPAL_CLIENT_SECRET Length:', process.env.PAYPAL_CLIENT_SECRET ? process.env.PAYPAL_CLIENT_SECRET.length : 'MISSING');

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_ID.trim() !== process.env.PAYPAL_CLIENT_ID) {
    console.log('WARNING: PAYPAL_CLIENT_ID has leading/trailing whitespace!');
}
if (process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_CLIENT_SECRET.trim() !== process.env.PAYPAL_CLIENT_SECRET) {
    console.log('WARNING: PAYPAL_CLIENT_SECRET has leading/trailing whitespace!');
}
console.log('------------------------');
