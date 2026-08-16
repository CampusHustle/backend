import mongoose from "mongoose";
import { config } from "./env.js";

/**
 * Connects to MongoDB with retry logic to ensure resilience in CI/CD and production environments.
 * @param {number} retries - Maximum number of connection retries
 * @param {number} delayMs - Delay between retries in milliseconds
 */
export async function connectDB(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(config.databaseUrl, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.warn(`[MongoDB] Connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) {
        if (config.nodeEnv === 'test') {
          console.warn('[MongoDB] Running in test mode without active DB connection.');
          return null;
        }
        console.error(`MongoDB connection failed after ${retries} attempts: ${error.message}`);
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
