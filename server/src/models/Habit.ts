import mongoose, { Document, Schema } from 'mongoose';

export interface IHabit extends Document {
  userId: string | null;
  title: string;
  category: string;
  frequency: string;
  timeOfDay?: string;
  targetUnit?: string;
  streakDays: number;
  totalCompletions: number;
  warnings: number; // 0, 1, or 2 warnings before streak resets to 0
  lastCompletedDate?: string | null; // YYYY-MM-DD
  lastStreak?: number; // Preserved streak for pause/travel mode
  isStreakFrozen?: boolean; // Vacation/freeze mode to pause streak tracking
  frozenAt?: Date | null; // Timestamp when freeze mode was initiated
  completedDates?: string[]; // Historical completion dates (YYYY-MM-DD)
  archivedAt?: Date | null;
  consistencyRate: number;
  activeDays: number[];
  isArchived: boolean;
  sortOrder: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const habitSchema = new Schema<IHabit>(
  {
    userId: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Habit title is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'Routine',
      trim: true,
    },
    frequency: {
      type: String,
      default: 'Daily',
      trim: true,
    },
    timeOfDay: {
      type: String,
      default: 'Morning (08:00 AM)',
      trim: true,
    },
    targetUnit: {
      type: String,
      default: 'sessions',
      trim: true,
    },
    streakDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCompletions: {
      type: Number,
      default: 0,
      min: 0,
    },
    warnings: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    lastCompletedDate: {
      type: String,
      default: null,
    },
    lastStreak: {
      type: Number,
      default: 0,
    },
    isStreakFrozen: {
      type: Boolean,
      default: false,
    },
    frozenAt: {
      type: Date,
      default: null,
    },
    completedDates: {
      type: [String],
      default: [],
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    consistencyRate: {
      type: Number,
      default: 100,
    },
    activeDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize query for fetching active habits for a user with sorting
habitSchema.index({ userId: 1, deletedAt: 1, isArchived: 1, sortOrder: 1 });

// MongoDB TTL Index: automatically hard-deletes habits 30 days after soft-deletion
habitSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
    partialFilterExpression: { deletedAt: { $type: 'date' } },
  }
);

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
