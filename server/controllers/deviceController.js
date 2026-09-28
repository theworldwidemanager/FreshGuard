import {
  processDeviceTelemetry,
  getDeviceStatus,
  getActiveInventory,
  getFoodHistory
} from '../services/stateService.js';
import { getDBStatus } from '../config/db.js';

/**
 * Physical ESP32 Telemetry Ingestion Endpoint
 * Route: POST /api/device/data
 */
export const handleTelemetry = async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await processDeviceTelemetry(req.body, io);

    return res.status(200).json({
      success: true,
      message: 'Telemetry received and processed successfully',
      data: {
        deviceId: result.deviceState.deviceId,
        lastSeen: result.deviceState.lastSeen,
        eventsCreated: result.eventsCreated,
        inventoryChanged: result.inventoryChanged
      }
    });
  } catch (error) {
    console.error('❌ [CONTROLLER ERROR] Telemetry processing failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing device telemetry',
      details: error.message
    });
  }
};

/**
 * Current Device Status Endpoint
 * Route: GET /api/device/status
 */
export const getDeviceStatusController = async (req, res) => {
  try {
    const deviceId = req.query.deviceId || 'freshguard-fridge-01';
    const status = await getDeviceStatus(deviceId);

    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('❌ [CONTROLLER ERROR] Failed to fetch device status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch device status',
      details: error.message
    });
  }
};

/**
 * Active Food Inventory Endpoint
 * Route: GET /api/inventory
 */
export const getInventoryController = async (req, res) => {
  try {
    const inventory = await getActiveInventory();
    return res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (error) {
    console.error('❌ [CONTROLLER ERROR] Failed to fetch inventory:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active inventory',
      details: error.message
    });
  }
};

/**
 * Historical RFID Food Events Endpoint
 * Route: GET /api/food-history
 */
export const getFoodHistoryController = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await getFoodHistory(limit);

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('❌ [CONTROLLER ERROR] Failed to fetch food history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch food history',
      details: error.message
    });
  }
};

/**
 * Backend Health & Diagnostic Endpoint
 * Route: GET /api/health
 */
export const healthCheckController = (req, res) => {
  const dbStatus = getDBStatus();
  return res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus
  });
};
