import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('YOUR_ATLAS_USER')) {
    console.warn('\n⚠️ [DATABASE WARNING] MONGODB_URI is not configured in .env');
    console.warn('   FreshGuard requires a valid MongoDB Atlas connection string.');
    console.warn('   Please follow README instructions to create your MongoDB Atlas cluster.\n');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ [DATABASE] Connected to MongoDB Atlas: ${conn.connection.host} (${conn.connection.name})`);
    return true;
  } catch (error) {
    isConnected = false;
    console.error(`❌ [DATABASE ERROR] Connection failed: ${error.message}`);
    console.error('   Verify IP Whitelist (0.0.0.0/0), credentials, and cluster status in MongoDB Atlas.');
    return false;
  }
};

export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    isConnected: mongoose.connection.readyState === 1
  };
};

export default connectDB;
