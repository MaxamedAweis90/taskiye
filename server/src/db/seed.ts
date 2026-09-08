import dotenv from 'dotenv';
dotenv.config();

import { connectDB, mongoDb, mongoClient } from './connection.js';
import { auth } from '../lib/auth.js';
import { Habit } from '../models/Habit.js';
import { Task } from '../models/Task.js';
import { Goal } from '../models/Goal.js';

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  const testEmail = 'ugaas@gmail.com';
  const testPassword = 'ugaas1234';

  const user = await mongoDb.collection('user').findOne({ email: testEmail });
  let userId: string;

  if (!user) {
    console.log(`[Seed] Creating test user: ${testEmail}...`);
    try {
      const authResult = await auth.api.signUpEmail({
        body: {
          email: testEmail,
          password: testPassword,
          name: 'Ugaas',
          username: 'ugaas',
        },
      });

      if (!authResult || !authResult.user) {
        throw new Error('Failed to sign up test user through Better Auth');
      }

      userId = authResult.user.id;
      console.log(`[Seed] Test user created successfully (ID: ${userId})`);
    } catch (err) {
      console.error('[Seed] Error creating user via auth.api.signUpEmail:', err);
      // Fallback: check again or throw
      const fallbackUser = await mongoDb.collection('user').findOne({ email: testEmail });
      if (fallbackUser) {
        userId = fallbackUser.id || fallbackUser._id.toString();
      } else {
        throw err;
      }
    }
  } else {
    userId = user.id || user._id.toString();
    console.log(`[Seed] Test user already exists (ID: ${userId})`);
  }

  // Clear previous sample data for clean testing
  await Habit.deleteMany({ userId });
  await Task.deleteMany({ userId });
  await Goal.deleteMany({ userId });

  console.log('[Seed] Seeding sample habits...');
  const habit1 = await Habit.create({
    userId,
    title: 'Drink 2L of water',
    frequency: 'daily',
    isArchived: false,
  });

  const habit2 = await Habit.create({
    userId,
    title: 'Morning workout & stretch',
    frequency: 'daily',
    isArchived: false,
  });

  const habit3 = await Habit.create({
    userId,
    title: 'Read 20 pages',
    frequency: 'daily',
    isArchived: false,
  });

  const habit4 = await Habit.create({
    userId,
    title: 'Evening meditation & review',
    frequency: 'daily',
    isArchived: false,
  });

  console.log('[Seed] Seeding sample tasks (heatmap & daily views)...');
  const now = new Date();

  // Helper for UTC midnight date
  const createDateOffset = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const today = createDateOffset(0);
  const yesterday = createDateOffset(-1);
  const twoDaysAgo = createDateOffset(-2);
  const tomorrow = createDateOffset(1);

  // Two days ago: 50% completed (faded yellow on heatmap)
  await Task.create([
    {
      userId,
      title: 'Setup initial monorepo structure',
      date: twoDaysAgo,
      isCompleted: true,
      isHabitInstance: false,
      sortOrder: 0,
    },
    {
      userId,
      title: habit1.title,
      date: twoDaysAgo,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit1._id,
      sortOrder: 1,
    },
    {
      userId,
      title: habit2.title,
      date: twoDaysAgo,
      isCompleted: false,
      isHabitInstance: true,
      habitId: habit2._id,
      sortOrder: 2,
    },
    {
      userId,
      title: 'Review database design contracts',
      date: twoDaysAgo,
      isCompleted: false,
      isHabitInstance: false,
      sortOrder: 3,
    },
  ]);

  // Yesterday: 100% completed (bright solid yellow on heatmap)
  await Task.create([
    {
      userId,
      title: habit1.title,
      date: yesterday,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit1._id,
      sortOrder: 0,
    },
    {
      userId,
      title: habit2.title,
      date: yesterday,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit2._id,
      sortOrder: 1,
    },
    {
      userId,
      title: 'Configure Better Auth with MongoDB adapter',
      date: yesterday,
      isCompleted: true,
      isHabitInstance: false,
      sortOrder: 2,
    },
    {
      userId,
      title: habit3.title,
      date: yesterday,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit3._id,
      sortOrder: 3,
    },
  ]);

  // Today: Active board with habit instances and one-off tasks
  await Task.create([
    {
      userId,
      title: habit1.title,
      date: today,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit1._id,
      sortOrder: 0,
    },
    {
      userId,
      title: habit2.title,
      date: today,
      isCompleted: true,
      isHabitInstance: true,
      habitId: habit2._id,
      sortOrder: 1,
    },
    {
      userId,
      title: 'Integrate TanStack Query in frontend',
      date: today,
      isCompleted: false,
      isHabitInstance: false,
      sortOrder: 2,
    },
    {
      userId,
      title: habit3.title,
      date: today,
      isCompleted: false,
      isHabitInstance: true,
      habitId: habit3._id,
      sortOrder: 3,
    },
    {
      userId,
      title: habit4.title,
      date: today,
      isCompleted: false,
      isHabitInstance: true,
      habitId: habit4._id,
      sortOrder: 4,
    },
  ]);

  // Tomorrow: Planned upcoming tasks
  await Task.create([
    {
      userId,
      title: habit1.title,
      date: tomorrow,
      isCompleted: false,
      isHabitInstance: true,
      habitId: habit1._id,
      sortOrder: 0,
    },
    {
      userId,
      title: 'Implement Calendar Heatmap View',
      date: tomorrow,
      isCompleted: false,
      isHabitInstance: false,
      sortOrder: 1,
    },
  ]);

  console.log('[Seed] Seeding sample goals...');
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const endOfYear = new Date(now.getFullYear(), 11, 31);

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await Goal.create([
    {
      userId,
      title: 'Launch Taskiye MVP on Vercel & Railway',
      deadline: endOfMonth,
      targetType: 'custom',
      isCompleted: false,
    },
    {
      userId,
      title: 'Read 12 books on productivity & engineering',
      deadline: endOfYear,
      targetType: 'yearly',
      isCompleted: false,
    },
    {
      userId,
      title: 'Complete Monorepo Architecture and Frontend UI',
      deadline: nextWeek,
      targetType: 'weekly',
      isCompleted: true,
    },
  ]);

  console.log('[Seed] Successfully seeded all collections!');
  console.log(`[Seed] Login credentials:`);
  console.log(`       Email:    ${testEmail}`);
  console.log(`       Password: ${testPassword}`);

  await mongoClient.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed with error:', err);
  process.exit(1);
});
