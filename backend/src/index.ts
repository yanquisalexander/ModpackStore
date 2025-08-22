import { Context, Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import rootRouter from "./routes"; // Corrected import for router
import Passport from "./lib/Passport";
import "dotenv/config";
import "./middleware/upload.middleware"; // Import multer middleware
import { logger } from 'hono/logger'

// Swagger UI Setup
import { swaggerUI } from '@hono/swagger-ui';
import swaggerSpec from './config/swaggerConfig'; // Import the generated spec

// Global JSON:API Error Handling Utilities
import { serializeError } from './utils/jsonapi';
import { APIError } from "./lib/APIError";

const app = new Hono();
app.use(logger())
const port = Number(process.env.PORT) || 3000;

const initializeServices = async (): Promise<void> => {
  // Initialize Passport strategies
  await Passport.setup();
  console.log('Passport setup initialized.');
  // Add any other service initializations here
};

// Call initializeServices
initializeServices()
  .then(() => {
    console.log('All services initialized successfully');
  })
  .catch((error) => {
    console.error('Error initializing services:', error);
    process.exit(1); // Exit if essential services fail to initialize
  });

// CORS Middleware
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));

app.notFound((c: Context) => {
  return c.json({
    errors: [{
      status: '404',
      title: 'Route Not Found',
      detail: `The route ${c.req.path} was not found on this server.`
    }]
  }, 404);
});

// JSON body parsing is typically handled by Hono by default for correct Content-Types.
// If specific needs arise, `hono/body-parse` middleware can be added.

// Swagger UI Route
// Serve Swagger UI at /v1/api-docs
app.get('/v1/api-docs/*', swaggerUI({
  url: '/v1/openapi.json',
  spec: swaggerSpec,
}));

// Exponer el spec de OpenAPI en /v1/openapi.json
app.get('/v1/openapi.json', (c) => c.json(swaggerSpec));

// Mount API routes
app.route('/v1', rootRouter);

// Test upload route (temporarily commented out/removed)
/*
app.post('/test-upload', upload.single('file'), (c) => {
  // This will need to be adapted for Hono's context `c` and how file uploads are handled.
  // For now, it's removed as per instructions.
  // const file = c.req.file; // Example, actual access might differ
  // if (!file) {
  //   return c.json({ error: 'No file uploaded' }, 400);
  // }
  // return c.json({ message: 'File uploaded successfully', file: file });
});
*/

// Global Error Handling
/* app.onError((err: any, c) => {
  console.error("[GLOBAL_ERROR_HANDLER]", err); // Log the error for debugging

  if (err instanceof APIError) {
    // Handle APIError instances specifically
    return c.json(serializeError({
      status: err.statusCode.toString(),
      title: err.name || 'API Error',
      detail: err.message,
      code: err.errorCode, // If APIError has an errorCode property
    }), err.statusCode as any);
  } else if (err.status && typeof err.status === 'number') {
    // Handle errors with a .status property (like some Hono errors or manually thrown)
    // Hono's HTTPException often comes here.
    return c.json(serializeError({
      status: err.status.toString(),
      title: err.name || 'Error', // err.name might not always be suitable
      detail: err.message || 'An unexpected error occurred.',
    }), err.status);
  } else {
    // Generic fallback for other types of errors
    return c.json(serializeError({
      status: '500',
      title: 'Internal Server Error',
      detail: (err instanceof Error ? err.message : 'An unexpected internal server error occurred.'),
    }), 500);
  }
}); */

// Start the server
console.log(`Server is preparing to run on port ${port}`);
serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

// Basic health check or root route (optional)
app.get('/', (c) => c.text('Modpack Store API is running!'));

