import dotenv from "dotenv";

dotenv.config();

/** Centralized configuration object accessing environment variables. */
export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL || "mongodb://localhost:27017/campus_hustle",
  jwtSecret: process.env.JWT_SECRET || "dev_jwt_secret_change_in_production",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "dev_jwt_refresh_secret_change_in_production",
  emailVerificationSecret:
    process.env.EMAIL_VERIFICATION_SECRET ||
    process.env.JWT_SECRET ||
    "dev_email_verify_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  emailVerificationExpiresIn:
    process.env.EMAIL_VERIFICATION_EXPIRES_IN || "24h",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  // Cloudinary credentials (configured via env vars, never committed)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "demo_cloud",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "123456789",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "secret_key",
  // Ethiopian university email domain pattern (strictly ending in .edu.et)
  universityEmailRegex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu\.et$/i,
  // Google Gemini API credentials & configuration for RAG embeddings and Q&A
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite',
  // Brevo REST API Key (bypasses SMTP port restrictions on cloud hosts like Render)
  brevoApiKey: process.env.BREVO_API_KEY || (process.env.SMTP_PASS?.startsWith('xkeysib-') ? process.env.SMTP_PASS : ''),
  // SMTP Email Delivery Configuration (Brevo SMTP fallback)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  emailFrom: process.env.EMAIL_FROM || 'CampusHustle <da16gi@gmail.com>',
};
