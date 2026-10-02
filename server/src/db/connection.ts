import mongoose from 'mongoose';
import { MongoClient, Db } from 'mongodb';
import { ENV } from '../lib/env.js';

const MONGODB_URI = ENV.MONGODB_URI;

export const mongoClient = new MongoClient(MONGODB_URI);
export const mongoDb: Db = mongoClient.db();

let isConnected = false;
let connectionPromise: Promise<void> | null = null;

export async function connectDB(): Promise<void> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // Deduplicate concurrent connection attempts during serverless cold starts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        });
      }

      await mongoClient.connect();
      isConnected = true;
    } catch (error) {
      isConnected = false;
      console.error('[MongoDB] Connection failed:', error);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}
