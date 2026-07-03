import 'dotenv/config';
import mongoose from 'mongoose';

const { MongoClient } = mongoose.mongo;

const SOURCE_URI = 'mongodb+srv://asifmansoori076_db_user:8hzgmYsiu3u5rfsJ@clusterstffivaa.lfmjb5q.mongodb.net/staffivaa?appName=Clusterstffivaa';
const DEST_URI = 'mongodb+srv://Stafffivaa:Staffivaa_RajbalaGroup@cluster0.ouvtyzu.mongodb.net/Staffivaa';

async function migrate() {
  console.log('Connecting to Source and Destination databases...');
  const sourceClient = new MongoClient(SOURCE_URI);
  const destClient = new MongoClient(DEST_URI);

  try {
    await sourceClient.connect();
    await destClient.connect();
    console.log('Connected successfully to both databases.');

    const sourceDb = sourceClient.db();
    const destDb = destClient.db();

    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source database.`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) {
        continue;
      }

      console.log(`\n--- Processing Collection: "${colName}" ---`);

      const sourceCol = sourceDb.collection(colName);
      const destCol = destDb.collection(colName);

      const docCount = await sourceCol.countDocuments();
      console.log(`Source documents: ${docCount}`);

      // Clear existing destination collection
      console.log(`Clearing existing data in destination collection "${colName}"...`);
      await destCol.deleteMany({});

      if (docCount > 0) {
        console.log(`Fetching all documents from source...`);
        const docs = await sourceCol.find({}).toArray();

        console.log(`Writing documents to destination...`);
        const chunkSize = 500;
        for (let i = 0; i < docs.length; i += chunkSize) {
          const chunk = docs.slice(i, i + chunkSize);
          await destCol.insertMany(chunk);
          console.log(`  Inserted chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(docs.length / chunkSize)}`);
        }
        console.log(`Copied ${docs.length} documents.`);
      } else {
        console.log(`Skipped document copying (0 documents).`);
      }

      // Recreate indexes
      console.log(`Fetching indexes from source...`);
      try {
        const indexes = await sourceCol.indexes();
        console.log(`Found ${indexes.length} indexes.`);
        for (const index of indexes) {
          if (index.name === '_id_') continue;

          const { key, name, ...options } = index;
          console.log(`Recreating index: ${name}`);
          await destCol.createIndex(key, { name, ...options });
        }
      } catch (idxErr) {
        console.error(`Error processing indexes for "${colName}":`, idxErr.message);
      }
    }

    console.log('\n=============================================');
    console.log('Data migration and index replication complete!');
    console.log('=============================================');
  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    await sourceClient.close();
    await destClient.close();
    console.log('Database connections closed.');
  }
}

migrate();
