import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { connectDB } from './db/connection.js';
import habitsRouter from './routes/habits.js';
import tasksRouter from './routes/tasks.js';
import goalsRouter from './routes/goals.js';
import usersRouter from './routes/users.js';
import syncRouter from './routes/sync.js';
import notificationsRouter from './routes/notifications.js';
import cronRouter from './routes/cron.js';

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://taskiye.vercel.app',
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

// 3. Mount Better Auth catch-all route BEFORE express.json() to prevent stream locking
app.all('/api/auth/*', toNodeHandler(auth));

// 4. Body parsing for remaining application endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/goals', goalsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sync', syncRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/cron', cronRouter);

// 7. Initialize Database and start Express Listener (skipped in Vercel serverless)
async function startServer() {
  await connectDB();

  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`[Taskiye Server] Running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
