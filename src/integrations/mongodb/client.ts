import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable. Please configure it in your deployment environment variables.");
  }

  if (!client) {
    const mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    try {
      await mongoClient.connect();
      client = mongoClient;
    } catch (err) {
      client = null;
      throw err;
    }
  }
  return client;
}

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    const client = await getMongoClient();
    db = client.db("textile_order_hub");
  }
  return db;
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
