import { getMongoDb } from "./client";
import type { Worker, Attendance, Loom, Order, ChatMessage, Profile, UserRole } from "./types";

// In-memory fallback stores when MongoDB is unreachable
const memoryStore = {
  workers: new Map<string, Worker>(),
  attendance: new Map<string, Attendance>(),
  looms: new Map<string, Loom>(),
  orders: new Map<string, Order>(),
  chatMessages: new Map<string, ChatMessage>(),
  profiles: new Map<string, Profile>(),
  userRoles: new Map<string, UserRole>(),
};

async function safeDbCall<T>(
  mongoFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T,
): Promise<T> {
  try {
    return await mongoFn();
  } catch (err) {
    console.warn(
      "MongoDB connection warning, using fallback store:",
      err instanceof Error ? err.message : err,
    );
    return await fallbackFn();
  }
}

export const db = {
  // Workers
  workers: {
    async findAll(userId: string): Promise<Worker[]> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db
            .collection<Worker>("workers")
            .find({ user_id: userId })
            .sort({ name: 1 })
            .toArray();
        },
        () =>
          Array.from(memoryStore.workers.values())
            .filter((w) => w.user_id === userId)
            .sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
    async findById(id: string): Promise<Worker | null> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db.collection<Worker>("workers").findOne({ _id: id });
        },
        () => memoryStore.workers.get(id) ?? null,
      );
    },
    async create(data: Omit<Worker, "_id" | "created_at" | "updated_at">): Promise<Worker> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now, updated_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Worker>("workers").insertOne(doc);
          memoryStore.workers.set(doc._id, doc);
          return doc;
        },
        () => {
          memoryStore.workers.set(doc._id, doc);
          return doc;
        },
      );
    },
    async update(id: string, data: Partial<Omit<Worker, "_id" | "created_at">>): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db
            .collection<Worker>("workers")
            .updateOne({ _id: id }, { $set: { ...data, updated_at: new Date().toISOString() } });
          const existing = memoryStore.workers.get(id);
          if (existing)
            memoryStore.workers.set(id, {
              ...existing,
              ...data,
              updated_at: new Date().toISOString(),
            });
        },
        () => {
          const existing = memoryStore.workers.get(id);
          if (existing)
            memoryStore.workers.set(id, {
              ...existing,
              ...data,
              updated_at: new Date().toISOString(),
            });
        },
      );
    },
    async delete(id: string): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Worker>("workers").deleteOne({ _id: id });
          memoryStore.workers.delete(id);
        },
        () => {
          memoryStore.workers.delete(id);
        },
      );
    },
  },

  // Attendance
  attendance: {
    async findAll(userId: string): Promise<Attendance[]> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db
            .collection<Attendance>("attendance")
            .find({ user_id: userId })
            .sort({ date: -1 })
            .toArray();
        },
        () =>
          Array.from(memoryStore.attendance.values())
            .filter((a) => a.user_id === userId)
            .sort((a, b) => b.date.localeCompare(a.date)),
      );
    },
    async create(data: Omit<Attendance, "_id" | "created_at" | "updated_at">): Promise<Attendance> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now, updated_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Attendance>("attendance").insertOne(doc);
          memoryStore.attendance.set(doc._id, doc);
          return doc;
        },
        () => {
          memoryStore.attendance.set(doc._id, doc);
          return doc;
        },
      );
    },
    async delete(id: string): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Attendance>("attendance").deleteOne({ _id: id });
          memoryStore.attendance.delete(id);
        },
        () => {
          memoryStore.attendance.delete(id);
        },
      );
    },
  },

  // Looms
  looms: {
    async findAll(userId: string): Promise<Loom[]> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db
            .collection<Loom>("looms")
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();
        },
        () =>
          Array.from(memoryStore.looms.values())
            .filter((l) => l.user_id === userId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
    },
    async create(data: Omit<Loom, "_id" | "created_at" | "updated_at">): Promise<Loom> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now, updated_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Loom>("looms").insertOne(doc);
          memoryStore.looms.set(doc._id, doc);
          return doc;
        },
        () => {
          memoryStore.looms.set(doc._id, doc);
          return doc;
        },
      );
    },
  },

  // Orders
  orders: {
    async findAll(userId: string): Promise<Order[]> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db
            .collection<Order>("orders")
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .toArray();
        },
        () =>
          Array.from(memoryStore.orders.values())
            .filter((o) => o.user_id === userId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
    },
    async findLatest(userId: string): Promise<Order | null> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          const orders = await db
            .collection<Order>("orders")
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();
          return orders[0] || null;
        },
        () => {
          const list = Array.from(memoryStore.orders.values())
            .filter((o) => o.user_id === userId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          return list[0] || null;
        },
      );
    },
    async create(data: Omit<Order, "_id" | "created_at" | "updated_at">): Promise<Order> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now, updated_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Order>("orders").insertOne(doc);
          memoryStore.orders.set(doc._id, doc);
          return doc;
        },
        () => {
          memoryStore.orders.set(doc._id, doc);
          return doc;
        },
      );
    },
    async update(id: string, data: Partial<Omit<Order, "_id" | "created_at">>): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db
            .collection<Order>("orders")
            .updateOne({ _id: id }, { $set: { ...data, updated_at: new Date().toISOString() } });
          const existing = memoryStore.orders.get(id);
          if (existing)
            memoryStore.orders.set(id, {
              ...existing,
              ...data,
              updated_at: new Date().toISOString(),
            });
        },
        () => {
          const existing = memoryStore.orders.get(id);
          if (existing)
            memoryStore.orders.set(id, {
              ...existing,
              ...data,
              updated_at: new Date().toISOString(),
            });
        },
      );
    },
    async delete(id: string): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Order>("orders").deleteOne({ _id: id });
          memoryStore.orders.delete(id);
        },
        () => {
          memoryStore.orders.delete(id);
        },
      );
    },
  },

  // Chat Messages
  chatMessages: {
    async findAll(userId: string): Promise<ChatMessage[]> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db
            .collection<ChatMessage>("chat_messages")
            .find({ user_id: userId })
            .sort({ created_at: 1 })
            .toArray();
        },
        () =>
          Array.from(memoryStore.chatMessages.values())
            .filter((c) => c.user_id === userId)
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
    },
    async create(data: Omit<ChatMessage, "_id" | "created_at">): Promise<ChatMessage> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<ChatMessage>("chat_messages").insertOne(doc);
          memoryStore.chatMessages.set(doc._id, doc);
          return doc;
        },
        () => {
          memoryStore.chatMessages.set(doc._id, doc);
          return doc;
        },
      );
    },
    async deleteByUserId(userId: string): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<ChatMessage>("chat_messages").deleteMany({ user_id: userId });
          for (const [id, msg] of memoryStore.chatMessages.entries()) {
            if (msg.user_id === userId) memoryStore.chatMessages.delete(id);
          }
        },
        () => {
          for (const [id, msg] of memoryStore.chatMessages.entries()) {
            if (msg.user_id === userId) memoryStore.chatMessages.delete(id);
          }
        },
      );
    },
  },

  // Profiles
  profiles: {
    async findById(id: string): Promise<Profile | null> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db.collection<Profile>("profiles").findOne({ _id: id });
        },
        () => memoryStore.profiles.get(id) ?? null,
      );
    },
    async create(data: Omit<Profile, "_id" | "created_at"> & { _id?: string }): Promise<Profile> {
      const now = new Date().toISOString();
      const id = data._id || crypto.randomUUID();
      const doc: Profile = { ...data, _id: id, created_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Profile>("profiles").replaceOne({ _id: id }, doc, { upsert: true });
          memoryStore.profiles.set(id, doc);
          return doc;
        },
        () => {
          memoryStore.profiles.set(id, doc);
          return doc;
        },
      );
    },
    async update(id: string, data: Partial<Omit<Profile, "_id" | "created_at">>): Promise<void> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<Profile>("profiles").updateOne({ _id: id }, { $set: data });
          const existing = memoryStore.profiles.get(id);
          if (existing) {
            memoryStore.profiles.set(id, { ...existing, ...data });
          }
        },
        () => {
          const existing = memoryStore.profiles.get(id);
          if (existing) {
            memoryStore.profiles.set(id, { ...existing, ...data });
          }
        },
      );
    },
  },

  // User Roles
  userRoles: {
    async findByUserId(userId: string): Promise<UserRole | null> {
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          return db.collection<UserRole>("user_roles").findOne({ user_id: userId });
        },
        () => memoryStore.userRoles.get(userId) ?? null,
      );
    },
    async create(data: Omit<UserRole, "_id" | "created_at">): Promise<UserRole> {
      const now = new Date().toISOString();
      const doc = { ...data, _id: crypto.randomUUID(), created_at: now };
      return safeDbCall(
        async () => {
          const db = await getMongoDb();
          await db.collection<UserRole>("user_roles").insertOne(doc);
          memoryStore.userRoles.set(data.user_id, doc);
          return doc;
        },
        () => {
          memoryStore.userRoles.set(data.user_id, doc);
          return doc;
        },
      );
    },
  },
};
