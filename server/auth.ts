import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User, SafeUser } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export function sanitizeUser(user: User): SafeUser {
  const { passwordHash, verificationToken, verificationTokenExpiry, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

export function getEffectiveSubscriptionStatus(user: User): "trialing" | "active" | "expired" | "cancelled" | "none" {
  if (user.subscriptionStatus === "trialing") {
    if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
      return "trialing";
    }
    return "expired";
  }
  if (user.subscriptionStatus === "active") {
    if (user.subscriptionCurrentPeriodEnd && new Date(user.subscriptionCurrentPeriodEnd) < new Date()) {
      return "expired";
    }
    return "active";
  }
  if (user.subscriptionStatus === "cancelled") {
    if (user.subscriptionCurrentPeriodEnd && new Date(user.subscriptionCurrentPeriodEnd) > new Date()) {
      return "active";
    }
    return "expired";
  }
  return user.subscriptionStatus as any;
}

export function hasFullAccess(user: User): boolean {
  const status = getEffectiveSubscriptionStatus(user);
  return status === "trialing" || status === "active";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "User not found" });
  }
  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  if (!user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  if (!hasFullAccess(user)) {
    return res.status(403).json({ message: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" });
  }
  next();
}
