import mongoose from 'mongoose';

const foodHistorySchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    foodName: {
      type: String,
      required: true,
      trim: true
    },
    rfidUid: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      enum: ['ADDED', 'REMOVED']
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const FoodHistory = mongoose.model('FoodHistory', foodHistorySchema);
export default FoodHistory;
