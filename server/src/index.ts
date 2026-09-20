import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { connectDB } from './db/connection.js';
import { authLimiter, generalApiLimiter } from './middleware/rateLimiter.js';
import { responseCompression } from './middleware/compression.js';
import { idempotency } from './middleware/idempotency.js';
import habitsRouter from './routes/habits.js';
import tasksRouter from './routes/tasks.js';
import rankingsRouter from './routes/rankings.js';
import friendsRouter from './routes/friends.js';
import usersRouter from './routes/users.js';
import syncRouter from './routes/sync.js';
import notificationsRouter from './routes/notifications.js';
import cronRouter from './routes/cron.js';
import chatRouter from './routes/chat.js';

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://taskiye.vercel.app',
  'https://taskiye-server.vercel.app',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((url) => url.trim()) : []),
];

// 1. CORS Configuration (Allows cookies and sessions from Vite client & Vercel deployments)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, origin);
    },
    credentials: true,
  })
);

// 2. Ensure Database Connection for Serverless Invocations
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// 2.5 Response compression for JSON payloads > 1KB
app.use(responseCompression());

// 3. General API rate limiter across all endpoints
app.use('/api/', generalApiLimiter);

// 3.5 Idempotency guard for mutation operations
app.use('/api/', idempotency);

// 4. Strict Rate Limiting on Authentication endpoints
app.use('/api/auth/*', authLimiter);

// 5. Mount Better Auth catch-all route BEFORE express.json() to prevent stream locking
app.all('/api/auth/*', toNodeHandler(auth));

// 6. Body parsing with strict payload boundary limits (512KB) to prevent memory exhaustion
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// 5. Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    app: 'Taskiye API',
    timestamp: new Date().toISOString(),
  });
});

// 6. Feature Routes
app.use('/api/habits', habitsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/rankings', rankingsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sync', syncRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/chat', chatRouter);

// 7. Initialize Database and start Express Listener (skipped in Vercel serverless)
async function startServer() {
  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`[Taskiye Server] Running on http://localhost:${PORT}`);
    });
  }

  await connectDB().catch((err) => {
    console.error('[MongoDB Error]:', err);
  });
}

startServer();

export default app;
