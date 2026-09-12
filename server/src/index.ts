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

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. CORS Configuration (Allows cookies and sessions from Vite client)
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// 2. Mount Better Auth catch-all route BEFORE express.json() to prevent stream locking
app.all('/api/auth/*', toNodeHandler(auth));

// 3. Body parsing for remaining application endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    app: 'Taskiye API',
    timestamp: new Date().toISOString(),
  });
});

// 5. Feature Routes
app.use('/api/habits', habitsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sync', syncRouter);

// 6. Initialize Database and start Express Listener
async function startServer() {
  await connectDB();

  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`[Taskiye Server] Running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
