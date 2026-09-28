import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import initSocket from './socket/socketHandler.js';
import apiRoutes from './routes/apiRoutes.js';
import { syncLegacyFoodMappings } from './services/stateService.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Determine allowed client origins for CORS
const clientUrlEnv = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = clientUrlEnv.split(',').map((url) => url.trim());

// Express Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or ESP32)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // In development, permit localhost ports dynamically
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for initial deployments, configurable in production
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Key', 'x-device-key']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO with CORS
const io = initSocket(httpServer, allowedOrigins);
app.set('io', io);

// Mount API Endpoints
app.use('/api', apiRoutes);

// Root Index Diagnostic Route
app.get('/', (req, res) => {
  res.json({
    project: 'FreshGuard IoT Refrigerator Backend',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
      deviceStatus: '/api/device/status',
      inventory: '/api/inventory',
      foodHistory: '/api/food-history',
      telemetryIngest: 'POST /api/device/data'
    }
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Server Initialization
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB Atlas (Persistent Store)
  const dbConnected = await connectDB();
  if (dbConnected) {
    await syncLegacyFoodMappings();
  }

  httpServer.listen(PORT, () => {
    console.log('\n======================================================');
    console.log(`🛡️  FreshGuard Backend Server running on port ${PORT}`);
    console.log(`🌐  Local URL:        http://localhost:${PORT}`);
    console.log(`🔌  Socket.IO:        Enabled on port ${PORT}`);
    console.log(`📡  Telemetry Ingest: POST http://localhost:${PORT}/api/device/data`);
    console.log('======================================================\n');
  });
};

startServer();
