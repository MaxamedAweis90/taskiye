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
  archivedAt?: Date | null;
  consistencyRate: number;
  activeDays: number[];
  isArchived: boolean;
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
  },
  {
    timestamps: true,
  }
);

// Optimize query for fetching active habits for a user
habitSchema.index({ userId: 1, isArchived: 1 });

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
