import mongoose from 'mongoose';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskiye';

export const mongoClient = new MongoClient(MONGODB_URI);
export const mongoDb: Db = mongoClient.db();

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
      console.log('[MongoDB] Mongoose connected successfully');
    }

    await mongoClient.connect();
    console.log('[MongoDB] Native MongoClient connected successfully');
    isConnected = true;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
  }
}
