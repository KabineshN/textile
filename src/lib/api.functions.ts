import { createServerFn } from "@tanstack/react-start";
import { db } from "@/integrations/mongodb/db";
import { getCurrentUser, signIn, googleSignIn, signOut, hasRole } from "@/integrations/mongodb/auth";
import type { AppRole, Worker, Attendance, Loom, Order } from "@/integrations/mongodb/types";

type UserSessionPayload = {
  userId?: string | null;
  sessionId?: string | null;
};

// ==================== AUTH FUNCTIONS ====================

export const getCurrentUserFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    return await getCurrentUser(data?.userId, data?.sessionId);
  });

export const signInFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => {
    const email = (data?.email ?? "").trim();
    const password = data?.password ?? "";
    if (!email) throw new Error("Please enter your email or username");
    if (!password) throw new Error("Please enter your password");
    return { email, password };
  })
  .handler(async ({ data }) => {
    return await signIn(data.email, data.password);
  });

export const googleSignInFn = createServerFn({ method: "POST" })
  .validator((data: { accessToken: string }) => {
    const accessToken = data?.accessToken?.trim();
    if (!accessToken) throw new Error("Missing Google access token");
    return { accessToken };
  })
  .handler(async ({ data }) => {
    return await googleSignIn(data.accessToken);
  });

export const signOutFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    await signOut(data?.sessionId);
    return { ok: true };
  });

export const hasRoleFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    return await hasRole(data.userId, data.role);
  });

// ==================== ORDERS FUNCTIONS ====================

export const getOrdersFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) return [];
    return await db.orders.findAll(user.id);
  });

export const getLatestOrderFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) return null;
    return await db.orders.findLatest(user.id);
  });

export const createOrderFn = createServerFn({ method: "POST" })
  .validator((data: Omit<Order, "_id" | "created_at" | "updated_at">) => data)
  .handler(async ({ data }) => {
    return await db.orders.create(data);
  });

export const updateOrderFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; data: Partial<Omit<Order, "_id" | "created_at">> }) => data)
  .handler(async ({ data }) => {
    await db.orders.update(data.id, data.data);
    return { ok: true };
  });

export const deleteOrderFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.orders.delete(data.id);
    return { ok: true };
  });

// ==================== LOOMS FUNCTIONS ====================

export const getLoomsFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) return [];
    return await db.looms.findAll(user.id);
  });

export const createLoomFn = createServerFn({ method: "POST" })
  .validator((data: Omit<Loom, "_id" | "created_at" | "updated_at">) => data)
  .handler(async ({ data }) => {
    return await db.looms.create(data);
  });

// ==================== WORKERS FUNCTIONS ====================

export const getWorkersFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) return [];
    return await db.workers.findAll(user.id);
  });

export const createWorkerFn = createServerFn({ method: "POST" })
  .validator((data: Omit<Worker, "_id" | "created_at" | "updated_at">) => data)
  .handler(async ({ data }) => {
    return await db.workers.create(data);
  });

export const updateWorkerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; data: Partial<Omit<Worker, "_id" | "created_at">> }) => data)
  .handler(async ({ data }) => {
    await db.workers.update(data.id, data.data);
    return { ok: true };
  });

export const deleteWorkerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.workers.delete(data.id);
    return { ok: true };
  });

// ==================== ATTENDANCE FUNCTIONS ====================

export const getAttendanceFn = createServerFn({ method: "POST" })
  .validator((data: UserSessionPayload | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) return [];
    return await db.attendance.findAll(user.id);
  });

export const createAttendanceFn = createServerFn({ method: "POST" })
  .validator((data: Omit<Attendance, "_id" | "created_at" | "updated_at">) => data)
  .handler(async ({ data }) => {
    return await db.attendance.create(data);
  });

export const deleteAttendanceFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.attendance.delete(data.id);
    return { ok: true };
  });
