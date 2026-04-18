import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  if (process.env.PERF_SKIP_DB === 'true') {
    console.log('MongoDB connection skipped (PERF_SKIP_DB=true)');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://fanyanwu83_db_user:rRzpGoSPFwnsBMIq@cluster0.b1ils8q.mongodb.net/?appName=Cluster0', {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export default connectDB;
