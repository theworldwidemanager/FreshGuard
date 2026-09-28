/**
 * Middleware: Verify Device API Key
 * Validates 'X-Device-Key' header from incoming ESP32 HTTP requests
 * against backend process.env.ESP32_API_KEY.
 */
export const verifyDeviceKey = (req, res, next) => {
  const expectedKey = process.env.ESP32_API_KEY;
  const providedKey = req.headers['x-device-key'] || req.headers['X-Device-Key'];

  if (!expectedKey) {
    console.error('❌ [SECURITY ERROR] ESP32_API_KEY environment variable is not defined on server!');
    return res.status(500).json({
      success: false,
      error: 'Server security misconfiguration: Device API key not configured in environment.'
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing X-Device-Key header.'
    });
  }

  next();
};

/**
 * Middleware: Validate ESP32 Telemetry Payload
 * Ensures incoming physical hardware values conform to expected types
 * and boundaries before touching database records.
 */
export const validateTelemetryPayload = (req, res, next) => {
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
  } = req.body;

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "deviceId" must be a non-empty string.'
    });
  }

  if (typeof gasValue !== 'number' || isNaN(gasValue)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "gasValue" must be a valid number.'
    });
  }

  const validGasStatuses = ['GOOD', 'MILD', 'WARNING'];
  if (!gasStatus || !validGasStatuses.includes(gasStatus)) {
    return res.status(400).json({
      success: false,
      error: `Invalid payload: "gasStatus" must be one of ${validGasStatuses.join(', ')}.`
    });
  }

  const validDoorStatuses = ['OPEN', 'CLOSED'];
  if (!doorStatus || !validDoorStatuses.includes(doorStatus)) {
    return res.status(400).json({
      success: false,
      error: `Invalid payload: "doorStatus" must be one of ${validDoorStatuses.join(', ')}.`
    });
  }

  // Coerce / normalize boolean-like values if needed
  if (typeof req.body.doorAlarm !== 'boolean') {
    if (req.body.doorAlarm === 1 || req.body.doorAlarm === 0 || req.body.doorAlarm === 'true' || req.body.doorAlarm === 'false') {
      req.body.doorAlarm = (req.body.doorAlarm === true || req.body.doorAlarm === 1 || req.body.doorAlarm === 'true');
    }
  }

  if (typeof req.body.gasAlarm !== 'boolean') {
    if (req.body.gasAlarm === 1 || req.body.gasAlarm === 0 || req.body.gasAlarm === 'true' || req.body.gasAlarm === 'false') {
      req.body.gasAlarm = (req.body.gasAlarm === true || req.body.gasAlarm === 1 || req.body.gasAlarm === 'true');
    }
  }

  if (typeof req.body.doorAlarm !== 'boolean' || typeof req.body.gasAlarm !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "doorAlarm" and "gasAlarm" must be booleans.'
    });
  }

  // Temperature and Humidity alarm fields (Optional for backward compatibility, validated if present)
  if (temperatureAlarm !== undefined && typeof req.body.temperatureAlarm !== 'boolean') {
    if (temperatureAlarm === 1 || temperatureAlarm === 0 || temperatureAlarm === 'true' || temperatureAlarm === 'false') {
      req.body.temperatureAlarm = (temperatureAlarm === true || temperatureAlarm === 1 || temperatureAlarm === 'true');
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: "temperatureAlarm" must be a boolean.'
      });
    }
  }

  if (humidityAlarm !== undefined && typeof req.body.humidityAlarm !== 'boolean') {
    if (humidityAlarm === 1 || humidityAlarm === 0 || humidityAlarm === 'true' || humidityAlarm === 'false') {
      req.body.humidityAlarm = (humidityAlarm === true || humidityAlarm === 1 || humidityAlarm === 'true');
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: "humidityAlarm" must be a boolean.'
      });
    }
  }

  if (typeof beefQty !== 'number' || typeof muttonQty !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "beefQty" and "muttonQty" must be numbers.'
    });
  }

  // Temperature & humidity can be valid numbers or null (if DHT sensor returns NaN locally)
  if (temperature !== null && temperature !== undefined && (typeof temperature !== 'number' || isNaN(temperature))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "temperature" must be a number or null.'
    });
  }

  if (humidity !== null && humidity !== undefined && (typeof humidity !== 'number' || isNaN(humidity))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: "humidity" must be a number or null.'
    });
  }

  next();
};
