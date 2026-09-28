import { Server } from 'socket.io';
import DeviceState from '../models/DeviceState.js';
import { OFFLINE_TIMEOUT_MS } from '../services/stateService.js';

let lastKnownOnlineState = false;

/**
 * Initialize Socket.IO with CORS settings and background offline detector.
 */
export const initSocket = (httpServer, allowedOrigin) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // Client connected
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  // Background interval: Detects when physical ESP32 stops transmitting telemetry
  // Runs every 3 seconds to check lastSeen timestamp in MongoDB
  setInterval(async () => {
    try {
      const state = await DeviceState.findOne({ deviceId: 'freshguard-fridge-01' });
      if (!state) return;

      const timeSinceLastSeen = Date.now() - new Date(state.lastSeen).getTime();
      const isOnline = timeSinceLastSeen <= OFFLINE_TIMEOUT_MS;

      // If transition between Online <-> Offline occurs, broadcast updated state
      if (isOnline !== lastKnownOnlineState) {
        lastKnownOnlineState = isOnline;
        io.emit('device', {
          ...state.toObject(),
          isOnline
        });
      }
    } catch (err) {
      // Ignore background query errors if DB is temporarily disconnected
    }
  }, 3000);

  return io;
};

export default initSocket;
