import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import AppError from './utils/AppError';
import { performanceMonitor, requestLogger } from './middlewares/loggerMiddleware';
import errorHandler from './middlewares/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import database from './configs/database';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());
app.use(requestLogger);
app.use(performanceMonitor);

app.get('/health', async (req: Request, res: Response) => {
  const health = await database.healthCheck();

  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: health,
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

app.use(errorHandler);

export default app;
