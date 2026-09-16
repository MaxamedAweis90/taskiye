import mongoose, { Document, Schema } from 'mongoose';

export interface IInAppNotification extends Document {
  userId: string | null;
  endpoint: string | null;
  title: string;
  body: string;
  type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system';
  data?: {
    url?: string;
    tag?: string;
    [key: string]: unknown;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inAppNotificationSchema = new Schema<IInAppNotification>(
  {
    userId: {
      type: String,
      default: null,
      index: true,
    },
    endpoint: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Notification body is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['morning', 'planning', 'streak', 'achievement', 'trash', 'system'],
      default: 'system',
    },
    data: {
      type: Schema.Types.Mixed,
      default: () => ({ url: '/' }),
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying of recent notifications
inAppNotificationSchema.index({ userId: 1, createdAt: -1 });
inAppNotificationSchema.index({ endpoint: 1, createdAt: -1 });

// Automatic 30-day expiration so notifications don't accumulate indefinitely
inAppNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const InAppNotification = mongoose.model<IInAppNotification>(
  'InAppNotification',
  inAppNotificationSchema
);
