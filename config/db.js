import mongoose from "mongoose";
import { config } from "./env.js";

/** Connects to MongoDB Atlas using the configured database URL. */
export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.databaseUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
}
