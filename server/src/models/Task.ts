import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITask extends Document {
  userId: string | null;
  title: string;
  date: Date;
  isCompleted: boolean;
  isHabitInstance: boolean;
  habitId: Types.ObjectId | null;
  sortOrder: number;
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
  },
  {
    timestamps: true,
  }
);

// Optimize query for fetching tasks by user and date, sorted by sortOrder
taskSchema.index({ userId: 1, date: 1, sortOrder: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
