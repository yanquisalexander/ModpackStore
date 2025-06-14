import express from 'express';
import { router } from "./routes";
import Passport from "./lib/Passport";
import "dotenv/config";
import cors from "cors";
import { upload } from "./middlewares/upload.middleware";

const app = express();
const port = process.env.PORT || 3000;

const initializeServices = async (): Promise<void> => {
  // Initialize Passport strategies
  await Passport.setup();

  // Add any other service initializations here
}
initializeServices()
  .then(() => {
    console.log('All services initialized successfully');
  })
  .catch((error) => {
    console.error('Error initializing services:', error);
  });


app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Swagger UI Setup
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swaggerConfig'; // Import the generated spec

// Serve Swagger UI at /v1/api-docs
// It's important to use app.use here, not router.use, if router is specifically for /v1 API routes.
// However, if router in "./routes" is the main app router, it can be app.use('/v1/api-docs', ...)
// For clarity, using app.use directly.
const swaggerUiOptions = {
  // customCss: '.swagger-ui .topbar { display: none }', // Optional: Custom CSS
  // customSiteTitle: "Modpack Store API Docs", // Optional: Custom site title
  // explorer: true, // Optional: Enable search bar
};
app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));


app.use('/v1', router);

app.post('/test-upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.status(200).json({ message: 'File uploaded successfully', file: req.file });
});

// Global JSON:API Error Handling Middleware
// This should be after all routes and other middlewares
import { serializeError } from './utils/jsonapi';
import { APIError } from './lib/APIError'; // Assuming APIError is a custom error class
import { Request, Response, NextFunction } from 'express';

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[GLOBAL_ERROR_HANDLER]", err); // Log the error for debugging

  if (err instanceof APIError) {
    // Handle APIError instances specifically
    res.status(err.statusCode).json(serializeError({
      status: err.statusCode.toString(),
      title: err.name || 'API Error',
      detail: err.message,
      code: err.errorCode, // If APIError has an errorCode property
    }));
  } else if (err.status && typeof err.status === 'number') {
    // Handle errors with a .status property (like some Express errors)
    res.status(err.status).json(serializeError({
      status: err.status.toString(),
      title: err.name || 'Error',
      detail: err.message || 'An unexpected error occurred.',
    }));
  } else {
    // Generic fallback for other types of errors
    res.status(500).json(serializeError({
      status: '500',
      title: 'Internal Server Error',
      detail: err.message || 'An unexpected internal server error occurred.',
    }));
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
