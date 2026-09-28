import mongoose from 'mongoose';

const deviceStateSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    temperature: {
      type: Number,
      default: null
    },
    humidity: {
      type: Number,
      default: null
    },
    gasValue: {
      type: Number,
      required: true
    },
    gasStatus: {
      type: String,
      enum: ['GOOD', 'MILD', 'WARNING'],
      default: 'GOOD'
    },
    doorStatus: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'CLOSED'
    },
    doorAlarm: {
      type: Boolean,
      default: false
    },
    gasAlarm: {
      type: Boolean,
      default: false
    },
    temperatureAlarm: {
      type: Boolean,
      default: false
    },
    humidityAlarm: {
      type: Boolean,
      default: false
    },
    beefQty: {
      type: Number,
      default: 0
    },
    muttonQty: {
      type: Number,
      default: 0
    },
    rtcTime: {
      type: String,
      default: '--:--'
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const DeviceState = mongoose.model('DeviceState', deviceStateSchema);
export default DeviceState;
