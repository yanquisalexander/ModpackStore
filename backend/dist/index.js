"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const node_server_1 = require("@hono/node-server");
const cors_1 = require("hono/cors");
const routes_1 = __importDefault(require("./routes")); // Corrected import for router
const Passport_1 = __importDefault(require("./lib/Passport"));
require("dotenv/config");
require("./middleware/upload.middleware"); // Import multer middleware
const logger_1 = require("hono/logger");
const http_exception_1 = require("hono/http-exception");
// Swagger UI Setup
const swagger_ui_1 = require("@hono/swagger-ui");
const swaggerConfig_1 = __importDefault(require("./config/swaggerConfig")); // Import the generated spec
const APIError_1 = require("./lib/APIError");
const app = new hono_1.Hono();
app.use((0, logger_1.logger)());
const port = Number(process.env.PORT) || 3000;
const initializeServices = () => __awaiter(void 0, void 0, void 0, function* () {
    // Initialize Passport strategies
    yield Passport_1.default.setup();
    console.log('Passport setup initialized.');
    // Add any other service initializations here
});
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
app.use('*', (0, cors_1.cors)({
    origin: process.env.CORS_ORIGIN || '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));
app.notFound((c) => {
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
app.get('/v1/api-docs/*', (0, swagger_ui_1.swaggerUI)({
    url: '/v1/openapi.json',
    spec: swaggerConfig_1.default,
}));
// Exponer el spec de OpenAPI en /v1/openapi.json
app.get('/v1/openapi.json', (c) => c.json(swaggerConfig_1.default));
// Mount API routes
app.route('/v1', routes_1.default);
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
app.onError((err, c) => {
    var _a;
    console.error('[GLOBAL_ERROR_HANDLER]:', err);
    let statusCode = 500;
    let errorResponse = {
        status: '500',
        title: 'Internal Server Error',
        detail: 'Ocurrió un error interno en el servidor.',
        code: 'INTERNAL_SERVER_ERROR'
    };
    if (err instanceof APIError_1.APIError) {
        statusCode = err.statusCode;
        errorResponse = {
            status: err.statusCode.toString(),
            title: err.name,
            detail: err.message,
            code: (_a = err.errorCode) !== null && _a !== void 0 ? _a : 'API_ERROR'
        };
    }
    else if (err instanceof http_exception_1.HTTPException) {
        statusCode = err.status;
        errorResponse = {
            status: err.status.toString(),
            title: err.message, // HTTPException usa 'message' como título
            detail: err.message,
            code: 'HTTP_EXCEPTION'
        };
    }
    else if (process.env.NODE_ENV !== 'production') {
        // Errores genéricos en desarrollo: muestra más detalles.
        errorResponse.detail = err.message;
        errorResponse.title = err.name;
    }
    // Finalmente, envía la respuesta JSON una sola vez.
    // El 'as any' en statusCode es a veces necesario porque c.json espera un tipo literal específico.
    return c.json({ errors: [errorResponse] }, statusCode);
});
// Start the server
console.log(`Server is preparing to run on port ${port}`);
(0, node_server_1.serve)({
    fetch: app.fetch,
    port: port
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
// Basic health check or root route (optional)
app.get('/', (c) => c.text('Modpack Store API is running!'));
