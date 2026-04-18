import dns from 'dns';
import mongoose from 'mongoose';

// Monkey-patch DNS for environments with restricted/broken SRV resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = process.argv[2] || 'mongodb+srv://fanyanwu83:rRzpGoSPFwnsBMIq@cluster0.dkrivan.mongodb.net/?appName=Cluster0';

async function run() {
  console.log(`Connecting to: ${uri.replace(/:([^@]+)@/, ':****@')}`);
  const startedAt = Date.now();

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 30000,
    });

    await conn.connection.db.admin().ping();

    const elapsed = Date.now() - startedAt;
    console.log(`\n✅ MongoDB connection test passed in ${elapsed}ms`);
    console.log(`Connected host: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    // Check if we can list collections to verify permissions
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`Collections found: ${collections.length}`);
    
  } catch (error) {
    console.error(`\n❌ MongoDB connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error.stack) {
        // console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
