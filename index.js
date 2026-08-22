import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocketServer } from './socket/socketServer.js';

async function startServer() {
  await connectDB();

  // Wrap Express in a native HTTP server so Socket.io can share the same port
  const httpServer = createServer(app);

  // Attach Socket.io with CORS matching the Express config
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Register all socket event handlers (FR-7, FR-8)
  initSocketServer(io);

  httpServer.listen(config.port, () => {
    console.log(`CampusHustle API Server running on port ${config.port} (${config.nodeEnv})`);
    // SMTP diagnostic — helps verify environment variables are loaded on Render
    if (config.smtpHost && config.smtpUser && config.smtpPass) {
      console.log(`[EmailService] ✅ SMTP configured — host: ${config.smtpHost}, user: ${config.smtpUser}, from: ${config.emailFrom}`);
    } else {
      console.log(`[EmailService] ⚠️  SMTP NOT configured (emails will log to console). Set SMTP_HOST, SMTP_USER, SMTP_PASS in Render Environment.`);
      console.log(`  SMTP_HOST=${config.smtpHost || '(missing)'}`);
      console.log(`  SMTP_USER=${config.smtpUser || '(missing)'}`);
      console.log(`  SMTP_PASS=${config.smtpPass ? '(set)' : '(missing)'}`);
    }
  });
}

startServer();
