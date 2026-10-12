import { createServerFn } from "@tanstack/react-start";
import { db } from "@/integrations/mongodb/db";
import { getCurrentUser } from "@/integrations/mongodb/auth";

export const getChatHistory = createServerFn({ method: "POST" })
  .validator((data: { userId?: string | null; sessionId?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) throw new Error("Not authenticated");
    const messages = await db.chatMessages.findAll(user.id);
    return messages.map((m) => ({
      id: m._id,
      role: m.role as "user" | "assistant",
      content: m.content,
      created_at: m.created_at,
    }));
  });

export const clearChatHistory = createServerFn({ method: "POST" })
  .validator((data: { userId?: string | null; sessionId?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const user = await getCurrentUser(data?.userId, data?.sessionId);
    if (!user) throw new Error("Not authenticated");
    await db.chatMessages.deleteByUserId(user.id);
    return { ok: true };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .validator(
    (data: { message: string; userId?: string | null; sessionId?: string | null }) => {
      const message = (data?.message ?? "").trim();
      if (!message) throw new Error("Message is empty.");
      if (message.length > 2000) throw new Error("Message is too long.");
      return { message, userId: data?.userId, sessionId: data?.sessionId };
    },
  )
  .handler(async ({ data }) => {
    const { getSystemPrompt, buildSystemData, callGateway } = await import(
      "./chat-support.server"
    );
    const user = await getCurrentUser(data.userId, data.sessionId);
    if (!user) throw new Error("Not authenticated");

    const historyRows = await db.chatMessages.findAll(user.id);
    const history = historyRows.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const systemData = await buildSystemData(data.userId, data.sessionId);

    const input = [
      { role: "system", content: [{ type: "input_text", text: getSystemPrompt() }] },
      {
        role: "system",
        content: [{ type: "input_text", text: `SYSTEM DATA (latest):\n${systemData}` }],
      },
      ...history.map((m) => ({
        role: m.role,
        content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
      })),
      { role: "user", content: [{ type: "input_text", text: data.message }] },
    ];

    let reply = "";
    try {
      reply = await callGateway(input, systemData, data.message);
    } catch (e) {
      console.warn("callGateway failed, falling back to local responder:", e);
      const { generateFallbackResponse } = await import("./chat-support.server");
      reply = generateFallbackResponse(data.message, systemData);
    }

    if (!reply) {
      const { generateFallbackResponse } = await import("./chat-support.server");
      reply = generateFallbackResponse(data.message, systemData);
    }

    await db.chatMessages.create({ user_id: user.id, role: "user", content: data.message });
    await db.chatMessages.create({ user_id: user.id, role: "assistant", content: reply });

    return { reply };
  });
