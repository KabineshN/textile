import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    const mongoClient = new MongoClient(MONGODB_URI, {
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
