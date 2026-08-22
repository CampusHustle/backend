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
    // Email diagnostic — verifies RESEND_API_KEY is loaded on Render
    if (config.resendApiKey) {
      console.log(`[EmailService] ✅ Resend configured — from: ${config.emailFrom}`);
    } else {
      console.log(`[EmailService] ⚠️  RESEND_API_KEY not set — emails will log to console only. Add it in Render Environment.`);
    }
  });
}

startServer();
