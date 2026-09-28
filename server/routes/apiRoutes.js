import express from 'express';
import {
  handleTelemetry,
  getDeviceStatusController,
  getInventoryController,
  getFoodHistoryController,
  healthCheckController
} from '../controllers/deviceController.js';
import {
  verifyDeviceKey,
  validateTelemetryPayload
} from '../middleware/auth.js';

const router = express.Router();

// System Health Check
router.get('/health', healthCheckController);

// ESP32 Physical Hardware Ingestion (Protected by Device Key & Payload Validation)
router.post('/device/data', verifyDeviceKey, validateTelemetryPayload, handleTelemetry);

// Dashboard Query Endpoints
router.get('/device/status', getDeviceStatusController);
router.get('/inventory', getInventoryController);
router.get('/food-history', getFoodHistoryController);

export default router;
