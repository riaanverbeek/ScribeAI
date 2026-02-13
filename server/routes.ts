import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { speechToText, convertWebmToWav } from "./replit_integrations/audio";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { sendVerificationEmail } from "./email";
import { generatePayfastSubscriptionUrl, validatePayfastSignature, cancelPayfastSubscription } from "./payfast";
import { requireAuth, requireVerified, requireSubscription, sanitizeUser, getEffectiveSubscriptionStatus, hasFullAccess } from "./auth";
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
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
      });

      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: "none",
      });

      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({
        verificationToken,
        verificationTokenExpiry,
      }).where(eq(users.id, user.id));

      try {
        await sendVerificationEmail(email, firstName, verificationToken);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      res.status(201).json({ message: "Account created. Please check your email to verify your account." });
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

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.isVerified) {
        return res.status(403).json({ message: "Please verify your email before logging in. Check your inbox for the verification link.", code: "EMAIL_NOT_VERIFIED" });
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

  app.get("/api/auth/verify", async (req, res) => {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ message: "Missing verification token" });
    }

    const user = await storage.getUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
      return res.status(400).json({ message: "Verification token has expired. Please register again." });
    }

    await storage.verifyUser(user.id);
    res.json({ message: "Email verified successfully. Your 7-day free trial has started!" });
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await storage.getUserByEmail(email);
    if (!user || user.isVerified) {
      return res.json({ message: "If that email exists and is unverified, a new link has been sent." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({
      verificationToken,
      verificationTokenExpiry,
    }).where(eq(users.id, user.id));

    try {
      await sendVerificationEmail(email, user.firstName, verificationToken);
    } catch (e) {
      console.error("Resend verification email failed:", e);
    }

    res.json({ message: "If that email exists and is unverified, a new link has been sent." });
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

  app.get("/api/subscription/status", requireAuth, requireVerified, async (req, res) => {
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
      const meeting = await storage.createMeeting({ ...input, userId: user.id });
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

          const audioBuffer = fs.readFileSync(meeting.audioUrl);
          const audioExt = path.extname(meeting.audioUrl).toLowerCase();
          const format: "wav" | "mp3" | "webm" = audioExt === ".mp3" ? "mp3" : audioExt === ".webm" ? "webm" : "wav";
          const transcriptText = await speechToText(audioBuffer, format);
          
          await storage.createTranscript({
              meetingId: id,
              content: transcriptText,
              language: "en" 
          });

          const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary (concise overview)
            
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
