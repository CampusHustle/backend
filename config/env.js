import dotenv from 'dotenv';

dotenv.config();

/** Centralized configuration object accessing environment variables. */
export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/campus_hustle',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Ethiopian university email domain pattern (strictly ending in .edu.et)
  universityEmailRegex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu\.et$/i
};
