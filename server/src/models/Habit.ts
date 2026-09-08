import mongoose, { Document, Schema } from 'mongoose';

export interface IHabit extends Document {
  userId: string | null;
  title: string;
  frequency: string;
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
    frequency: {
      type: String,
      default: 'daily',
      trim: true,
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
