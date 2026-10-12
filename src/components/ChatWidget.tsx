import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, Send, Trash2, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getChatHistory, sendChatMessage, clearChatHistory } from "@/lib/chat.functions";
import { getStoredSession } from "@/lib/session";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many orders this month?",
  "How do I add a worker?",
  "Show total working hours",
  "தமிழில் உதவி வேண்டும்",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadHistory = useServerFn(getChatHistory);
  const send = useServerFn(sendChatMessage);
  const clear = useServerFn(clearChatHistory);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    const session = getStoredSession();
    loadHistory({ data: session })
      .then((rows) => {
        if (cancelled) return;
        setMessages((prev) =>
          prev.length > 0
            ? prev
            : (rows || []).map((r) => ({ id: r.id, role: r.role, content: r.content })),
        );

        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [open, loaded, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const submit = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const session = getStoredSession();
      const res = await send({ data: { message, ...session } });
      if (res && res.reply) {
        setMessages((m) => [
          ...m,
          { id: `bot-${Date.now()}`, role: "assistant", content: res.reply },
        ]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the assistant.");
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClear = async () => {
    try {
      const session = getStoredSession();
      await clear({ data: session });
      setMessages([]);
    } catch {
      toast.error("Could not clear the conversation.");
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-soft shadow-lg"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "x" : "chat"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-5 z-50 flex h-[560px] max-h-[calc(100vh-8rem)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold">Loom Assistant</p>
                  <p className="truncate text-[11px] opacity-80">Orders • Looms • Attendance</p>
                </div>
              </div>
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Hi! Ask me about orders, looms, workers, attendance, salary or how to use any
                    module. English / தமிழ் / हिंदी.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => submit(s)}
                        className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-gradient-primary text-primary-foreground"
                        : "rounded-bl-sm border border-border/60 bg-secondary/60 text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert [&_li]:my-0.5 [&_p]:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </motion.div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border/60 bg-secondary/60 px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="flex items-end gap-2 border-t border-border/60 p-3"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask about orders, looms, attendance…"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
              />
              <motion.button
                type="submit"
                disabled={busy || !input.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
