import mongoose, { Document, Schema } from 'mongoose';

export type GoalTargetType = 'weekly' | 'yearly' | 'custom';

export interface IGoal extends Document {
  userId: string | null;
  title: string;
  deadline: Date;
  targetType: GoalTargetType;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    userId: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
    },
    deadline: {
      type: Date,
      required: [true, 'Goal deadline date is required'],
    },
    targetType: {
      type: String,
      enum: {
        values: ['weekly', 'yearly', 'custom'],
        message: '{VALUE} is not a valid target type (must be weekly, yearly, or custom)',
      },
      required: [true, 'Goal target type is required'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

goalSchema.index({ userId: 1, isCompleted: 1 });

export const Goal = mongoose.model<IGoal>('Goal', goalSchema);
