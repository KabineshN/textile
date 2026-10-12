export function getStoredSession(): { userId: string | null; sessionId: string | null } {
  if (typeof window === "undefined") return { userId: null, sessionId: null };
  return {
    userId: localStorage.getItem("user_id"),
    sessionId: localStorage.getItem("session_id"),
  };
}

export function setStoredSession(userId: string, sessionId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("user_id", userId);
    localStorage.setItem("session_id", sessionId);
  }
}

export function clearStoredSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user_id");
    localStorage.removeItem("session_id");
  }
}
