import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import errorMiddleware from './middleware/error.middleware.js';
import { ensureDbConnected } from './middleware/db.middleware.js';

import userRoutes from './routes/user.router.js';
import projectRoutes from './routes/project.router.js';
import adminProjectRoutes from './routes/admin.project.router.js';
import cityRoutes from './routes/city.router.js';
import adminCityRoutes from './routes/admin.city.router.js';

const app = express();
app.set('trust proxy', 1);

app.use(morgan('dev'));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local dev & internal server components
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  })
);

app.options('/{*any}', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(ensureDbConnected);
app.get('/ping', (_req, res) => res.json({ status: 'ok', message: 'Pong' }));

// API Routes
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/project', projectRoutes); // Backward compatibility
app.use('/api/v1/admin', adminProjectRoutes);
app.use('/api/v1/cities', cityRoutes);
app.use('/api/v1/admin/cities', adminCityRoutes);

app.all('/{*any}', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorMiddleware);

export default app;