import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './src/config/index.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import likeRoutes from './src/routes/likes.js';
import messageRoutes from './src/routes/messages.js';
import vibeRoutes from './src/routes/vibe.js';
import moveRoutes from './src/routes/moves.js';
import paymentRoutes from './src/routes/payments.js';
import reportRoutes from './src/routes/reports.js';
import adminRoutes from './src/routes/admin.js';
import notificationRoutes from './src/routes/notifications.js';
import storyRoutes from './src/routes/stories.js';
import pushRoutes from './src/routes/push.js';
import songRoutes from './src/routes/songs.js';
import { setupSocketHandlers } from './src/sockets/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const corsOrigin = config.clientUrl || true;
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Middleware
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/vibe', vibeRoutes);
app.use('/api/moves', moveRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/songs', songRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the built React client
if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Socket.io
setupSocketHandlers(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`Motion server running on port ${config.port}`);
});

export { app, io };
