import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV === 'development';

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://devhubfusionx.github.io',
  ],
  credentials: true
}));
if (isDev) {
  app.use(morgan('dev'));
}
app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (process.env.PERF_LOG === 'true') {
      console.log(`[PERF] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(2)}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  res.status(200).json({
    status: 'up',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptimeSeconds: process.uptime(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    cpu: {
      userMicros: cpu.user,
      systemMicros: cpu.system,
    },
  });
});

// Error Handling (Basic)
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
