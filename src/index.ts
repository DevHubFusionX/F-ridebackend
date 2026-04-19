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

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[BOOT] Starting F-ride backend...');
console.log(`[BOOT] NODE_ENV     : ${process.env.NODE_ENV}`);
console.log(`[BOOT] PORT         : ${process.env.PORT || 5000}`);
console.log(`[BOOT] MONGODB_URI  : ${process.env.MONGODB_URI ? '✓ set' : '✗ MISSING'}`);
console.log(`[BOOT] JWT_SECRET   : ${process.env.JWT_SECRET ? '✓ set' : '✗ MISSING'}`);
console.log(`[BOOT] GMAIL_USER   : ${process.env.GMAIL_USER ? '✓ set' : '✗ MISSING'}`);
console.log(`[BOOT] GMAIL_APP_PASS: ${process.env.GMAIL_APP_PASS ? '✓ set' : '✗ MISSING'}`);
console.log(`[BOOT] FRONTEND_URL : ${process.env.FRONTEND_URL || '(not set)'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV === 'development';

// Middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://devhubfusionx.github.io',
  'https://f-ride.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(express.json());

// Request logger
app.use((req: Request, res: Response, next) => {
  const start = process.hrtime.bigint();
  console.log(`[REQ] ${req.method} ${req.originalUrl} — origin: ${req.headers.origin || 'none'}`);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(`[RES] ${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs.toFixed(1)}ms)`);
  });
  next();
});

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'F-ride API is live 🚀', docs: '/api/health' });
});

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

// Error Handling
app.use((err: any, req: Request, res: Response, _next: any) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[BOOT] 🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
