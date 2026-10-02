import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { ENV } from './lib/env.js';
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
import feedbackRouter from './routes/feedback.js';

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const PORT = ENV.PORT;
const allowedOrigins = Array.from(
  new Set([
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000',
    ...(ENV.CLIENT_URL ? ENV.CLIENT_URL.split(',').map((url) => url.trim()) : []),
    ENV.BETTER_AUTH_URL,
  ].filter(Boolean))
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, serverless internal calls)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.some(
        (allowed) => allowed.replace(/\/$/, '') === normalizedOrigin
      );

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

// Re-establish DB connection on every serverless invocation
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(responseCompression());
app.use('/api/', generalApiLimiter);
app.use('/api/', idempotency);
app.use('/api/auth/*', authLimiter);

// Must mount before express.json() to prevent body-stream locking
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    app: 'Taskiye API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/habits', habitsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/rankings', rankingsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sync', syncRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/chat', chatRouter);
app.use('/api/feedback', feedbackRouter);

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
