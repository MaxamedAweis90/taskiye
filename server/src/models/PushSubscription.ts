import mongoose, { Document, Schema } from 'mongoose';

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface INotificationPreferences {
  dailyReminders: boolean;
  streakAlerts: boolean;
  dailyCadenceDigest: boolean;
}

export interface IPushSubscription extends Document {
  userId: string | null;
  endpoint: string;
  keys: IPushSubscriptionKeys;
  timezone: string;
  preferences: INotificationPreferences;
  lastNotifiedDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: String,
      default: null,
      index: true,
    },
    endpoint: {
      type: String,
      required: [true, 'Push subscription endpoint is required'],
      unique: true,
      index: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    preferences: {
      dailyReminders: {
        type: Boolean,
        default: true,
      },
      streakAlerts: {
        type: Boolean,
        default: true,
      },
      dailyCadenceDigest: {
        type: Boolean,
        default: true,
      },
    },
    lastNotifiedDate: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PushSubscription = mongoose.model<IPushSubscription>(
  'PushSubscription',
  pushSubscriptionSchema
);
