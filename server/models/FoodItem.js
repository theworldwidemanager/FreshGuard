import mongoose from 'mongoose';

/**
 * Calculates food freshness based on the expiry date.
 * If current time is on or before end-of-day of expiry date => 'FRESH'
 * If current time is after expiry date => 'EXPIRED'
 *
 * @param {Date|string|null} expiryDate
 * @returns {'FRESH' | 'EXPIRED'}
 */
export const calculateFoodStatus = (expiryDate) => {
  if (!expiryDate) return 'FRESH';
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return 'FRESH';

  // Set boundary to the end of the expiration day (23:59:59.999) if no specific time was stored
  const endOfDay = new Date(expiry);
  if (endOfDay.getHours() === 0 && endOfDay.getMinutes() === 0 && endOfDay.getSeconds() === 0) {
    endOfDay.setHours(23, 59, 59, 999);
  }

  return now.getTime() > endOfDay.getTime() ? 'EXPIRED' : 'FRESH';
};

const foodItemSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      trim: true
    },
    rfidUid: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    isInside: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    manufactureDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['FRESH', 'EXPIRED'],
      default: 'FRESH'
    },
    addedAt: {
      type: Date,
      default: null
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual property to calculate real-time freshness dynamically
foodItemSchema.virtual('calculatedStatus').get(function () {
  return calculateFoodStatus(this.expiryDate);
});

// Middleware to keep foodName and status synchronized
foodItemSchema.pre('save', function (next) {
  if (!this.foodName && this.name) {
    this.foodName = this.name;
  }
  if (!this.name && this.foodName) {
    this.name = this.foodName;
  }
  this.status = calculateFoodStatus(this.expiryDate);
  next();
});

export const FoodItem = mongoose.model('FoodItem', foodItemSchema);
export default FoodItem;
