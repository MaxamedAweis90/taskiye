import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITask extends Document {
  userId: string | null;
  title: string;
  date: Date;
  isCompleted: boolean;
  isHabitInstance: boolean;
  habitId: Types.ObjectId | null;
  sortOrder: number;
  category?: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Task date is required'],
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    isHabitInstance: {
      type: Boolean,
      default: false,
    },
    habitId: {
      type: Schema.Types.ObjectId,
      ref: 'Habit',
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      default: 'Work',
      trim: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
    timeTag: {
      type: String,
      default: null,
      trim: true,
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

// Optimize query for fetching active tasks by user and date, sorted by sortOrder
taskSchema.index({ userId: 1, deletedAt: 1, date: 1, sortOrder: 1 });

// MongoDB TTL Index: automatically hard-deletes tasks 30 days after soft-deletion
taskSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days = 2,592,000 seconds
    partialFilterExpression: { deletedAt: { $type: 'date' } },
  }
);

export const Task = mongoose.model<ITask>('Task', taskSchema);
