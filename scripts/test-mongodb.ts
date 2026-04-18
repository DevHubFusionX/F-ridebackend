import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

console.log(`🔍 Attempting to connect to: ${MONGODB_URI.split('@')[1] || 'URL'}`);

const testConnection = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ MongoDB connection successful!');
    
    // Perform a ping
    const admin = mongoose.connection.db?.admin();
    const result = await admin?.ping();
    console.log('🏓 Ping result:', result);
    
    await mongoose.disconnect();
    console.log('👋 Disconnected');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Connection failed:');
    if (error.code === 'ECONNREFUSED') {
      console.error('   Reason: ECONNREFUSED (Network closed or blocked)');
    } else if (error.name === 'MongoServerSelectionError') {
      console.error('   Reason: Server Selection Timeout (Check IP Whitelist in Atlas Dashboard)');
    } else {
      console.error(`   Error Name: ${error.name}`);
      console.error(`   Message: ${error.message}`);
    }
    
    console.log('\n💡 Suggested Fixes:');
    console.log('1. Go to MongoDB Atlas -> Network Access -> Add IP Address -> Add Current IP.');
    console.log('2. Check if your network/firewall blocks port 27017 or DNS SRV lookups.');
    console.log('3. Verify password in .env (if it contains special characters, use URL-encoding).');
    
    process.exit(1);
  }
};

testConnection();
