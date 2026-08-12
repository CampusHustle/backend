import dotenv from "dotenv";

dotenv.config();
export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL || "mongodb://localhost:27017/campus_hustle",
};
