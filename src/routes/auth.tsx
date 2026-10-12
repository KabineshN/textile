import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Check, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { getCurrentUserFn, signInFn, googleSignInFn, signOutFn, hasRoleFn } from "@/lib/api.functions";
import { getStoredSession, setStoredSession, clearStoredSession } from "@/lib/session";
import authBg from "@/assets/bg-loom-white.jpg.asset.json";

const searchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Admin Sign In — Sri Sakthi Vinayaka Tex" },
      {
        name: "description",
        content: "Secure admin sign-in for the Sri Sakthi Vinayaka Tex order book.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function validateCredentials(identifier: string, pass: string): string | null {
  const trimmed = (identifier || "").trim();
  if (!trimmed) {
    return "Please enter your email or username.";
  }

  if (trimmed.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return "Please enter a valid email address.";
    }
  } else {
    if (trimmed.length < 3) {
      return "Username must be at least 3 characters.";
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return "Username can only contain letters, numbers, dots, hyphens, and underscores.";
    }
  }

  if (!pass) {
    return "Please enter your password.";
  }

  if (pass.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (pass.length > 72) {
    return "Password must not exceed 72 characters.";
  }

  return null;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (search.error === "not_admin") {
      setError("This account is not authorised. Contact the shop administrator.");
    }
  }, [search.error]);

  // Redirect if already signed in as admin
  useEffect(() => {
    const session = getStoredSession();
    if (!session.userId && !session.sessionId) return;
    getCurrentUserFn({ data: session }).then(async (user) => {
      if (!user) return;
      const isAdmin = await hasRoleFn({ data: { userId: user.id, role: "admin" } });
      if (isAdmin) {
        navigate({ to: "/" });
      }
    });
  }, [navigate]);

  // Handle Google OAuth callback redirect if access_token or error is present in URL hash or query
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;
    const search = window.location.search.startsWith("?")
      ? window.location.search.substring(1)
      : window.location.search;

    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");
    const stateParam = hashParams.get("state") || searchParams.get("state");

    if (errorParam) {
      const isCancelled =
        errorParam === "access_denied" ||
        errorParam === "user_cancelled" ||
        errorParam === "immediate_failed";
      setError(
        isCancelled
          ? "Google sign-in was cancelled."
          : errorDesc || "Google sign-in was not completed.",
      );
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    if (accessToken) {
      // Validate CSRF state if one was stored during redirect initiation
      const expectedState = sessionStorage.getItem("google_oauth_state");
      if (expectedState && stateParam && stateParam !== expectedState) {
        setError("Security validation failed (OAuth state mismatch). Please try again.");
        sessionStorage.removeItem("google_oauth_state");
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
      sessionStorage.removeItem("google_oauth_state");

      setLoading(true);
      window.history.replaceState(null, "", window.location.pathname);

      googleSignInFn({ data: { accessToken } })
        .then(async (res) => {
          if (res && res.user) {
            setStoredSession(res.user.id, res.sessionId);
            const isAdmin = await hasRoleFn({ data: { userId: res.user.id, role: "admin" } });
            if (!isAdmin) {
              clearStoredSession();
              await signOutFn({ data: { sessionId: res.sessionId } });
              setError("This account is not authorised. Contact the shop administrator.");
              return;
            }
            setSuccess(true);
            setTimeout(() => navigate({ to: "/" }), 900);
          } else {
            setError("Google sign-in failed. Please try again.");
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Google authentication failed.");
        })
        .finally(() => setLoading(false));
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (mode === "signup") {
        const res = await signInFn({ data: { email: trimmedEmail, password } });
        if (!res || !res.user) {
          throw new Error("Unable to create account. Please try again.");
        }
        setInfo("Account created. You can now sign in.");
        setMode("signin");
      } else {
        const res = await signInFn({
          data: { email: trimmedEmail, password },
        });
        if (!res || !res.user) {
          throw new Error("Invalid email/username or password. Please check your credentials.");
        }
        setStoredSession(res.user.id, res.sessionId);
        const isAdmin = await hasRoleFn({ data: { userId: res.user.id, role: "admin" } });
        if (!isAdmin) {
          clearStoredSession();
          await signOutFn({ data: { sessionId: res.sessionId } });
          setError("This account is not authorised. Contact the shop administrator.");
          return;
        }
        setSuccess(true);
        setTimeout(() => navigate({ to: "/" }), 900);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid sign-in details. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);

    const googleClientId =
      ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "").trim();

    if (!googleClientId) {
      setLoading(false);
      setError(
        "Google sign-in is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.",
      );
      return;
    }

    // Generate CSRF state token for security
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem("google_oauth_state", state);

    const redirectUri = `${window.location.origin}/auth`;

    // 1. Try Google Identity Services (GIS) token client popup first
    try {
      if (typeof window !== "undefined" && !(window as any).google?.accounts?.oauth2) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google Sign-In library"));
          document.head.appendChild(script);
        });
      }

      if ((window as any).google?.accounts?.oauth2) {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "openid email profile",
          prompt: "select_account",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              const isCancelled =
                tokenResponse.error === "popup_closed_by_user" ||
                tokenResponse.error === "access_denied" ||
                tokenResponse.error === "user_cancelled";
              setError(
                isCancelled
                  ? "Google sign-in was cancelled."
                  : tokenResponse.error_description ||
                      tokenResponse.error ||
                      "Google sign-in was cancelled.",
              );
              setLoading(false);
              return;
            }

            if (tokenResponse.access_token) {
              try {
                const res = await googleSignInFn({
                  data: { accessToken: tokenResponse.access_token },
                });
                if (res && res.user) {
                  setStoredSession(res.user.id, res.sessionId);
                  const isAdmin = await hasRoleFn({ data: { userId: res.user.id, role: "admin" } });
                  if (!isAdmin) {
                    clearStoredSession();
                    await signOutFn({ data: { sessionId: res.sessionId } });
                    setError("This account is not authorised. Contact the shop administrator.");
                    setLoading(false);
                    return;
                  }
                  setSuccess(true);
                  setTimeout(() => navigate({ to: "/" }), 900);
                  return;
                }
                setError("Google sign-in failed. Please try again.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Google authentication failed.");
              } finally {
                setLoading(false);
              }
            } else {
              setLoading(false);
              setError("No authorization token received from Google.");
            }
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      }
    } catch (gisErr) {
      console.warn("GIS popup init notice, falling back to redirect flow:", gisErr);
    }

    // 2. Redirect fallback to official Google OAuth 2.0 endpoint
    const scope = encodeURIComponent("openid email profile");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=token&scope=${scope}&prompt=select_account&state=${state}`;
    window.location.href = authUrl;
  };

  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-hero px-4 py-10 overflow-hidden">
      {/* factory photo backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity"
        style={{ backgroundImage: `url(${authBg.url})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-80"
      />
      {/* animated ambient orbs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, -25, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="relative w-full max-w-md rounded-3xl bg-card/90 backdrop-blur-xl shadow-elegant border border-border/60 p-8"
      >
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-card/95 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 14 }}
                className="h-16 w-16 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow"
              >
                <Check className="h-8 w-8" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="mt-4 font-display text-lg font-semibold"
              >
                Welcome back
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="flex flex-col items-center text-center mb-6">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.08 }}
              animate={{ y: [0, -5, 0] }}
              transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }}
              className="h-14 w-14 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow mb-3"
            >
              <ShieldCheck className="h-7 w-7" />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.h1
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="font-display text-2xl font-bold"
              >
                {mode === "signin" ? "Admin Sign In" : "Create Admin Account"}
              </motion.h1>
            </AnimatePresence>
            <p className="text-sm text-muted-foreground mt-1">
              Sri Sakthi Vinayaka Tex · Order Book
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0, x: 0 }}
                animate={{ opacity: 1, height: "auto", x: [0, -8, 8, -5, 5, 0] }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ x: { duration: 0.4 }, duration: 0.25 }}
                className="mb-4 overflow-hidden rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}
            {info && (
              <motion.div
                key="info"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
              >
                {info}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <motion.label variants={item} className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email / Username
              </span>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-ring/30 focus:shadow-glow"
                  placeholder="admin@example.com or username"
                />
              </div>
            </motion.label>

            <motion.label variants={item} className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  maxLength={72}
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-ring/30 focus:shadow-glow"
                  placeholder="At least 8 characters"
                />
              </div>
            </motion.label>

            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold shadow-soft hover:shadow-glow transition-shadow disabled:opacity-60"
            >
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait…
                  </motion.span>
                ) : (
                  <motion.span
                    key={mode}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    {mode === "signin" ? "Sign in" : "Create admin account"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <motion.div
            variants={item}
            className="my-5 flex items-center gap-3 text-xs text-muted-foreground"
          >
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </motion.div>

          <motion.button
            variants={item}
            onClick={handleGoogle}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </motion.button>

          <motion.div variants={item} className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Need an admin account?{" "}
                <button
                  className="text-primary font-medium hover:underline"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have one?{" "}
                <button
                  className="text-primary font-medium hover:underline"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </motion.div>

          <motion.p variants={item} className="mt-4 text-center text-[11px] text-muted-foreground">
            The first person to sign up is granted admin access automatically.
          </motion.p>
        </motion.div>
        <div className="hidden">
          <Link to="/auth" />
        </div>
      </motion.div>
    </div>
  );
}
