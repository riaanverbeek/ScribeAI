import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { speechToText, convertWebmToWav } from "./replit_integrations/audio";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { uploadBufferToObjectStorage, downloadBufferFromObjectStorage, streamObjectToResponse } from "./objectStorageHelper";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

function formatSummaryToMarkdown(summary: any): string {
  if (typeof summary === "string") return summary;
  if (typeof summary !== "object" || summary === null) return String(summary);

  function objectToMarkdown(obj: any, depth: number = 2): string {
    let md = "";
    const heading = "#".repeat(Math.min(depth, 4));
    for (const [key, value] of Object.entries(obj)) {
      const title = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()).trim();
      if (typeof value === "string") {
        md += `${heading} ${title}\n\n${value}\n\n`;
      } else if (Array.isArray(value)) {
        md += `${heading} ${title}\n\n`;
        for (const item of value) {
          if (typeof item === "string") {
            md += `- ${item}\n`;
          } else if (typeof item === "object" && item !== null) {
            const parts = Object.entries(item).map(([k, v]) => `**${k.replace(/([A-Z])/g, " $1").trim()}**: ${v}`);
            md += `- ${parts.join(" | ")}\n`;
          }
        }
        md += "\n";
      } else if (typeof value === "object" && value !== null) {
        md += `${heading} ${title}\n\n`;
        md += objectToMarkdown(value, depth + 1);
      } else {
        md += `${heading} ${title}\n\n${String(value)}\n\n`;
      }
    }
    return md;
  }

  return objectToMarkdown(summary);
}

function parseMarkdownBold(text: string, TextRun: any): any[] {
  const runs: any[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part) {
      runs.push(new TextRun({ text: part }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
}
import { generatePayfastSubscriptionUrl, validatePayfastSignature, cancelPayfastSubscription } from "./payfast";
import { sendPasswordResetEmail, sendVerificationEmail, sendMeetingCompletedEmail } from "./email";
import { requireAuth, requireAdmin, requireVerified, requireSubscription, requireSuperuser, sanitizeUser, getEffectiveSubscriptionStatus, hasFullAccess, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from "./auth";
import { passwordSchema } from "@shared/passwordValidation";
import type { User } from "@shared/schema";

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedDatabase();

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  const PgSession = connectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("WARNING: SESSION_SECRET not set. Using insecure fallback for development only.");
  }
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: sessionSecret || "dev-only-insecure-fallback",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }));

  app.use("/uploads", express.static(path.resolve("uploads")));

  registerObjectStorageRoutes(app);

  app.get("/api/audio/:meetingId", requireAuth, async (req, res) => {
    try {
      const meetingId = Number(req.params.meetingId);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== user.id) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      if (!meeting.audioUrl) {
        return res.status(404).json({ message: "No audio available" });
      }
      if (meeting.audioUrl.startsWith("/objects/")) {
        await streamObjectToResponse(meeting.audioUrl, res);
      } else {
        const filePath = path.resolve(meeting.audioUrl);
        if (fs.existsSync(filePath)) {
          res.sendFile(filePath);
        } else {
          return res.status(404).json({ message: "Audio file not found on disk" });
        }
      }
    } catch (error) {
      console.error("Error serving audio:", error);
      res.status(500).json({ message: "Failed to serve audio" });
    }
  });

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, firstName, lastName } = z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      }).parse(req.body);

      const password = passwordSchema.parse(req.body.password);

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
      });

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, expiry);

      try {
        await sendVerificationEmail(user.email, user.firstName, verificationToken);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      req.session.userId = user.id;
      res.status(201).json({ user: sanitizeUser(user), message: "Account created. Please check your email to verify your account." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string(),
      }).parse(req.body);

      if (email.toLowerCase() === SUPERUSER_EMAIL && password === SUPERUSER_PASSWORD) {
        let superuser = await storage.getUserByEmail(SUPERUSER_EMAIL);
        if (!superuser) {
          const hash = await bcrypt.hash(SUPERUSER_PASSWORD, 12);
          superuser = await storage.createUser({
            email: SUPERUSER_EMAIL,
            passwordHash: hash,
            firstName: "Super",
            lastName: "Admin",
          });
          await storage.makeSuperuser(superuser.id);
          superuser = await storage.getUserById(superuser.id);
        }
        req.session.userId = superuser!.id;
        return res.json({ user: sanitizeUser(superuser!) });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check trial expiry and update status
      const effectiveStatus = getEffectiveSubscriptionStatus(user);
      if (effectiveStatus === "expired" && user.subscriptionStatus !== "expired") {
        await storage.updateUserSubscription(user.id, { subscriptionStatus: "expired" });
      }

      req.session.userId = user.id;
      const updatedUser = await storage.getUserById(user.id);
      res.json({ user: sanitizeUser(updatedUser!) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: "No verification token provided." });
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "This verification link is invalid or has already been used." });
      }

      if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
        return res.status(400).json({ message: "This verification link has expired. Please request a new one." });
      }

      await storage.verifyUser(user.id);
      res.json({ message: "Your email has been verified! You can now sign in to your account." });
    } catch (err) {
      console.error("Verification error:", err);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isVerified) {
        return res.json({ message: "Your email is already verified." });
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, expiry);

      try {
        await sendVerificationEmail(user.email, user.firstName, verificationToken);
      } catch (emailErr) {
        console.error("Failed to resend verification email:", emailErr);
        return res.status(500).json({ message: "Failed to send verification email. Please try again later." });
      }

      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (err) {
      console.error("Resend verification error:", err);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }

    const effectiveStatus = getEffectiveSubscriptionStatus(user);
    if (effectiveStatus === "expired" && user.subscriptionStatus !== "expired") {
      await storage.updateUserSubscription(user.id, { subscriptionStatus: "expired" });
    }

    const freshUser = await storage.getUserById(user.id);
    res.json({ user: sanitizeUser(freshUser!) });
  });

  const resetRateLimit = new Map<string, number>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of resetRateLimit) {
      if (now - timestamp > 60_000) resetRateLimit.delete(key);
    }
  }, 60_000);

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const rateLimitKey = email.toLowerCase();
      const lastRequest = resetRateLimit.get(rateLimitKey);
      if (lastRequest && Date.now() - lastRequest < 60_000) {
        return res.json({ message: "If an account with that email exists, we've sent a password reset link." });
      }
      resetRateLimit.set(rateLimitKey, Date.now());

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account with that email exists, we've sent a password reset link." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await storage.setResetToken(user.id, resetToken, expiry);

      try {
        await sendPasswordResetEmail(user.email, user.firstName, resetToken);
      } catch (emailErr) {
        console.error("Failed to send reset email:", emailErr);
        return res.status(500).json({ message: "Failed to send reset email. Please try again later." });
      }

      res.json({ message: "If an account with that email exists, we've sent a password reset link." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token } = z.object({
        token: z.string().min(1),
      }).parse(req.body);

      const password = passwordSchema.parse(req.body.password);

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
        return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updatePassword(user.id, passwordHash);

      res.json({ message: "Password has been reset successfully. You can now sign in with your new password." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  // ========== PAYFAST ROUTES ==========

  app.post("/api/payfast/checkout", requireAuth, requireVerified, async (req, res) => {
    const user = (req as any).user as User;
    const url = generatePayfastSubscriptionUrl({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userId: user.id,
    });
    res.json({ url });
  });

  app.post("/api/payfast/notify", express.urlencoded({ extended: true }), async (req, res) => {
    try {
      const data = req.body;
      console.log("PayFast ITN received:", JSON.stringify(data));

      if (!validatePayfastSignature(data)) {
        console.error("PayFast ITN: invalid signature");
        return res.status(200).send("OK");
      }

      const expectedMerchantId = process.env.PAYFAST_MERCHANT_ID;
      if (data.merchant_id !== expectedMerchantId) {
        console.error("PayFast ITN: merchant_id mismatch");
        return res.status(200).send("OK");
      }

      const userId = parseInt(data.custom_str1);
      if (!userId) {
        console.error("PayFast ITN: missing userId in custom_str1");
        return res.status(200).send("OK");
      }

      const paymentStatus = data.payment_status;
      const token = data.token;

      if (paymentStatus === "COMPLETE") {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await storage.updateUserSubscription(userId, {
          subscriptionStatus: "active",
          payfastToken: token || null,
          payfastSubscriptionId: data.pf_payment_id || null,
          subscriptionCurrentPeriodEnd: periodEnd,
          cancelledAt: null,
        });
        console.log(`PayFast: User ${userId} subscription activated`);
      } else if (paymentStatus === "CANCELLED") {
        await storage.updateUserSubscription(userId, {
          subscriptionStatus: "cancelled",
          cancelledAt: new Date(),
        });
        console.log(`PayFast: User ${userId} subscription cancelled`);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("PayFast ITN error:", error);
      res.status(200).send("OK");
    }
  });

  app.post("/api/payfast/cancel", requireAuth, requireVerified, async (req, res) => {
    const user = (req as any).user as User;
    if (!user.payfastToken) {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    const success = await cancelPayfastSubscription(user.payfastToken);
    if (success) {
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: "cancelled",
        cancelledAt: new Date(),
      });
      res.json({ message: "Subscription cancelled. You'll retain access until the end of your billing period." });
    } else {
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: "cancelled",
        cancelledAt: new Date(),
      });
      res.json({ message: "Subscription cancellation processed." });
    }
  });

  app.get("/api/subscription/status", requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const effectiveStatus = getEffectiveSubscriptionStatus(user);
    res.json({
      status: effectiveStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelledAt: user.cancelledAt,
      hasFullAccess: hasFullAccess(user),
    });
  });

  // ========== SUPERUSER ROUTES ==========

  app.patch("/api/superuser/meetings/:id/status", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const { status } = z.object({
        status: z.enum(["uploading", "processing", "completed", "failed"]),
      }).parse(req.body);
      const meeting = await storage.getMeeting(id);
      if (!meeting) return res.status(404).json({ message: "Meeting not found" });
      const updated = await storage.updateMeetingStatus(id, status);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/superuser/users", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(u => {
      const { passwordHash, resetToken, resetTokenExpiry, ...safe } = u;
      return safe;
    });
    res.json(safeUsers);
  });

  app.patch("/api/superuser/users/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const target = await storage.getUserById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    try {
      const data = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        isAdmin: z.boolean().optional(),
        isVerified: z.boolean().optional(),
        subscriptionStatus: z.enum(["none", "trialing", "active", "cancelled", "expired"]).optional(),
      }).parse(req.body);
      const updated = await storage.updateUser(id, data);
      const { passwordHash, resetToken, resetTokenExpiry, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/superuser/users/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).user as User;
    if (id === currentUser.id) return res.status(400).json({ message: "Cannot delete your own account" });
    const target = await storage.getUserById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    await storage.deleteUser(id);
    res.status(204).send();
  });

  app.get("/api/superuser/clients", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const allClients = await storage.getAllClients();
    res.json(allClients);
  });

  app.patch("/api/superuser/clients/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    try {
      const data = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().nullable().optional(),
        company: z.string().nullable().optional(),
      }).parse(req.body);
      const updated = await storage.updateClient(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/superuser/clients/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    await storage.deleteClient(id);
    res.status(204).send();
  });

  app.get("/api/superuser/meetings", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const allMeetings = await storage.getAllMeetings();
    res.json(allMeetings);
  });

  app.get("/api/superuser/meetings/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const transcript = await storage.getTranscript(id);
    const actionItemsList = await storage.getActionItems(id);
    const topicsList = await storage.getTopics(id);
    const summary = await storage.getSummary(id);
    res.json({ ...meeting, transcript, actionItems: actionItemsList, topics: topicsList, summary });
  });

  app.delete("/api/superuser/meetings/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  app.get("/api/superuser/templates", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const templateList = await storage.getTemplates();
    res.json(templateList);
  });

  app.post("/api/superuser/templates", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { name, description, formatPrompt, isDefault } = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        formatPrompt: z.string().min(1),
        isDefault: z.boolean().optional(),
      }).parse(req.body);
      const user = (req as any).user as User;
      const template = await storage.createTemplate({
        name, description: description || null, formatPrompt, isDefault: isDefault || false, createdBy: user.id,
      });
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/superuser/templates/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    try {
      const data = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        formatPrompt: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
      }).parse(req.body);
      const updated = await storage.updateTemplate(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/superuser/templates/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    await storage.deleteTemplate(id);
    res.status(204).send();
  });

  // ========== SUPERUSER ROLES ROUTES ==========

  app.get("/api/superuser/roles", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const roleList = await storage.getRoles();
    res.json(roleList);
  });

  app.post("/api/superuser/roles", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { name } = z.object({
        name: z.string().min(1, "Role name is required"),
      }).parse(req.body);
      const role = await storage.createRole({ name });
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A role with that name already exists" });
      throw err;
    }
  });

  app.patch("/api/superuser/roles/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getRole(id);
    if (!existing) return res.status(404).json({ message: "Role not found" });
    try {
      const { name } = z.object({
        name: z.string().min(1, "Role name is required"),
      }).parse(req.body);
      const updated = await storage.updateRole(id, { name });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A role with that name already exists" });
      throw err;
    }
  });

  app.delete("/api/superuser/roles/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getRole(id);
    if (!existing) return res.status(404).json({ message: "Role not found" });
    await storage.deleteRole(id);
    res.status(204).send();
  });

  // ========== ROLES (PUBLIC) ==========

  app.get("/api/roles", requireAuth, requireVerified, async (req, res) => {
    const roleList = await storage.getRoles();
    res.json(roleList);
  });

  // ========== USER ROLE UPDATE ==========

  app.patch("/api/users/me/role", requireAuth, requireVerified, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const { roleId, customRole } = z.object({
        roleId: z.number().nullable(),
        customRole: z.string().nullable(),
      }).parse(req.body);
      const updated = await storage.updateUserRole(user.id, roleId, customRole);
      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // ========== TEMPLATE ROUTES ==========

  app.get("/api/templates", requireAuth, requireVerified, async (req, res) => {
    const templateList = await storage.getTemplates();
    res.json(templateList);
  });

  app.get("/api/templates/:id", requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    res.json(template);
  });

  app.post("/api/templates", requireAuth, requireVerified, requireAdmin, async (req, res) => {
    try {
      const { name, description, formatPrompt, isDefault } = z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        formatPrompt: z.string().min(1, "Format prompt is required"),
        isDefault: z.boolean().optional(),
      }).parse(req.body);

      const user = (req as any).user as User;
      const template = await storage.createTemplate({
        name,
        description: description || null,
        formatPrompt,
        isDefault: isDefault || false,
        createdBy: user.id,
      });
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/templates/:id", requireAuth, requireVerified, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    try {
      const data = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        formatPrompt: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
      }).parse(req.body);

      const updated = await storage.updateTemplate(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/templates/:id", requireAuth, requireVerified, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    await storage.deleteTemplate(id);
    res.status(204).send();
  });

  // ========== MEETING CONTEXT ROUTES ==========

  app.patch("/api/meetings/:id/context", requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    try {
      const data = z.object({
        contextText: z.string().nullable().optional(),
        templateId: z.number().nullable().optional(),
        includePreviousContext: z.boolean().optional(),
        outputLanguage: z.enum(["en", "af"]).optional(),
        isInternal: z.boolean().optional(),
      }).parse(req.body);

      const updated = await storage.updateMeetingContext(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/meetings/:id/context-file", requireAuth, requireVerified, upload.single('file'), async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const ext = path.extname(req.file.originalname).toLowerCase() || ".txt";
      const contentType = req.file.mimetype || "text/plain";
      const objectPath = await uploadBufferToObjectStorage(fileBuffer, ext, contentType);
      try { fs.unlinkSync(req.file.path); } catch {}
      const fileName = req.file.originalname;
      const updated = await storage.updateMeetingContextFile(id, objectPath, fileName);
      res.json(updated);
    } catch (error) {
      console.error("Error uploading context file:", error);
      try { fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ message: "Failed to upload context file" });
    }
  });

  // ========== CLIENT ROUTES ==========

  app.get(api.clients.list.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const user = (req as any).user as User;
    const clientList = await storage.getClients(user.id);
    res.json(clientList);
  });

  app.get(api.clients.get.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const client = await storage.getClient(id);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    const clientMeetings = await storage.getMeetingsByClient(id);
    res.json({ ...client, meetings: clientMeetings });
  });

  app.post(api.clients.create.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient({ ...input, userId: user.id });
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.clients.delete.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const client = await storage.getClient(id);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    await storage.deleteClient(id);
    res.status(204).send();
  });

  // ========== POLICY ROUTES ==========

  app.get(api.policies.listByClient.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = (req as any).user as User;
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    const clientPolicies = await storage.getPoliciesByClient(clientId);
    res.json(clientPolicies);
  });

  app.post(api.policies.create.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = (req as any).user as User;
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    const input = api.policies.create.input.parse(req.body);
    const policy = await storage.createPolicy({ ...input, clientId });
    res.status(201).json(policy);
  });

  app.patch(api.policies.update.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const policy = await storage.getPolicy(id);
    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }
    const client = await storage.getClient(policy.clientId);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Policy not found" });
    }
    const { type, insurer, policyNumber, isActive } = req.body;
    const updated = await storage.updatePolicy(id, { type, insurer, policyNumber, ...(isActive !== undefined ? { isActive } : {}) });
    res.json(updated);
  });

  app.delete(api.policies.delete.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const policy = await storage.getPolicy(id);
    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }
    const client = await storage.getClient(policy.clientId);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Policy not found" });
    }
    await storage.deletePolicy(id);
    res.status(204).send();
  });

  app.get(api.policies.meetingPolicies.path, requireAuth, requireVerified, async (req, res) => {
    const meetingId = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    const linkedPolicies = await storage.getMeetingPolicies(meetingId);
    res.json(linkedPolicies);
  });

  app.put(api.policies.setMeetingPolicies.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const meetingId = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    const { policyIds } = api.policies.setMeetingPolicies.input.parse(req.body);
    if (policyIds.length > 0) {
      for (const pid of policyIds) {
        const pol = await storage.getPolicy(pid);
        if (!pol) {
          return res.status(400).json({ message: `Policy ${pid} not found` });
        }
        const polClient = await storage.getClient(pol.clientId);
        if (!polClient || polClient.userId !== user.id) {
          return res.status(400).json({ message: `Policy ${pid} not authorized` });
        }
      }
    }
    await storage.setMeetingPolicies(meetingId, policyIds);
    res.json({ message: "Policies updated" });
  });

  // ========== MEETING ROUTES ==========

  app.get(api.meetings.list.path, requireAuth, requireVerified, async (req, res) => {
    const user = (req as any).user as User;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (clientId) {
      const filtered = await storage.getMeetingsByClient(clientId);
      return res.json(filtered);
    }
    const allMeetings = await storage.getMeetings(user.id);
    res.json(allMeetings);
  });

  app.get(api.meetings.get.path, requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    
    const canAccessAnalysis = hasFullAccess(user);
    
    const transcript = canAccessAnalysis ? await storage.getTranscript(id) : undefined;
    const actionItemsList = canAccessAnalysis ? await storage.getActionItems(id) : [];
    const topicsList = canAccessAnalysis ? await storage.getTopics(id) : [];
    const summary = canAccessAnalysis ? await storage.getSummary(id) : undefined;

    res.json({
        ...meeting,
        transcript,
        actionItems: actionItemsList,
        topics: topicsList,
        summary
    });
  });

  app.post(api.meetings.create.path, requireAuth, requireVerified, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const input = api.meetings.create.input.parse(req.body);
      let userRole: string | null = null;
      if (user.customRole) {
        userRole = user.customRole;
      } else if (user.roleId) {
        const role = await storage.getRole(user.roleId);
        if (role) userRole = role.name;
      }
      const meeting = await storage.createMeeting({ ...input, userId: user.id, userRole });
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.post("/api/meetings/:id/audio", requireAuth, requireVerified, upload.single('audio'), async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting || existingMeeting.userId !== user.id) {
          return res.status(404).json({ message: "Meeting not found" });
      }
      if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
      }
      
      try {
        const originalName = req.file.originalname || "";
        const mimetype = req.file.mimetype || "";
        const ext = path.extname(originalName).toLowerCase();
        
        let audioBuffer = fs.readFileSync(req.file.path);
        let finalExt = ext || ".wav";
        let contentType = mimetype || "audio/wav";
        
        if (mimetype.includes("webm") || ext === ".webm") {
            audioBuffer = await convertWebmToWav(audioBuffer);
            finalExt = ".wav";
            contentType = "audio/wav";
        }
        
        const objectPath = await uploadBufferToObjectStorage(audioBuffer, finalExt, contentType);
        
        try { fs.unlinkSync(req.file.path); } catch {}
        
        await storage.updateMeetingAudioUrl(id, objectPath);
        res.json({ message: "Audio uploaded successfully" });
      } catch (error) {
        console.error("Error uploading audio to Object Storage:", error);
        try { fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ message: "Failed to upload audio" });
      }
  });

  app.post("/api/meetings/:id/process", requireAuth, requireVerified, requireSubscription, async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(id);
      
      if (!meeting || meeting.userId !== user.id) {
          return res.status(404).json({ message: "Meeting not found" });
      }
      if (!meeting.audioUrl) {
          return res.status(400).json({ message: "No audio uploaded for this meeting" });
      }

      try {
          await storage.updateMeetingStatus(id, "processing");

          let audioBuffer: Buffer;
          if (meeting.audioUrl.startsWith("/objects/")) {
            audioBuffer = await downloadBufferFromObjectStorage(meeting.audioUrl);
          } else {
            audioBuffer = fs.readFileSync(meeting.audioUrl);
          }
          const audioExt = path.extname(meeting.audioUrl).toLowerCase();
          const format: "wav" | "mp3" | "webm" = audioExt === ".mp3" ? "mp3" : audioExt === ".webm" ? "webm" : "wav";
          const transcriptText = await speechToText(audioBuffer, format);
          
          await storage.createTranscript({
              meetingId: id,
              content: transcriptText,
              language: "en" 
          });

          let templateFormatInstructions = "";
          if (meeting.templateId) {
            const template = await storage.getTemplate(meeting.templateId);
            if (template) {
              templateFormatInstructions = `\n\nIMPORTANT - Use the following format/style for the summary:\n${template.formatPrompt}`;
            }
          }

          let contextSection = "";
          if (meeting.userRole) {
            contextSection += `\n\nThe person who recorded this meeting has the following role/position: ${meeting.userRole}`;
          }
          if (meeting.contextText) {
            contextSection += `\n\nAdditional context provided by the user:\n${meeting.contextText}`;
          }
          if (meeting.contextFileUrl && meeting.contextFileName) {
            try {
              let fileContent: string;
              if (meeting.contextFileUrl.startsWith("/objects/")) {
                const buf = await downloadBufferFromObjectStorage(meeting.contextFileUrl);
                fileContent = buf.toString("utf-8");
              } else {
                fileContent = fs.readFileSync(meeting.contextFileUrl, "utf-8");
              }
              contextSection += `\n\nContent from attached file (${meeting.contextFileName}):\n${fileContent}`;
            } catch (fileErr) {
              console.error("Failed to read context file:", fileErr);
            }
          }

          if (meeting.includePreviousContext && meeting.clientId) {
            try {
              const previousSummaries = await storage.getPreviousClientMeetingSummaries(meeting.clientId, id);
              if (previousSummaries.length > 0) {
                contextSection += `\n\n--- PREVIOUS MEETING SUMMARIES WITH THIS CLIENT ---\nThe transcript you are about to analyse is from the MOST RECENT meeting with this client. Below are notes and summaries from earlier meetings, listed from most recent to oldest. Use them to provide continuity, track progress on action items, and reference prior discussions:\n`;
                for (const prev of previousSummaries) {
                  contextSection += `\n### Earlier Meeting: "${prev.title}" (${prev.date.toLocaleDateString()})\n${prev.summary}\n`;
                }
              }
            } catch (prevErr) {
              console.error("Failed to fetch previous meeting summaries:", prevErr);
            }
          }

          const linkedPolicies = await storage.getMeetingPolicies(id);
          let policyPromptSection = "";
          if (linkedPolicies.length > 0) {
            contextSection += `\n\n--- LINKED INSURANCE POLICIES ---\nThe following insurance policies are relevant to this meeting. Reference them in your analysis where applicable:\n`;
            for (const pol of linkedPolicies) {
              contextSection += `- ${pol.type} | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
            }
            policyPromptSection = `\n\n            IMPORTANT: This meeting has linked insurance policies. You MUST begin the summary with a "## Applicable Policies" section that lists each linked policy in this format:\n            ## Applicable Policies\n`;
            for (const pol of linkedPolicies) {
              policyPromptSection += `            - **${pol.type}** | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
            }
            policyPromptSection += `\n            This section MUST appear FIRST in the summary, before the Executive Summary section. Then continue with the rest of the report structure below.`;
          }

          const outputLangMap: Record<string, string> = { en: "English", af: "Afrikaans" };
          const outputLangName = outputLangMap[meeting.outputLanguage] || "English";

          const internalMeetingInstruction = meeting.isInternal
            ? `\n\nIMPORTANT CONTEXT: This is an INTERNAL meeting — an internal discussion or dictation where the client was NOT present. The transcript contains ONLY the user's own notes, thoughts, or internal team discussion. Do NOT look for or reference client responses, client questions, or client statements in the transcript. Treat everything as internal notes or dictation. Frame the summary accordingly as internal notes/observations rather than a client-facing meeting recap.`
            : "";

          const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.

            IMPORTANT: You MUST write ALL of your output (summary, action items, and topics) in ${outputLangName}. The transcript may be in any language, but your analysis output MUST be entirely in ${outputLangName}. Do NOT leave any part of your response in a different language. Only the JSON keys should remain in English.
            ${internalMeetingInstruction}
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary as a structured report in Markdown format
            ${templateFormatInstructions}
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            
            Return JSON in this format:
            {
                "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
                "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],
                "summary": "<markdown report string>"
            }

            CRITICAL: The "summary" field MUST be a single Markdown-formatted string (NOT a JSON object). Structure it as a professional report with the following format:
            ${policyPromptSection}

            ## Executive Summary
            A brief 2-3 sentence overview of the meeting.

            ## Key Discussion Points
            - **Point title**: Description of what was discussed
            - **Point title**: Description of what was discussed

            ## Decisions Made
            - Decision 1
            - Decision 2

            ## Recommendations
            - Recommendation with explanation

            ## Action Items & Next Steps
            - **Task**: Description | **Assigned to**: Person | **Priority**: High/Medium/Low

            ## Constraints & Considerations
            - Any limitations or important notes

            Use clear headings (##), sub-headings (###), bullet points (-), and bold text (**) throughout. The summary MUST be a string value in the JSON, not a nested object. Remember: ALL text content must be in ${outputLangName}.
          `;

          const response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: transcriptText }
              ],
              response_format: { type: "json_object" }
          });

          const analysis = JSON.parse(response.choices[0].message.content || "{}");

          if (analysis.actionItems) {
              for (const item of analysis.actionItems) {
                  await storage.createActionItem({
                      meetingId: id,
                      content: item.content,
                      assignee: item.assignee,
                      status: "pending"
                  });
              }
          }

          if (analysis.topics) {
              for (const topic of analysis.topics) {
                  await storage.createTopic({
                      meetingId: id,
                      title: topic.title,
                      summary: topic.summary,
                      relevanceScore: topic.relevanceScore
                  });
              }
          }

          if (analysis.summary) {
              await storage.createSummary({
                  meetingId: id,
                  content: formatSummaryToMarkdown(analysis.summary)
              });
          }

          await storage.updateMeetingStatus(id, "completed");

          const completedActionItems = await storage.getActionItems(id);
          const meetingOwner = await storage.getUserById(user.id);
          if (meetingOwner) {
            sendMeetingCompletedEmail(
              meetingOwner.email,
              meetingOwner.firstName || meetingOwner.email,
              meeting.title || "Untitled Meeting",
              meeting.date,
              id,
              completedActionItems.map(a => ({ content: a.content, assignee: a.assignee }))
            ).catch(err => console.error("[email] Meeting completed email failed:", err));
          }

          res.json({ message: "Processing completed", status: "completed" });

      } catch (error) {
          console.error("Processing error:", error);
          await storage.updateMeetingStatus(id, "failed");
          res.status(500).json({ message: "Processing failed" });
      }
  });

  app.get("/api/meetings/:id/export-word", requireAuth, requireVerified, requireSubscription, async (req, res) => {
    try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = await import("docx");
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meetingBase = await storage.getMeeting(id);

    if (!meetingBase || meetingBase.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const includeSummary = req.query.summary === "1";
    const includeTranscript = req.query.transcript === "1";
    const includeActionItems = req.query.actionItems === "1";
    const includeTopics = req.query.topics === "1";

    if (!includeSummary && !includeTranscript && !includeActionItems && !includeTopics) {
      return res.status(400).json({ message: "Select at least one section to export" });
    }

    const [summary, transcript, actionItems, topics] = await Promise.all([
      includeSummary ? storage.getSummary(id) : Promise.resolve(undefined),
      includeTranscript ? storage.getTranscript(id) : Promise.resolve(undefined),
      includeActionItems ? storage.getActionItems(id) : Promise.resolve([]),
      includeTopics ? storage.getTopics(id) : Promise.resolve([]),
    ]);

    const meeting = { ...meetingBase, summary, transcript, actionItems, topics };

    const children: any[] = [];

    children.push(new Paragraph({
      text: meeting.title || "Meeting Report",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }));

    if (meeting.date) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Date: ", bold: true }),
          new TextRun({ text: new Date(meeting.date).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }) }),
        ],
        spacing: { after: 100 },
      }));
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: "" })],
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
    }));

    if (meeting.summary) {
      children.push(new Paragraph({
        text: "Executive Summary",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));

      const summaryContent = formatSummaryToMarkdown(meeting.summary.content);
      const lines = summaryContent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("## ")) {
          children.push(new Paragraph({
            text: trimmed.replace(/^##\s*/, ""),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }));
        } else if (trimmed.startsWith("### ")) {
          children.push(new Paragraph({
            text: trimmed.replace(/^###\s*/, ""),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 150, after: 80 },
          }));
        } else if (trimmed.startsWith("- ")) {
          const bulletText = trimmed.replace(/^-\s*/, "");
          const runs = parseMarkdownBold(bulletText, TextRun);
          children.push(new Paragraph({
            children: runs,
            bullet: { level: 0 },
            spacing: { after: 60 },
          }));
        } else {
          const runs = parseMarkdownBold(trimmed, TextRun);
          children.push(new Paragraph({
            children: runs,
            spacing: { after: 80 },
          }));
        }
      }
    }

    if (meeting.transcript) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
      }));
      children.push(new Paragraph({
        text: "Transcript",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));
      const blocks = meeting.transcript.content.split("\n\n");
      for (const block of blocks) {
        if (block.trim()) {
          children.push(new Paragraph({
            text: block.trim(),
            spacing: { after: 120 },
          }));
        }
      }
    }

    if (meeting.actionItems && meeting.actionItems.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
      }));
      children.push(new Paragraph({
        text: "Action Items",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));
      for (const item of meeting.actionItems) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: item.content }),
            ...(item.assignee ? [new TextRun({ text: ` (Assigned to: ${item.assignee})`, italics: true, color: "666666" })] : []),
          ],
          bullet: { level: 0 },
          spacing: { after: 80 },
        }));
      }
    }

    if (meeting.topics && meeting.topics.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "" })],
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
      }));
      children.push(new Paragraph({
        text: "Topics",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      }));
      for (const topic of meeting.topics) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: topic.title, bold: true }),
            ...(topic.relevanceScore ? [new TextRun({ text: ` (${topic.relevanceScore}% relevance)`, italics: true, color: "666666" })] : []),
          ],
          spacing: { before: 150, after: 60 },
        }));
        children.push(new Paragraph({
          text: topic.summary,
          spacing: { after: 120 },
        }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = (meeting.title || "Meeting Report").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.docx"`);
    res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Word export error:", error);
      res.status(500).json({ message: "Failed to generate Word document" });
    }
  });

  app.post("/api/meetings/:id/send-email", requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (meeting.status !== "completed") {
      return res.status(400).json({ message: "Meeting has not been processed yet" });
    }
    const meetingOwner = await storage.getUserById(user.id);
    if (!meetingOwner) {
      return res.status(404).json({ message: "User not found" });
    }
    const actionItems = await storage.getActionItems(id);
    try {
      await sendMeetingCompletedEmail(
        meetingOwner.email,
        meetingOwner.firstName || meetingOwner.email,
        meeting.title || "Untitled Meeting",
        meeting.date,
        id,
        actionItems.map(a => ({ content: a.content, assignee: a.assignee }))
      );
      res.json({ message: "Email sent successfully" });
    } catch (err) {
      console.error("[email] Manual send failed:", err);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  app.post("/api/meetings/:id/reprocess", requireAuth, requireVerified, requireSubscription, async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(id);

      if (!meeting || meeting.userId !== user.id) {
          return res.status(404).json({ message: "Meeting not found" });
      }

      const transcript = await storage.getTranscript(id);
      if (!transcript) {
          return res.status(400).json({ message: "No transcript available. Process the meeting first." });
      }

      await storage.updateMeetingStatus(id, "processing");
      await storage.clearMeetingAnalysis(id);

      res.json({ message: "Reprocessing started", status: "processing" });

      try {
          const freshMeeting = (await storage.getMeeting(id))!;
          const transcriptText = transcript.content;

          let templateFormatInstructions = "";
          if (freshMeeting.templateId) {
            const template = await storage.getTemplate(freshMeeting.templateId);
            if (template) {
              templateFormatInstructions = `\n\nIMPORTANT - Use the following format/style for the summary:\n${template.formatPrompt}`;
            }
          }

          let contextSection = "";
          if (freshMeeting.userRole) {
            contextSection += `\n\nThe person who recorded this meeting has the following role/position: ${freshMeeting.userRole}`;
          }
          if (freshMeeting.contextText) {
            contextSection += `\n\nAdditional context provided by the user:\n${freshMeeting.contextText}`;
          }
          if (freshMeeting.contextFileUrl && freshMeeting.contextFileName) {
            try {
              let fileContent: string;
              if (freshMeeting.contextFileUrl.startsWith("/objects/")) {
                const buf = await downloadBufferFromObjectStorage(freshMeeting.contextFileUrl);
                fileContent = buf.toString("utf-8");
              } else {
                fileContent = fs.readFileSync(freshMeeting.contextFileUrl, "utf-8");
              }
              contextSection += `\n\nContent from attached file (${freshMeeting.contextFileName}):\n${fileContent}`;
            } catch (fileErr) {
              console.error("Failed to read context file:", fileErr);
            }
          }

          if (freshMeeting.includePreviousContext && freshMeeting.clientId) {
            try {
              const previousSummaries = await storage.getPreviousClientMeetingSummaries(freshMeeting.clientId, id);
              if (previousSummaries.length > 0) {
                contextSection += `\n\n--- PREVIOUS MEETING SUMMARIES WITH THIS CLIENT ---\nThe transcript you are about to analyse is from the MOST RECENT meeting with this client. Below are notes and summaries from earlier meetings, listed from most recent to oldest. Use them to provide continuity, track progress on action items, and reference prior discussions:\n`;
                for (const prev of previousSummaries) {
                  contextSection += `\n### Earlier Meeting: "${prev.title}" (${prev.date.toLocaleDateString()})\n${prev.summary}\n`;
                }
              }
            } catch (prevErr) {
              console.error("Failed to fetch previous meeting summaries:", prevErr);
            }
          }

          const reprocessLinkedPolicies = await storage.getMeetingPolicies(id);
          let reprocessPolicyPromptSection = "";
          if (reprocessLinkedPolicies.length > 0) {
            contextSection += `\n\n--- LINKED INSURANCE POLICIES ---\nThe following insurance policies are relevant to this meeting. Reference them in your analysis where applicable:\n`;
            for (const pol of reprocessLinkedPolicies) {
              contextSection += `- ${pol.type} | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
            }
            reprocessPolicyPromptSection = `\n\n            IMPORTANT: This meeting has linked insurance policies. You MUST begin the summary with a "## Applicable Policies" section that lists each linked policy in this format:\n            ## Applicable Policies\n`;
            for (const pol of reprocessLinkedPolicies) {
              reprocessPolicyPromptSection += `            - **${pol.type}** | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
            }
            reprocessPolicyPromptSection += `\n            This section MUST appear FIRST in the summary, before the Executive Summary section. Then continue with the rest of the report structure below.`;
          }

          const outputLangMap: Record<string, string> = { en: "English", af: "Afrikaans" };
          const outputLangName = outputLangMap[freshMeeting.outputLanguage] || "English";

          const reprocessInternalInstruction = freshMeeting.isInternal
            ? `\n\nIMPORTANT CONTEXT: This is an INTERNAL meeting — an internal discussion or dictation where the client was NOT present. The transcript contains ONLY the user's own notes, thoughts, or internal team discussion. Do NOT look for or reference client responses, client questions, or client statements in the transcript. Treat everything as internal notes or dictation. Frame the summary accordingly as internal notes/observations rather than a client-facing meeting recap.`
            : "";

          const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.

            IMPORTANT: You MUST write ALL of your output (summary, action items, and topics) in ${outputLangName}. The transcript may be in any language, but your analysis output MUST be entirely in ${outputLangName}. Do NOT leave any part of your response in a different language. Only the JSON keys should remain in English.
            ${reprocessInternalInstruction}
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary as a structured report in Markdown format
            ${templateFormatInstructions}
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            
            Return JSON in this format:
            {
                "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
                "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],
                "summary": "<markdown report string>"
            }

            CRITICAL: The "summary" field MUST be a single Markdown-formatted string (NOT a JSON object). Structure it as a professional report with the following format:
            ${reprocessPolicyPromptSection}

            ## Executive Summary
            A brief 2-3 sentence overview of the meeting.

            ## Key Discussion Points
            - **Point title**: Description of what was discussed
            - **Point title**: Description of what was discussed

            ## Decisions Made
            - Decision 1
            - Decision 2

            ## Recommendations
            - Recommendation with explanation

            ## Action Items & Next Steps
            - **Task**: Description | **Assigned to**: Person | **Priority**: High/Medium/Low

            ## Constraints & Considerations
            - Any limitations or important notes

            Use clear headings (##), sub-headings (###), bullet points (-), and bold text (**) throughout. The summary MUST be a string value in the JSON, not a nested object. Remember: ALL text content must be in ${outputLangName}.
          `;

          const response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: transcriptText }
              ],
              response_format: { type: "json_object" }
          });

          const analysis = JSON.parse(response.choices[0].message.content || "{}");

          if (analysis.actionItems) {
              for (const item of analysis.actionItems) {
                  await storage.createActionItem({
                      meetingId: id,
                      content: item.content,
                      assignee: item.assignee,
                      status: "pending"
                  });
              }
          }

          if (analysis.topics) {
              for (const topic of analysis.topics) {
                  await storage.createTopic({
                      meetingId: id,
                      title: topic.title,
                      summary: topic.summary,
                      relevanceScore: topic.relevanceScore
                  });
              }
          }

          if (analysis.summary) {
              await storage.createSummary({
                  meetingId: id,
                  content: formatSummaryToMarkdown(analysis.summary)
              });
          }

          await storage.updateMeetingStatus(id, "completed");

          const reprocessedActionItems = await storage.getActionItems(id);
          const meetingOwner = await storage.getUserById(user.id);
          if (meetingOwner) {
            sendMeetingCompletedEmail(
              meetingOwner.email,
              meetingOwner.firstName || meetingOwner.email,
              meeting.title || "Untitled Meeting",
              meeting.date,
              id,
              reprocessedActionItems.map(a => ({ content: a.content, assignee: a.assignee }))
            ).catch(err => console.error("[email] Reprocess email failed:", err));
          }

      } catch (error) {
          console.error("Reprocessing error:", error);
          await storage.updateMeetingStatus(id, "failed");
      }
  });

  app.patch(api.meetings.updateClient.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    try {
      const { clientId } = api.meetings.updateClient.input.parse(req.body);
      if (clientId !== null) {
        const client = await storage.getClient(clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      const updated = await storage.updateMeetingClient(id, clientId);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.meetings.delete.path, requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  return httpServer;
}
