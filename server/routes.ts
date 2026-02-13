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
import { generatePayfastSubscriptionUrl, validatePayfastSignature, cancelPayfastSubscription } from "./payfast";
import { sendPasswordResetEmail } from "./email";
import { requireAuth, requireAdmin, requireSubscription, requireSuperuser, sanitizeUser, getEffectiveSubscriptionStatus, hasFullAccess, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from "./auth";
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

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      }).parse(req.body);

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

      await storage.verifyUser(user.id);

      req.session.userId = user.id;
      const freshUser = await storage.getUserById(user.id);
      res.status(201).json({ user: sanitizeUser(freshUser!) });
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
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

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

  app.post("/api/payfast/checkout", requireAuth, async (req, res) => {
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

  app.post("/api/payfast/cancel", requireAuth, async (req, res) => {
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

  app.get("/api/superuser/users", requireAuth, requireSuperuser, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(u => {
      const { passwordHash, resetToken, resetTokenExpiry, ...safe } = u;
      return safe;
    });
    res.json(safeUsers);
  });

  app.patch("/api/superuser/users/:id", requireAuth, requireSuperuser, async (req, res) => {
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

  app.delete("/api/superuser/users/:id", requireAuth, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const currentUser = (req as any).user as User;
    if (id === currentUser.id) return res.status(400).json({ message: "Cannot delete your own account" });
    const target = await storage.getUserById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    await storage.deleteUser(id);
    res.status(204).send();
  });

  app.get("/api/superuser/clients", requireAuth, requireSuperuser, async (req, res) => {
    const allClients = await storage.getAllClients();
    res.json(allClients);
  });

  app.patch("/api/superuser/clients/:id", requireAuth, requireSuperuser, async (req, res) => {
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

  app.delete("/api/superuser/clients/:id", requireAuth, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    await storage.deleteClient(id);
    res.status(204).send();
  });

  app.get("/api/superuser/meetings", requireAuth, requireSuperuser, async (req, res) => {
    const allMeetings = await storage.getAllMeetings();
    res.json(allMeetings);
  });

  app.get("/api/superuser/meetings/:id", requireAuth, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const transcript = await storage.getTranscript(id);
    const actionItemsList = await storage.getActionItems(id);
    const topicsList = await storage.getTopics(id);
    const summary = await storage.getSummary(id);
    res.json({ ...meeting, transcript, actionItems: actionItemsList, topics: topicsList, summary });
  });

  app.delete("/api/superuser/meetings/:id", requireAuth, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  app.get("/api/superuser/templates", requireAuth, requireSuperuser, async (req, res) => {
    const templateList = await storage.getTemplates();
    res.json(templateList);
  });

  app.post("/api/superuser/templates", requireAuth, requireSuperuser, async (req, res) => {
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

  app.patch("/api/superuser/templates/:id", requireAuth, requireSuperuser, async (req, res) => {
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

  app.delete("/api/superuser/templates/:id", requireAuth, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    await storage.deleteTemplate(id);
    res.status(204).send();
  });

  // ========== TEMPLATE ROUTES ==========

  app.get("/api/templates", requireAuth, async (req, res) => {
    const templateList = await storage.getTemplates();
    res.json(templateList);
  });

  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const template = await storage.getTemplate(id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    res.json(template);
  });

  app.post("/api/templates", requireAuth, requireAdmin, async (req, res) => {
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

  app.patch("/api/templates/:id", requireAuth, requireAdmin, async (req, res) => {
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

  app.delete("/api/templates/:id", requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    await storage.deleteTemplate(id);
    res.status(204).send();
  });

  // ========== MEETING CONTEXT ROUTES ==========

  app.patch("/api/meetings/:id/context", requireAuth, async (req, res) => {
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

  app.post("/api/meetings/:id/context-file", requireAuth, upload.single('file'), async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const updated = await storage.updateMeetingContextFile(id, filePath, fileName);
    res.json(updated);
  });

  // ========== CLIENT ROUTES ==========

  app.get(api.clients.list.path, requireAuth, requireSubscription, async (req, res) => {
    const user = (req as any).user as User;
    const clientList = await storage.getClients(user.id);
    res.json(clientList);
  });

  app.get(api.clients.get.path, requireAuth, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const client = await storage.getClient(id);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    const clientMeetings = await storage.getMeetingsByClient(id);
    res.json({ ...client, meetings: clientMeetings });
  });

  app.post(api.clients.create.path, requireAuth, requireSubscription, async (req, res) => {
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

  app.delete(api.clients.delete.path, requireAuth, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const client = await storage.getClient(id);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    await storage.deleteClient(id);
    res.status(204).send();
  });

  // ========== MEETING ROUTES ==========

  app.get(api.meetings.list.path, requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (clientId) {
      const filtered = await storage.getMeetingsByClient(clientId);
      return res.json(filtered);
    }
    const allMeetings = await storage.getMeetings(user.id);
    res.json(allMeetings);
  });

  app.get(api.meetings.get.path, requireAuth, async (req, res) => {
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

  app.post(api.meetings.create.path, requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const input = api.meetings.create.input.parse(req.body);
      const meeting = await storage.createMeeting({ ...input, userId: user.id });
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.post("/api/meetings/:id/audio", requireAuth, upload.single('audio'), async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting || existingMeeting.userId !== user.id) {
          return res.status(404).json({ message: "Meeting not found" });
      }
      if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
      }
      
      const originalName = req.file.originalname || "";
      const mimetype = req.file.mimetype || "";
      const ext = path.extname(originalName).toLowerCase();
      
      let finalPath = req.file.path;
      
      if (mimetype.includes("webm") || ext === ".webm") {
          const webmBuffer = fs.readFileSync(req.file.path);
          const wavBuffer = await convertWebmToWav(webmBuffer);
          finalPath = req.file.path + ".wav";
          fs.writeFileSync(finalPath, wavBuffer);
          fs.unlinkSync(req.file.path);
      }
      
      const meeting = await storage.updateMeetingAudioUrl(id, finalPath);
      res.json({ message: "Audio uploaded successfully" });
  });

  app.post("/api/meetings/:id/process", requireAuth, requireSubscription, async (req, res) => {
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

          const audioBuffer = fs.readFileSync(meeting.audioUrl);
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
          if (meeting.contextText) {
            contextSection += `\n\nAdditional context provided by the user:\n${meeting.contextText}`;
          }
          if (meeting.contextFileUrl && meeting.contextFileName) {
            try {
              const fileContent = fs.readFileSync(meeting.contextFileUrl, "utf-8");
              contextSection += `\n\nContent from attached file (${meeting.contextFileName}):\n${fileContent}`;
            } catch (fileErr) {
              console.error("Failed to read context file:", fileErr);
            }
          }

          const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary (concise overview)
            ${templateFormatInstructions}
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            
            Return JSON in this format:
            {
                "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
                "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],
                "summary": "..."
            }
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
                  content: analysis.summary
              });
          }

          await storage.updateMeetingStatus(id, "completed");
          res.json({ message: "Processing completed", status: "completed" });

      } catch (error) {
          console.error("Processing error:", error);
          await storage.updateMeetingStatus(id, "failed");
          res.status(500).json({ message: "Processing failed" });
      }
  });

  app.post("/api/meetings/:id/reprocess", requireAuth, requireSubscription, async (req, res) => {
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
          if (freshMeeting.contextText) {
            contextSection += `\n\nAdditional context provided by the user:\n${freshMeeting.contextText}`;
          }
          if (freshMeeting.contextFileUrl && freshMeeting.contextFileName) {
            try {
              const fileContent = fs.readFileSync(freshMeeting.contextFileUrl, "utf-8");
              contextSection += `\n\nContent from attached file (${freshMeeting.contextFileName}):\n${fileContent}`;
            } catch (fileErr) {
              console.error("Failed to read context file:", fileErr);
            }
          }

          const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary (concise overview)
            ${templateFormatInstructions}
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            
            Return JSON in this format:
            {
                "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
                "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],
                "summary": "..."
            }
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
                  content: analysis.summary
              });
          }

          await storage.updateMeetingStatus(id, "completed");

      } catch (error) {
          console.error("Reprocessing error:", error);
          await storage.updateMeetingStatus(id, "failed");
      }
  });

  app.patch(api.meetings.updateClient.path, requireAuth, requireSubscription, async (req, res) => {
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

  app.delete(api.meetings.delete.path, requireAuth, async (req, res) => {
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
