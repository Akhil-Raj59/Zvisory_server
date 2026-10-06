import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import errorMiddleware from './middleware/error.middleware.js';
import { ensureDbConnected } from './middleware/db.middleware.js';

import userRoutes from './routes/user.router.js';


const app = express();
app.set('trust proxy', 1);

app.use(morgan('dev'));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie'],
  exposedHeaders: ['Set-Cookie'] 
}));

app.options('/{*any}', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(ensureDbConnected);
app.get('/ping', (_req, res) => res.json({ status: 'ok', message: 'Pong' }));

app.use('/api/v1/user', userRoutes);


app.all('/{*any}', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorMiddleware);

export default app;