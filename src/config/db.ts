import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  if (process.env.PERF_SKIP_DB === 'true') {
    console.log('[DB] MongoDB connection skipped (PERF_SKIP_DB=true)');
    return;
  }

  const uri = process.env.MONGODB_URI || 'mongodb+srv://fanyanwu83_db_user:rRzpGoSPFwnsBMIq@cluster0.b1ils8q.mongodb.net/?appName=Cluster0';
  console.log(`[DB] Connecting to MongoDB...`);

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`[DB] ✓ Connected to: ${conn.connection.host}`);
    console.log(`[DB] Database name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`[DB] ✗ Connection failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export default connectDB;
