import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, ScrollText, PlusCircle, Cog, Users, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { signOutFn, getCurrentUserFn } from "@/lib/api.functions";
import { clearStoredSession, getStoredSession } from "@/lib/session";

const NAV = [
  { to: "/", label: "New", Icon: PlusCircle, exact: true, iconCls: "text-mod-new" },
  { to: "/orders", label: "Orders", Icon: ScrollText, exact: false, iconCls: "text-mod-orders" },
  {
    to: "/delivered",
    label: "Delivered",
    Icon: Truck,
    exact: false,
    iconCls: "text-mod-delivered",
  },
  { to: "/loom", label: "Loom", Icon: Cog, exact: false, iconCls: "text-mod-loom" },
  {
    to: "/attendance",
    label: "Attendance",
    Icon: Users,
    exact: false,
    iconCls: "text-mod-attendance",
  },
] as const;

export function AppHeader() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<{ email?: string; display_name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (session.userId || session.sessionId) {
      getCurrentUserFn({ data: session }).then((u) => {
        if (u) setUser(u);
      });
    }
  }, []);

  const handleSignOut = async () => {
    const { sessionId } = getStoredSession();
    clearStoredSession();
    await signOutFn({ data: { sessionId } });
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="group flex items-center gap-2 min-w-0">
          <motion.span
            whileHover={{ rotate: 90 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft"
          >
            <Cog className="h-4 w-4" />
          </motion.span>
          <span className="font-display text-lg font-bold text-primary truncate">
            SSVT Order Book
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, Icon, exact, iconCls }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-full bg-gradient-primary shadow-soft"
                  />
                )}
                <Icon className={`h-4 w-4 ${active ? "" : iconCls}`} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          {user?.email && (
            <div
              className="ml-1 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-xs"
              title={`Logged in as ${user.email}`}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || user.email}
                  className="h-4 w-4 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[140px] truncate text-[12px] font-medium text-foreground hidden sm:inline">
                {user.email}
              </span>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignOut}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </motion.button>
        </nav>
      </div>
    </header>
  );
}
