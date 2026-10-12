import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUserFn, hasRoleFn, signOutFn } from "@/lib/api.functions";
import { getStoredSession, clearStoredSession } from "@/lib/session";
import { ChatWidget } from "@/components/ChatWidget";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = getStoredSession();
    const user = await getCurrentUserFn({ data: session });
    if (!user) {
      clearStoredSession();
      throw redirect({ to: "/auth" });
    }

    // Check admin role
    const isAdmin = await hasRoleFn({ data: { userId: user.id, role: "admin" } });
    if (!isAdmin) {
      clearStoredSession();
      await signOutFn({ data: { sessionId: session.sessionId } });
      throw redirect({
        to: "/auth",
        search: { error: "not_admin" },
      });
    }

    return { user };
  },
  component: () => (
    <>
      <Outlet />
      <ChatWidget />
      <Toaster />
    </>
  ),
});
