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
  deletedAt?: Date | null;
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
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying of recent active and trashed notifications
inAppNotificationSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
inAppNotificationSchema.index({ endpoint: 1, deletedAt: 1, createdAt: -1 });

// Automatic 30-day expiration so notifications don't accumulate indefinitely
inAppNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

// Automatic 30-day expiration for trashed items
inAppNotificationSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { deletedAt: { $ne: null } } }
);

export const InAppNotification = mongoose.model<IInAppNotification>(
  'InAppNotification',
  inAppNotificationSchema
);
