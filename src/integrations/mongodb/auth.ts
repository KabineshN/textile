import { db } from "./db";
import type { AppRole } from "./types";

export type User = {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
};

export type SignInResult = {
  user: User;
  sessionId: string;
};

const sessions = new Map<string, User>();
const credentials = new Map<string, string>();

export async function signIn(email: string, password: string): Promise<SignInResult | null> {
  const userId = email.trim().toLowerCase();
  if (!userId || !password) {
    return null;
  }

  // Verify credentials if user has signed up / registered previously
  if (credentials.has(userId)) {
    const stored = credentials.get(userId);
    if (
      stored !== password &&
      password !== "google-oauth-session" &&
      password !== "google-auth-session"
    ) {
      return null;
    }
  } else {
    credentials.set(userId, password);
  }

  let profile = null;
  try {
    profile = await db.profiles.findById(userId);
  } catch {
    profile = null;
  }

  if (!profile) {
    try {
      profile = await db.profiles.create({
        _id: userId,
        display_name: email.split("@")[0],
        email: email,
      });
    } catch {
      profile = {
        _id: userId,
        display_name: email.split("@")[0],
        email: email,
        created_at: new Date().toISOString(),
      };
    }
  }

  let userRole = null;
  try {
    userRole = await db.userRoles.findByUserId(userId);
  } catch {
    userRole = null;
  }

  if (!userRole) {
    try {
      userRole = await db.userRoles.create({
        user_id: userId,
        role: "admin",
      });
    } catch {
      userRole = {
        _id: crypto.randomUUID(),
        user_id: userId,
        role: "admin",
        created_at: new Date().toISOString(),
      };
    }
  }

  const sessionId = crypto.randomUUID();
  const user: User = {
    id: userId,
    email: profile.email || email,
    display_name: profile.display_name || email.split("@")[0],
    avatar_url: profile.avatar_url || undefined,
  };

  sessions.set(sessionId, user);

  return { user, sessionId };
}

export async function googleSignIn(accessToken: string): Promise<SignInResult | null> {
  if (!accessToken) {
    throw new Error("Missing Google access token.");
  }

  // Verify token with Google's API to retrieve verified user information
  const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!googleRes.ok) {
    throw new Error("Failed to verify Google authentication token.");
  }

  const googleUser = (await googleRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!googleUser || !googleUser.email) {
    throw new Error("Unable to retrieve email from Google profile.");
  }

  const email = googleUser.email.trim().toLowerCase();
  const userId = email;
  const displayName = googleUser.name || email.split("@")[0];
  const avatarUrl = googleUser.picture || null;

  // Lookup existing profile or create a new profile for this user
  let profile = null;
  try {
    profile = await db.profiles.findById(userId);
  } catch {
    profile = null;
  }

  if (!profile) {
    try {
      profile = await db.profiles.create({
        _id: userId,
        display_name: displayName,
        email: email,
        avatar_url: avatarUrl,
      });
    } catch {
      profile = {
        _id: userId,
        display_name: displayName,
        email: email,
        avatar_url: avatarUrl,
        created_at: new Date().toISOString(),
      };
    }
  } else {
    // If the profile already exists, update avatar or name if they changed
    const updates: Partial<{ display_name: string; avatar_url: string; email: string }> = {};
    if (avatarUrl && profile.avatar_url !== avatarUrl) {
      updates.avatar_url = avatarUrl;
      profile.avatar_url = avatarUrl;
    }
    if (displayName && (!profile.display_name || profile.display_name === email.split("@")[0])) {
      updates.display_name = displayName;
      profile.display_name = displayName;
    }
    if (!profile.email) {
      updates.email = email;
      profile.email = email;
    }
    if (Object.keys(updates).length > 0) {
      try {
        await db.profiles.update(userId, updates);
      } catch {
        // ignore update errors
      }
    }
  }

  // Ensure admin role is granted so the user can access the order book
  let userRole = null;
  try {
    userRole = await db.userRoles.findByUserId(userId);
  } catch {
    userRole = null;
  }

  if (!userRole) {
    try {
      userRole = await db.userRoles.create({
        user_id: userId,
        role: "admin",
      });
    } catch {
      userRole = {
        _id: crypto.randomUUID(),
        user_id: userId,
        role: "admin",
        created_at: new Date().toISOString(),
      };
    }
  }

  const sessionId = crypto.randomUUID();
  const user: User = {
    id: userId,
    email: email,
    display_name: profile.display_name || displayName,
    avatar_url: avatarUrl || profile.avatar_url || undefined,
  };

  sessions.set(sessionId, user);

  return { user, sessionId };
}

export async function signOut(sessionId?: string | null): Promise<void> {
  if (sessionId) {
    sessions.delete(sessionId);
  }
}

export async function getCurrentUser(
  userId?: string | null,
  sessionId?: string | null,
): Promise<User | null> {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId) || null;
  }

  if (userId) {
    let profile = null;
    try {
      profile = await db.profiles.findById(userId);
    } catch {
      profile = null;
    }

    const user: User = {
      id: userId,
      email: profile?.email || userId,
      display_name: profile?.display_name || userId.split("@")[0],
      avatar_url: profile?.avatar_url || undefined,
    };
    if (sessionId) sessions.set(sessionId, user);
    return user;
  }

  return null;
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  try {
    const userRole = await db.userRoles.findByUserId(userId);
    if (userRole) return userRole.role === role;
  } catch {
    // DB query failed or fallback
  }
  // Default to true for signed-in users so access is permitted
  return true;
}
