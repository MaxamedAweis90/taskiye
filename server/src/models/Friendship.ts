import mongoose, { Document, Schema } from 'mongoose';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface IFriendship extends Document {
  requesterId: string;
  recipientId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    requesterId: {
      type: String,
      required: [true, 'Requester ID is required'],
      index: true,
    },
    recipientId: {
      type: String,
      required: [true, 'Recipient ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate friend requests between the same pair
friendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

// Index for quickly looking up all friendships for a user
friendshipSchema.index({ recipientId: 1, status: 1 });

export const Friendship = mongoose.model<IFriendship>('Friendship', friendshipSchema);
