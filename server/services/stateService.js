import DeviceState from '../models/DeviceState.js';
import FoodItem, { calculateFoodStatus } from '../models/FoodItem.js';
import FoodHistory from '../models/FoodHistory.js';

// Configuration mapping physical RFID tags to food items with manufacture & expiry dates
export const FOOD_RFID_CONFIG = {
  Beef: {
    foodName: 'Cold Drink',
    name: 'Cold Drink',
    rfidUid: 'AC BF 63 06',
    manufactureDate: new Date('2026-09-23T00:00:00.000Z'),
    expiryDate: new Date('2026-09-29T23:59:59.999Z') // FRESH relative to 27-Sep-2026
  },
  Mutton: {
    foodName: 'Juice',
    name: 'Juice',
    rfidUid: '9C 94 02 07',
    manufactureDate: new Date('2026-09-22T00:00:00.000Z'),
    expiryDate: new Date('2026-09-27T23:59:59.999Z') // EXPIRED relative to current time / RTC
  }
};

// Threshold for considering ESP32 offline (15 seconds)
export const OFFLINE_TIMEOUT_MS = 15000;

/**
 * Process incoming ESP32 telemetry payload.
 * Evaluates state transitions, updates MongoDB Atlas, and dispatches real-time Socket.IO events.
 *
 * @param {Object} telemetry - Validated payload from ESP32
 * @param {Object} io - Socket.IO server instance
 */
export const processDeviceTelemetry = async (telemetry, io) => {
  const {
    deviceId,
    temperature,
    humidity,
    gasValue,
    gasStatus,
    doorStatus,
    doorAlarm,
    gasAlarm,
    temperatureAlarm,
    humidityAlarm,
    beefQty,
    muttonQty,
    rtcTime
  } = telemetry;

  const now = new Date();

  // 1. Fetch previous known device state from MongoDB Atlas to detect state transitions
  const previousState = await DeviceState.findOne({ deviceId });

  const foodEventsCreated = [];
  let inventoryChanged = false;

  // 2. Evaluate Tag 1 Transition (UID: AC BF 63 06 -> Cold Drink)
  const previousBeefQty = previousState ? (previousState.beefQty ?? 0) : null;
  const beefTransition = detectQuantityTransition(previousBeefQty, beefQty);
  const tag1Config = FOOD_RFID_CONFIG.Beef;

  if (beefTransition === 'ADDED') {
    inventoryChanged = true;
    await FoodItem.findOneAndUpdate(
      { rfidUid: tag1Config.rfidUid },
      {
        foodName: tag1Config.foodName,
        name: tag1Config.name,
        rfidUid: tag1Config.rfidUid,
        quantity: 1,
        isInside: true,
        manufactureDate: tag1Config.manufactureDate,
        expiryDate: tag1Config.expiryDate,
        status: calculateFoodStatus(tag1Config.expiryDate),
        addedAt: now,
        lastUpdated: now
      },
      { upsert: true, new: true }
    );

    const historyDoc = await FoodHistory.create({
      deviceId,
      foodName: tag1Config.foodName,
      rfidUid: tag1Config.rfidUid,
      action: 'ADDED',
      timestamp: now
    });
    foodEventsCreated.push(historyDoc);
  } else if (beefTransition === 'REMOVED') {
    inventoryChanged = true;
    await FoodItem.findOneAndUpdate(
      { rfidUid: tag1Config.rfidUid },
      {
        quantity: 0,
        isInside: false,
        lastUpdated: now
      },
      { upsert: true }
    );

    const historyDoc = await FoodHistory.create({
      deviceId,
      foodName: tag1Config.foodName,
      rfidUid: tag1Config.rfidUid,
      action: 'REMOVED',
      timestamp: now
    });
    foodEventsCreated.push(historyDoc);
  }

  // 3. Evaluate Tag 2 Transition (UID: 9C 94 02 07 -> Juice)
  const previousMuttonQty = previousState ? (previousState.muttonQty ?? 0) : null;
  const muttonTransition = detectQuantityTransition(previousMuttonQty, muttonQty);
  const tag2Config = FOOD_RFID_CONFIG.Mutton;

  if (muttonTransition === 'ADDED') {
    inventoryChanged = true;
    await FoodItem.findOneAndUpdate(
      { rfidUid: tag2Config.rfidUid },
      {
        foodName: tag2Config.foodName,
        name: tag2Config.name,
        rfidUid: tag2Config.rfidUid,
        quantity: 1,
        isInside: true,
        manufactureDate: tag2Config.manufactureDate,
        expiryDate: tag2Config.expiryDate,
        status: calculateFoodStatus(tag2Config.expiryDate),
        addedAt: now,
        lastUpdated: now
      },
      { upsert: true, new: true }
    );

    const historyDoc = await FoodHistory.create({
      deviceId,
      foodName: tag2Config.foodName,
      rfidUid: tag2Config.rfidUid,
      action: 'ADDED',
      timestamp: now
    });
    foodEventsCreated.push(historyDoc);
  } else if (muttonTransition === 'REMOVED') {
    inventoryChanged = true;
    await FoodItem.findOneAndUpdate(
      { rfidUid: tag2Config.rfidUid },
      {
        quantity: 0,
        isInside: false,
        lastUpdated: now
      },
      { upsert: true }
    );

    const historyDoc = await FoodHistory.create({
      deviceId,
      foodName: tag2Config.foodName,
      rfidUid: tag2Config.rfidUid,
      action: 'REMOVED',
      timestamp: now
    });
    foodEventsCreated.push(historyDoc);
  }

  // 4. Update DeviceState in MongoDB Atlas (Persists single document per device)
  const isTempAlarm = typeof temperatureAlarm === 'boolean'
    ? temperatureAlarm
    : (temperature !== null && temperature !== undefined && temperature >= 8);

  const isHumAlarm = typeof humidityAlarm === 'boolean'
    ? humidityAlarm
    : (humidity !== null && humidity !== undefined && humidity >= 80);

  const updatedDevice = await DeviceState.findOneAndUpdate(
    { deviceId },
    {
      deviceId,
      temperature,
      humidity,
      gasValue,
      gasStatus,
      doorStatus,
      doorAlarm: Boolean(doorAlarm),
      gasAlarm: Boolean(gasAlarm),
      temperatureAlarm: isTempAlarm,
      humidityAlarm: isHumAlarm,
      beefQty,
      muttonQty,
      rtcTime,
      lastSeen: now
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 5. Broadcast real-time updates via Socket.IO
  if (io) {
    // A. Broadcast device telemetry
    io.emit('device', {
      ...updatedDevice.toObject(),
      isOnline: true
    });

    // B. If food state transitioned, broadcast new history item(s) and refreshed inventory
    if (foodEventsCreated.length > 0) {
      for (const event of foodEventsCreated) {
        io.emit('food', event);
      }
    }

    if (inventoryChanged) {
      const activeInventory = await getActiveInventory();
      io.emit('inventory', activeInventory);
    }
  }

  return {
    deviceState: updatedDevice,
    eventsCreated: foodEventsCreated.length,
    inventoryChanged
  };
};

/**
 * Helper to detect true binary transitions without spamming duplicate events.
 *
 * @param {number|null} prev - Previous quantity in database (or null on very first boot)
 * @param {number} curr - Current incoming quantity from telemetry
 * @returns {'ADDED' | 'REMOVED' | null}
 */
export const detectQuantityTransition = (prev, curr) => {
  if (prev === null) {
    if (curr > 0) return 'ADDED';
    return null;
  }

  if (prev === 0 && curr > 0) {
    return 'ADDED';
  }
  if (prev > 0 && curr === 0) {
    return 'REMOVED';
  }

  return null;
};

/**
 * Fetch current device status and determine real-time online/offline flag.
 */
export const getDeviceStatus = async (deviceId = 'freshguard-fridge-01') => {
  const state = await DeviceState.findOne({ deviceId });
  if (!state) {
    return {
      isOnline: false,
      data: null
    };
  }

  const timeSinceLastSeen = Date.now() - new Date(state.lastSeen).getTime();
  const isOnline = timeSinceLastSeen <= OFFLINE_TIMEOUT_MS;

  return {
    isOnline,
    timeSinceLastSeen,
    data: state
  };
};

/**
 * Fetch active food items inside the refrigerator with dynamically computed status.
 */
export const getActiveInventory = async () => {
  const items = await FoodItem.find({ isInside: true, quantity: { $gt: 0 } }).sort({ addedAt: -1 });
  const tag2Config = FOOD_RFID_CONFIG.Mutton;

  return items.map((item) => {
    const doc = item.toObject({ virtuals: true });
    // Safety guard to ensure Tag 2 displays as Juice with correct dates even if read prior to migration
    if (doc.rfidUid === tag2Config.rfidUid || doc.foodName === 'Chocolate' || doc.name === 'Chocolate') {
      doc.foodName = tag2Config.foodName;
      doc.name = tag2Config.name;
      doc.manufactureDate = tag2Config.manufactureDate;
      doc.expiryDate = tag2Config.expiryDate;
    }
    doc.status = calculateFoodStatus(doc.expiryDate);
    return doc;
  });
};

/**
 * Fetch food history records (chronological order, newest first).
 */
export const getFoodHistory = async (limit = 50) => {
  const history = await FoodHistory.find().sort({ timestamp: -1 }).limit(limit);
  const tag2Config = FOOD_RFID_CONFIG.Mutton;

  return history.map((doc) => {
    const item = doc.toObject();
    if (item.rfidUid === tag2Config.rfidUid || item.foodName === 'Chocolate') {
      item.foodName = tag2Config.foodName;
    }
    return item;
  });
};

/**
 * Automatically migrate legacy data (e.g. updating Tag 2 Chocolate -> Juice)
 * Ensures MongoDB Atlas records conform to final firmware specifications.
 */
export const syncLegacyFoodMappings = async () => {
  try {
    const tag2Config = FOOD_RFID_CONFIG.Mutton;
    const foodItemResult = await FoodItem.updateMany(
      {
        $or: [
          { rfidUid: tag2Config.rfidUid },
          { foodName: 'Chocolate' },
          { name: 'Chocolate' }
        ]
      },
      {
        $set: {
          foodName: tag2Config.foodName,
          name: tag2Config.name,
          rfidUid: tag2Config.rfidUid,
          manufactureDate: tag2Config.manufactureDate,
          expiryDate: tag2Config.expiryDate,
          status: calculateFoodStatus(tag2Config.expiryDate)
        }
      }
    );

    const historyResult = await FoodHistory.updateMany(
      {
        $or: [
          { rfidUid: tag2Config.rfidUid, foodName: 'Chocolate' },
          { foodName: 'Chocolate' }
        ]
      },
      {
        $set: {
          foodName: tag2Config.foodName,
          rfidUid: tag2Config.rfidUid
        }
      }
    );

    if (foodItemResult.modifiedCount > 0 || historyResult.modifiedCount > 0) {
      console.log(`🔄 [MIGRATION] Synchronized legacy Tag 2 records to Juice (Items: ${foodItemResult.modifiedCount}, History: ${historyResult.modifiedCount})`);
    }
  } catch (err) {
    console.warn('⚠️ [MIGRATION NOTE] Legacy mapping sync note:', err.message);
  }
};
