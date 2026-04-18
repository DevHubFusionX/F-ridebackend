import mongoose from 'mongoose';

const uri = process.argv[2] || process.env.MONGODB_URI;

if (!uri) {
  console.error('Missing MongoDB URI. Pass it as an argument or set MONGODB_URI.');
  process.exit(1);
}

async function run() {
  const startedAt = Date.now();
      
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 15000,
    });

    await conn.connection.db.admin().ping();

    const elapsed = Date.now() - startedAt;
    console.log(`MongoDB connection test passed in ${elapsed}ms`);
    console.log(`Connected host: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
