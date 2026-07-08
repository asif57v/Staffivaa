import { MongoClient } from 'mongodb';

const sourceUrl = "mongodb+srv://sagarchouhan7609_db_user:sagarchouhan7609_db_user@cluster0.od9npjt.mongodb.net/hoomzo";
const destUrl = "mongodb+srv://asifmansoori076_db_user:SwVg7mPc5p6NIZGB@homezoo.384oaoi.mongodb.net/HomeZoo";

async function run() {
  console.log("Connecting to source database...");
  const sourceClient = new MongoClient(sourceUrl);
  await sourceClient.connect();
  const sourceDb = sourceClient.db();
  console.log("Connected to source database: " + sourceDb.databaseName);

  console.log("Connecting to destination database...");
  const destClient = new MongoClient(destUrl);
  await destClient.connect();
  const destDb = destClient.db();
  console.log("Connected to destination database: " + destDb.databaseName);

  try {
    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source.`);
    
    for (const colInfo of collections) {
      if (colInfo.type === "view") {
         console.log(`Skipping view ${colInfo.name}`);
         continue;
      }
      const colName = colInfo.name;
      console.log(`\nProcessing collection: ${colName}`);
      
      const sourceCol = sourceDb.collection(colName);
      const destCol = destDb.collection(colName);
      
      const docs = await sourceCol.find({}).toArray();
      console.log(`Found ${docs.length} documents in ${colName}`);
      
      if (docs.length > 0) {
        try {
          const result = await destCol.insertMany(docs, { ordered: false });
          console.log(`Successfully inserted ${result.insertedCount} documents into ${colName}`);
        } catch (err) {
          if (err.writeErrors) {
             console.log(`Inserted ${err.result?.insertedCount || (docs.length - err.writeErrors.length)} documents. Ignored ${err.writeErrors.length} duplicates or errors.`);
          } else {
             console.error(`Error inserting into ${colName}:`, err.message);
          }
        }
      } else {
        console.log(`No documents to insert for ${colName}`);
      }
    }
    
    console.log("\nMigration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

run().catch(console.error);
