import { Context, Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import rootRouter from "./routes"; // Corrected import for router
import Passport from "./lib/Passport";
import "dotenv/config";
import "./middleware/upload.middleware"; // Import multer middleware
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception';


// Swagger UI Setup
import { swaggerUI } from '@hono/swagger-ui';
import swaggerSpec from './config/swaggerConfig'; // Import the generated spec

// Global JSON:API Error Handling Utilities
import { serializeError } from './utils/jsonapi';
import { APIError } from "./lib/APIError";
import { AppDataSource } from "./db/data-source";

const app = new Hono();
app.use(logger())
const port = Number(process.env.PORT) || 3000;

const initializeServices = async (): Promise<void> => {
  await AppDataSource.initialize();
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
app.onError((err: Error, c: Context) => {
  console.error('[GLOBAL_ERROR_HANDLER]:', err);

  let statusCode: number = 500;
  let errorResponse = {
    status: '500',
    title: 'Internal Server Error',
    detail: 'Ocurrió un error interno en el servidor.',
    code: 'INTERNAL_SERVER_ERROR'
  };

  if (err instanceof APIError) {
    statusCode = err.statusCode;
    errorResponse = {
      status: err.statusCode.toString(),
      title: err.name,
      detail: err.message,
      code: err.errorCode ?? 'API_ERROR'
    };
  } else if (err instanceof HTTPException) {
    statusCode = err.status;
    errorResponse = {
      status: err.status.toString(),
      title: err.message, // HTTPException usa 'message' como título
      detail: err.message,
      code: 'HTTP_EXCEPTION'
    };
  } else if (process.env.NODE_ENV !== 'production') {
    // Errores genéricos en desarrollo: muestra más detalles.
    errorResponse.detail = err.message;
    errorResponse.title = err.name;
  }

  // Finalmente, envía la respuesta JSON una sola vez.
  // El 'as any' en statusCode es a veces necesario porque c.json espera un tipo literal específico.
  return c.json({ errors: [errorResponse] }, statusCode as any);
});

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

