import { app } from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

// Connect database and start server
async function startServer() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`CampusHustle API Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

startServer();
