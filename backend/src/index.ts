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


app.use('/v1', router);

app.post('/test-upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.status(200).json({ message: 'File uploaded successfully', file: req.file });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
