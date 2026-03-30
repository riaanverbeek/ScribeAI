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
import { speechToText, convertWebmToWav, convertAudioToWav, prepareAudioForTranscription, transcribeLongAudio } from "./replit_integrations/audio";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mammoth from "mammoth";
import { uploadBufferToObjectStorage, downloadBufferFromObjectStorage, streamObjectToResponse, objectStorageService } from "./objectStorageHelper";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { processMeetingCore } from "./processMeeting";

function cleanAiOutput(text: string): string {
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      cleanedLines.push(line);
      continue;
    }
    
    const words = trimmed.split(/\s+/);
    if (words.length >= 4) {
      const nonsenseWords = words.filter(w => {
        const clean = w.replace(/[^a-zA-Z]/g, '');
        if (clean.length < 2) return false;
        const consonants = (clean.match(/[^aeiouAEIOU]/g) || []).length;
        const ratio = consonants / clean.length;
        return ratio > 0.85 && clean.length > 4;
      });
      
      const hasDotChains = /\.\w+\.\w+\.\w+/.test(trimmed);
      const hasCodePatterns = /\b(await|inline|modello|completions|verifier|uncertainties)\b/i.test(trimmed) && 
                              !/^(##|###|\*\*|-|\d+\.)/.test(trimmed);
      const hasRandomConcatenation = /[a-z][A-Z][a-z]{2,}[A-Z]/.test(trimmed) && !/^(##|###)/.test(trimmed);
      
      if ((nonsenseWords.length > words.length * 0.3 && words.length > 5) || 
          (hasDotChains && hasCodePatterns) ||
          (hasCodePatterns && nonsenseWords.length > 2)) {
        break;
      }
    }
    
    cleanedLines.push(line);
  }
  
  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

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
import { getUncachableStripeClient } from "./stripeClient";
import { sendPasswordResetEmail, sendVerificationEmail, sendMeetingCompletedEmail } from "./email";
import { requireAuth, requireAdmin, requireVerified, requireSubscription, requireSuperuser, sanitizeUser, getEffectiveSubscriptionStatus, hasFullAccess, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from "./auth";
import { passwordSchema } from "@shared/passwordValidation";
import type { User, Tenant } from "@shared/schema";
import { resolveTenant, invalidateTenantCache } from "./tenant";

const upload = multer({ dest: "uploads/", limits: { fileSize: 200 * 1024 * 1024 } });

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

  app.use(resolveTenant);

  app.use("/uploads", express.static(path.resolve("uploads")));

  registerObjectStorageRoutes(app);

  app.post("/api/client-errors", (req, res) => {
    const user = (req as any).user;
    const userId = user?.id || "anonymous";
    const { message, context, userAgent, url } = req.body || {};
    console.error(`[CLIENT ERROR] userId=${userId} context=${context || "unknown"} ua=${userAgent || "unknown"} url=${url || "unknown"} message=${message || "no message"}`);
    res.status(204).end();
  });

  app.get("/api/audio/:meetingId", requireAuth, async (req, res) => {
    try {
      const meetingId = Number(req.params.meetingId);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || (meeting.userId !== user.id && !user.isSuperuser)) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (!meeting.audioUrl) {
        return res.status(404).json({ message: "No audio available" });
      }
      if (meeting.audioUrl.startsWith("/objects/")) {
        const signedUrl = await objectStorageService.getSignedDownloadUrl(meeting.audioUrl, 3600);
        return res.json({ url: signedUrl });
      } else {
        const filePath = path.resolve(meeting.audioUrl);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Audio file not found on disk" });
        }
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          const fileStream = fs.createReadStream(filePath, { start, end });
          res.status(206);
          res.set({
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": "audio/wav",
          });
          fileStream.pipe(res);
        } else {
          res.set({
            "Content-Length": String(fileSize),
            "Accept-Ranges": "bytes",
            "Content-Type": "audio/wav",
          });
          fs.createReadStream(filePath).pipe(res);
        }
      }
    } catch (error) {
      console.error("Error serving audio:", error);
      res.status(500).json({ message: "Failed to serve audio" });
    }
  });

  app.get("/api/audio/:meetingId/download", requireAuth, async (req, res) => {
    try {
      const meetingId = Number(req.params.meetingId);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || (meeting.userId !== user.id && !user.isSuperuser)) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (!meeting.audioUrl) {
        return res.status(404).json({ message: "No audio available" });
      }

      const ext = path.extname(meeting.audioUrl) || ".wav";
      const safeTitle = (meeting.title || "recording").replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "recording";
      const filename = `${safeTitle}${ext}`;

      if (meeting.audioUrl.startsWith("/objects/")) {
        const signedUrl = await objectStorageService.getSignedDownloadUrl(meeting.audioUrl, 3600);
        return res.redirect(signedUrl);
      } else {
        const filePath = path.resolve(meeting.audioUrl);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Audio file not found on disk" });
        }
        res.set({
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": "application/octet-stream",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error("Error downloading audio:", error);
      res.status(500).json({ message: "Failed to download audio" });
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

      const tenantId = req.tenant?.id;
      const existing = await storage.getUserByEmail(email, tenantId);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await storage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        tenantId: tenantId ?? null,
      });

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, expiry);

      try {
        await sendVerificationEmail(user.email, user.firstName, verificationToken, req.tenant?.name);
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
            tenantId: req.tenant?.id ?? null,
          });
          await storage.makeSuperuser(superuser.id);
          superuser = await storage.getUserById(superuser.id);
        }
        req.session.userId = superuser!.id;
        return res.json({ user: sanitizeUser(superuser!) });
      }

      const user = await storage.getUserByEmail(email, req.tenant?.id);
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
        await sendVerificationEmail(user.email, user.firstName, verificationToken, req.tenant?.name);
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
        await sendPasswordResetEmail(user.email, user.firstName, resetToken, req.tenant?.name);
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

  // ========== STRIPE ROUTES ==========

  app.post("/api/stripe/checkout", requireAuth, requireVerified, async (req, res) => {
    try {
      const user = (req as any).user as User;
      
      if (user.subscriptionStatus === "active" && (user.stripeSubscriptionId || user.payfastToken)) {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        await storage.updateUserSubscription(user.id, { stripeCustomerId: customerId });
      }

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'zar',
            product_data: {
              name: 'ScribeAI Monthly Subscription',
              description: 'Full access to AI transcription, summaries, action items, and more',
            },
            unit_amount: 19900,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${baseUrl}/subscription/success`,
        cancel_url: `${baseUrl}/subscription/cancel`,
        metadata: { userId: String(user.id) },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }

      const payload = (req as any).rawBody;
      if (!payload) {
        console.error("Stripe webhook: rawBody is missing");
        return res.status(400).json({ error: 'Missing raw body' });
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } else {
        console.warn("STRIPE WEBHOOK: No STRIPE_WEBHOOK_SECRET set — using raw parse (dev only)");
        event = JSON.parse(typeof payload === 'string' ? payload : payload.toString());
      }

      console.log(`Stripe webhook received: ${event.type}`);

      const findUserByCustomerId = async (customerId: string) => {
        const allUsers = await storage.getAllUsers();
        return allUsers.find(u => u.stripeCustomerId === customerId);
      };

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = parseInt(session.metadata?.userId);
          if (userId && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const periodEnd = new Date((subscription as any).current_period_end * 1000);
            await storage.updateUserSubscription(userId, {
              subscriptionStatus: "active",
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              subscriptionCurrentPeriodEnd: periodEnd,
              cancelledAt: null,
            });
            console.log(`Stripe: User ${userId} subscription activated`);
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription as string;
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const periodEnd = new Date((subscription as any).current_period_end * 1000);
            const matchedUser = await findUserByCustomerId(invoice.customer as string);
            if (matchedUser) {
              await storage.updateUserSubscription(matchedUser.id, {
                subscriptionStatus: "active",
                subscriptionCurrentPeriodEnd: periodEnd,
                cancelledAt: null,
              });
              console.log(`Stripe: User ${matchedUser.id} subscription renewed`);
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const matchedUser = await findUserByCustomerId(invoice.customer as string);
          if (matchedUser) {
            console.log(`Stripe: User ${matchedUser.id} payment failed for invoice ${invoice.id}`);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const matchedUser = await findUserByCustomerId(subscription.customer as string);
          if (matchedUser) {
            const periodEnd = new Date((subscription as any).current_period_end * 1000);
            if (subscription.cancel_at_period_end) {
              await storage.updateUserSubscription(matchedUser.id, {
                subscriptionStatus: "cancelled",
                subscriptionCurrentPeriodEnd: periodEnd,
                cancelledAt: new Date(),
              });
              console.log(`Stripe: User ${matchedUser.id} subscription set to cancel at period end`);
            } else if ((subscription as any).status === 'active') {
              await storage.updateUserSubscription(matchedUser.id, {
                subscriptionStatus: "active",
                subscriptionCurrentPeriodEnd: periodEnd,
                cancelledAt: null,
              });
              console.log(`Stripe: User ${matchedUser.id} subscription updated (active)`);
            }
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const matchedUser = await findUserByCustomerId(subscription.customer as string);
          if (matchedUser) {
            await storage.updateUserSubscription(matchedUser.id, {
              subscriptionStatus: "expired",
              cancelledAt: matchedUser.cancelledAt || new Date(),
            });
            console.log(`Stripe: User ${matchedUser.id} subscription expired/deleted`);
          }
          break;
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  app.post("/api/stripe/cancel", requireAuth, requireVerified, async (req, res) => {
    try {
      const user = (req as any).user as User;
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active Stripe subscription to cancel" });
      }

      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: "cancelled",
        cancelledAt: new Date(),
      });

      res.json({ message: "Subscription cancelled. You'll retain access until the end of your billing period." });
    } catch (error: any) {
      console.error("Stripe cancel error:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ========== SUBSCRIPTION STATUS ==========

  app.get("/api/subscription/status", requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const effectiveStatus = getEffectiveSubscriptionStatus(user);

    let provider: "payfast" | "stripe" | "none" = "none";
    if (user.stripeSubscriptionId && (user.subscriptionStatus === "active" || user.subscriptionStatus === "cancelled")) {
      provider = "stripe";
    } else if (user.payfastToken && (user.subscriptionStatus === "active" || user.subscriptionStatus === "cancelled")) {
      provider = "payfast";
    }

    res.json({
      status: effectiveStatus,
      trialEndsAt: user.trialEndsAt,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      cancelledAt: user.cancelledAt,
      hasFullAccess: hasFullAccess(user),
      provider,
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
      if (!meeting) return res.status(404).json({ message: "Session not found" });
      const updated = await storage.updateMeetingStatus(id, status);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // ========== TENANT BRANDING (PUBLIC) ==========

  app.get("/api/tenant/branding", async (req, res) => {
    const tenant = req.tenant;
    if (!tenant) {
      return res.json({ name: "ScribeAI", tagline: "Session transcription & analysis", logoUrl: null, primaryColor: null, accentColor: null });
    }
    res.json({
      name: tenant.name,
      tagline: tenant.tagline || "Session transcription & analysis",
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
    });
  });

  // ========== TENANT MANAGEMENT (SUPERUSER) ==========

  app.get("/api/tenants", requireAuth, requireVerified, requireSuperuser, async (_req, res) => {
    const tenantList = await storage.getTenants();
    res.json(tenantList);
  });

  app.post("/api/tenants", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const input = z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
        domain: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        primaryColor: z.string().nullable().optional(),
        accentColor: z.string().nullable().optional(),
        tagline: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      const tenant = await storage.createTenant({
        ...input,
        domain: input.domain || null,
        logoUrl: input.logoUrl || null,
        primaryColor: input.primaryColor || null,
        accentColor: input.accentColor || null,
        tagline: input.tagline || null,
        isActive: input.isActive ?? true,
      });
      invalidateTenantCache();
      res.status(201).json(tenant);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A tenant with that slug or domain already exists" });
      throw err;
    }
  });

  app.patch("/api/tenants/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTenant(id);
    if (!existing) return res.status(404).json({ message: "Tenant not found" });
    try {
      const data = z.object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
        domain: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        primaryColor: z.string().nullable().optional(),
        accentColor: z.string().nullable().optional(),
        tagline: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      const updated = await storage.updateTenant(id, data);
      invalidateTenantCache();
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A tenant with that slug or domain already exists" });
      throw err;
    }
  });

  app.delete("/api/tenants/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTenant(id);
    if (!existing) return res.status(404).json({ message: "Tenant not found" });
    if (existing.slug === "default") return res.status(400).json({ message: "Cannot deactivate the default tenant" });
    await storage.updateTenant(id, { isActive: false });
    invalidateTenantCache();
    res.json({ message: "Tenant deactivated" });
  });

  // ========== SUPERUSER USER ROUTES ==========

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
        subscriptionStatus: z.enum(["none", "trialing", "active", "cancelled", "expired", "lifetime"]).optional(),
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
    const userIdFilter = req.query.userId ? Number(req.query.userId) : null;
    if (userIdFilter) {
      res.json(allMeetings.filter(m => m.userId === userIdFilter));
    } else {
      res.json(allMeetings);
    }
  });

  app.get("/api/superuser/users/:id/clients", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const userId = Number(req.params.id);
    const allClients = await storage.getAllClients();
    res.json(allClients.filter(c => c.userId === userId));
  });

  app.get("/api/superuser/meetings/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Session not found" });
    const transcript = await storage.getTranscript(id);
    const actionItemsList = await storage.getActionItems(id);
    const topicsList = await storage.getTopics(id);
    const summary = await storage.getSummary(id);
    res.json({ ...meeting, transcript, actionItems: actionItemsList, topics: topicsList, summary });
  });

  app.delete("/api/superuser/meetings/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Session not found" });
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  app.get("/api/superuser/templates", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const templateList = await storage.getTemplatesWithTenants();
    res.json(templateList);
  });

  app.post("/api/superuser/templates", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { name, description, formatPrompt, isDefault, analysisModel, tenantIds } = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        formatPrompt: z.string().min(1),
        isDefault: z.boolean().optional(),
        analysisModel: z.string().nullable().optional(),
        tenantIds: z.array(z.number()).optional(),
      }).parse(req.body);
      const user = (req as any).user as User;
      const template = await storage.createTemplate({
        name, description: description || null, formatPrompt, isDefault: isDefault || false, analysisModel: analysisModel || null, createdBy: user.id, tenantId: null,
      });
      if (tenantIds && tenantIds.length > 0) {
        await storage.setTemplateTenants(template.id, tenantIds);
      }
      const tIds = await storage.getTemplateTenantIds(template.id);
      res.status(201).json({ ...template, tenantIds: tIds });
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
      const { tenantIds, ...data } = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        formatPrompt: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
        analysisModel: z.string().nullable().optional(),
        tenantIds: z.array(z.number()).optional(),
      }).parse(req.body);
      const updated = await storage.updateTemplate(id, data);
      if (tenantIds !== undefined) {
        await storage.setTemplateTenants(id, tenantIds);
      }
      const tIds = await storage.getTemplateTenantIds(id);
      res.json({ ...updated, tenantIds: tIds });
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
      const role = await storage.createRole({ name, tenantId: req.tenant?.id ?? null });
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

  // ========== AUDIO LANGUAGE OPTIONS (SUPERUSER CRUD) ==========

  app.get("/api/superuser/audio-language-options", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const opts = await storage.getAudioLanguageOptions();
    res.json(opts);
  });

  app.post("/api/superuser/audio-language-options", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const data = z.object({
        code: z.string().min(1, "Language code is required"),
        label: z.string().min(1, "Label is required"),
        normalize: z.boolean().default(false),
        normalizationPrompt: z.string().nullable().optional(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      }).parse(req.body);
      const opt = await storage.createAudioLanguageOption(data);
      res.status(201).json(opt);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A language option with that code already exists" });
      throw err;
    }
  });

  app.patch("/api/superuser/audio-language-options/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getAudioLanguageOption(id);
    if (!existing) return res.status(404).json({ message: "Language option not found" });
    try {
      const data = z.object({
        code: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        normalize: z.boolean().optional(),
        normalizationPrompt: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      const updated = await storage.updateAudioLanguageOption(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if ((err as any)?.code === "23505") return res.status(400).json({ message: "A language option with that code already exists" });
      throw err;
    }
  });

  app.delete("/api/superuser/audio-language-options/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getAudioLanguageOption(id);
    if (!existing) return res.status(404).json({ message: "Language option not found" });
    await storage.deleteAudioLanguageOption(id);
    res.status(204).send();
  });

  // ========== PROMPT SETTINGS (SUPERUSER) ==========

  app.get("/api/superuser/prompt-settings", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const settings = await storage.getPromptSettings();
      res.json(settings);
    } catch (err) {
      console.error("Error fetching prompt settings:", err);
      res.status(500).json({ message: "Failed to fetch prompt settings" });
    }
  });

  app.patch("/api/superuser/prompt-settings/:key", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const key = req.params.key;
      const { value } = z.object({ value: z.string().min(1) }).parse(req.body);
      const existing = await storage.getPromptSettingByKey(key);
      if (!existing) return res.status(404).json({ message: `Prompt setting "${key}" not found` });
      const updated = await storage.upsertPromptSetting(key, value);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Error updating prompt setting:", err);
      res.status(500).json({ message: "Failed to update prompt setting" });
    }
  });

  app.post("/api/superuser/prompt-settings/:key/reset", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const key = req.params.key;
      const reset = await storage.resetPromptSettingToDefault(key);
      if (!reset) return res.status(404).json({ message: "Prompt setting not found" });
      res.json(reset);
    } catch (err) {
      console.error("Error resetting prompt setting:", err);
      res.status(500).json({ message: "Failed to reset prompt setting" });
    }
  });

  // ========== SYSTEM SETTINGS ==========

  app.get("/api/superuser/system-settings", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (err) {
      console.error("Error fetching system settings:", err);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.patch("/api/superuser/system-settings/:key", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "string") return res.status(400).json({ message: "value is required" });
      const updated = await storage.upsertSystemSetting(req.params.key, value);
      res.json(updated);
    } catch (err) {
      console.error("Error updating system setting:", err);
      res.status(500).json({ message: "Failed to update system setting" });
    }
  });

  // ========== LLM REGISTRY ==========

  app.get("/api/superuser/llm-models", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { getLlmRegistryWithAvailability } = await import("./llmRegistry");
      res.json(getLlmRegistryWithAvailability());
    } catch (err) {
      console.error("Error fetching LLM registry:", err);
      res.status(500).json({ message: "Failed to fetch LLM models" });
    }
  });

  // ========== AUDIO LANGUAGE OPTIONS (PUBLIC) ==========

  app.get("/api/audio-language-options", requireAuth, async (req, res) => {
    const opts = await storage.getAudioLanguageOptions(true);
    res.json(opts);
  });

  // ========== ROLES (PUBLIC) ==========

  app.get("/api/roles", requireAuth, requireVerified, async (req, res) => {
    const roleList = await storage.getRoles(req.tenant?.id);
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
    const templateList = await storage.getTemplates(req.tenant?.id);
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

  app.post("/api/templates", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    try {
      const { name, description, formatPrompt, isDefault, tenantIds } = z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        formatPrompt: z.string().min(1, "Format prompt is required"),
        isDefault: z.boolean().optional(),
        tenantIds: z.array(z.number()).optional(),
      }).parse(req.body);

      const user = (req as any).user as User;
      const template = await storage.createTemplate({
        name,
        description: description || null,
        formatPrompt,
        isDefault: isDefault || false,
        createdBy: user.id,
        tenantId: null,
      });
      if (tenantIds && tenantIds.length > 0) {
        await storage.setTemplateTenants(template.id, tenantIds);
      }
      const tIds = await storage.getTemplateTenantIds(template.id);
      res.status(201).json({ ...template, tenantIds: tIds });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/templates/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    try {
      const { tenantIds, ...data } = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        formatPrompt: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
        tenantIds: z.array(z.number()).optional(),
      }).parse(req.body);

      const updated = await storage.updateTemplate(id, data);
      if (tenantIds !== undefined) {
        await storage.setTemplateTenants(id, tenantIds);
      }
      const tIds = await storage.getTemplateTenantIds(id);
      res.json({ ...updated, tenantIds: tIds });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/templates/:id", requireAuth, requireVerified, requireSuperuser, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }
    await storage.deleteTemplate(id);
    res.status(204).send();
  });

  // ========== MEETING CONTEXT ROUTES ==========

  app.patch("/api/meetings/:id/title", requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
    }
    try {
      const { title } = z.object({ title: z.string().min(1).max(200) }).parse(req.body);
      const updated = await storage.updateMeetingTitle(id, title);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/meetings/:id/context", requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
    }
    try {
      const data = z.object({
        contextText: z.string().nullable().optional(),
        templateId: z.number().nullable().optional(),
        includePreviousContext: z.boolean().optional(),
        outputLanguage: z.enum(["en", "af"]).optional(),
        audioLanguage: z.string().optional(),
        isInternal: z.boolean().optional(),
        clientRecordingConsent: z.enum(["not_asked", "yes", "no"]).optional(),
        detailLevel: z.enum(["high", "medium", "low"]).optional(),
      }).parse(req.body);

      const updated = await storage.updateMeetingContext(id, data);

      if (data.audioLanguage && data.audioLanguage !== meeting.audioLanguage) {
        await storage.deleteTranscriptForMeeting(id);
        console.log(`[context] Audio language changed for meeting ${id}: ${meeting.audioLanguage} → ${data.audioLanguage}. Transcript cleared for re-transcription.`);
      }

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
      return res.status(404).json({ message: "Session not found" });
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
      const client = await storage.createClient({ ...input, userId: user.id, tenantId: req.tenant?.id ?? null });
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
      return res.status(404).json({ message: "Session not found" });
    }
    const linkedPolicies = await storage.getMeetingPolicies(meetingId);
    res.json(linkedPolicies);
  });

  app.put(api.policies.setMeetingPolicies.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const meetingId = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
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

  // ========== ACTION ITEM ROUTES ==========

  app.get(api.actionItems.listByClient.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = (req as any).user as User;
    const client = await storage.getClient(clientId);
    if (!client || client.userId !== user.id) {
      return res.status(404).json({ message: "Client not found" });
    }
    const items = await storage.getClientActionItems(clientId, user.id);
    res.json(items);
  });

  app.patch(api.actionItems.updateStatus.path, requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = api.actionItems.updateStatus.input.parse(req.body);
    const user = (req as any).user as User;
    const existing = await storage.getActionItem(id);
    if (!existing) {
      return res.status(404).json({ message: "Action item not found" });
    }
    const meeting = await storage.getMeeting(existing.meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Action item not found" });
    }
    const updated = await storage.updateActionItemStatus(id, status);
    res.json(updated);
  });

  app.post(api.actionItems.create.path, requireAuth, requireVerified, async (req, res) => {
    const meetingId = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
    }
    const { content, assignee } = api.actionItems.create.input.parse(req.body);
    const item = await storage.createActionItem({
      meetingId,
      content,
      assignee: assignee || null,
      status: "pending",
      isManual: true,
    });
    res.status(201).json(item);
  });

  app.delete(api.actionItems.delete.path, requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const existing = await storage.getActionItem(id);
    if (!existing) {
      return res.status(404).json({ message: "Action item not found" });
    }
    if (!existing.isManual) {
      return res.status(400).json({ message: "Only manual tasks can be deleted" });
    }
    const meeting = await storage.getMeeting(existing.meetingId);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Action item not found" });
    }
    await storage.deleteActionItem(id);
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
      return res.status(404).json({ message: "Session not found" });
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
      const meeting = await storage.createMeeting({ ...input, userId: user.id, userRole, tenantId: req.tenant?.id ?? null });
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.post("/api/meetings/:id/audio/request-url", requireAuth, requireVerified, async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting || existingMeeting.userId !== user.id) {
          return res.status(404).json({ message: "Session not found" });
      }
      try {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        res.json({ uploadURL, objectPath });
      } catch (error) {
        console.error("Error generating audio upload URL:", error);
        res.status(500).json({ message: "Failed to generate upload URL" });
      }
  });

  app.post("/api/meetings/:id/audio/confirm", requireAuth, requireVerified, async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting || existingMeeting.userId !== user.id) {
          return res.status(404).json({ message: "Session not found" });
      }
      const { objectPath, fileName } = req.body;
      if (!objectPath) {
          return res.status(400).json({ message: "Missing objectPath" });
      }
      try {
        const ext = path.extname(fileName || objectPath).toLowerCase();
        const needsConversion = [".webm", ".mp4", ".m4a", ".ogg", ".aac", ".caf"].includes(ext);

        if (needsConversion) {
          let audioBuffer = await downloadBufferFromObjectStorage(objectPath);
          audioBuffer = await convertAudioToWav(audioBuffer, ext);
          const wavPath = await uploadBufferToObjectStorage(audioBuffer, ".wav", "audio/wav");
          await storage.updateMeetingAudioUrl(id, wavPath);
        } else {
          await storage.updateMeetingAudioUrl(id, objectPath);
        }

        res.json({ message: "Audio uploaded successfully" });
      } catch (error) {
        console.error("Error confirming audio upload:", error);
        res.status(500).json({ message: "Failed to process audio" });
      }
  });

  app.post("/api/meetings/:id/audio", requireAuth, requireVerified, upload.single('audio'), async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting || existingMeeting.userId !== user.id) {
          return res.status(404).json({ message: "Session not found" });
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
        
        const needsConversion = mimetype.includes("webm") || ext === ".webm"
            || mimetype.includes("mp4") || ext === ".mp4" || ext === ".m4a"
            || mimetype.includes("ogg") || ext === ".ogg"
            || mimetype.includes("aac") || ext === ".aac"
            || mimetype.includes("caf") || ext === ".caf";
        if (needsConversion) {
            audioBuffer = await convertAudioToWav(audioBuffer, ext || undefined);
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

  app.post("/api/meetings/:id/transcript", requireAuth, requireVerified, upload.single('file'), async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(id);

      if (!meeting || meeting.userId !== user.id) {
          return res.status(404).json({ message: "Session not found" });
      }

      let transcriptContent: string | null = null;

      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext === ".docx") {
          try {
            const buffer = fs.readFileSync(req.file.path);
            const result = await mammoth.extractRawText({ buffer });
            transcriptContent = result.value;
          } catch (err) {
            console.error("Error parsing .docx file:", err);
            return res.status(400).json({ message: "Failed to parse .docx file" });
          } finally {
            try { fs.unlinkSync(req.file.path); } catch {}
          }
        } else {
          try {
            transcriptContent = fs.readFileSync(req.file.path, "utf-8");
          } catch {
            return res.status(400).json({ message: "Failed to read uploaded file" });
          } finally {
            try { fs.unlinkSync(req.file.path); } catch {}
          }
        }
      } else {
        const { content } = req.body;
        if (content && typeof content === "string") {
          transcriptContent = content;
        }
      }

      if (!transcriptContent || !transcriptContent.trim()) {
          return res.status(400).json({ message: "Transcript content is required" });
      }

      const existing = await storage.getTranscript(id);
      if (existing) {
          await storage.clearTranscript(id);
      }

      await storage.createTranscript({
          meetingId: id,
          content: transcriptContent.trim(),
          language: "en",
      });

      res.json({ message: "Transcript saved" });
  });

  app.post("/api/meetings/:id/process", requireAuth, requireVerified, requireSubscription, async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user as User;
      const meeting = await storage.getMeeting(id);
      
      if (!meeting || meeting.userId !== user.id) {
          return res.status(404).json({ message: "Session not found" });
      }

      const existingTranscript = await storage.getTranscript(id);
      const hasTranscript = !!existingTranscript;

      if (!meeting.audioUrl && !hasTranscript) {
          return res.status(400).json({ message: "No audio or transcript available for this meeting" });
      }

      try {
          await processMeetingCore(id);
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
      return res.status(404).json({ message: "Session not found" });
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
      text: meeting.title || "Session Report",
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
    const filename = (meeting.title || "Session Report").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
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
      return res.status(404).json({ message: "Session not found" });
    }
    if (meeting.status !== "completed") {
      return res.status(400).json({ message: "Session has not been processed yet" });
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
          return res.status(404).json({ message: "Session not found" });
      }

      const transcript = await storage.getTranscript(id);
      if (!transcript && !meeting.audioUrl) {
          return res.status(400).json({ message: "No audio or transcript available. Process the session first." });
      }

      res.json({ message: "Reprocessing started", status: "processing" });

      processMeetingCore(id)
        .then(() => console.log(`[reprocess] Meeting ${id} reprocessed successfully`))
        .catch(async (error) => {
          console.error("Reprocessing error:", error);
          await storage.updateMeetingStatus(id, "failed");
        });
  });

  app.patch(api.meetings.updateClient.path, requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
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

  app.post("/api/meetings/:id/merge", requireAuth, requireVerified, requireSubscription, async (req, res) => {
    const targetId = Number(req.params.id);
    const user = (req as any).user as User;
    const tenant = (req as any).tenant as Tenant;

    const parsed = z.object({
      sourceIds: z.array(z.number()).min(1, "At least one source session is required"),
    }).parse(req.body);
    const sourceIds = [...new Set(parsed.sourceIds)].filter(id => id !== targetId);

    const targetMeeting = await storage.getMeeting(targetId);
    if (!targetMeeting || targetMeeting.userId !== user.id) {
      return res.status(404).json({ message: "Target session not found" });
    }
    if (targetMeeting.tenantId !== tenant.id && !user.isSuperuser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const sourceMeetings = [];
    for (const srcId of sourceIds) {
      const srcMeeting = await storage.getMeeting(srcId);
      if (!srcMeeting || srcMeeting.userId !== user.id) {
        return res.status(404).json({ message: `Source session ${srcId} not found` });
      }
      if (srcMeeting.tenantId !== tenant.id && !user.isSuperuser) {
        return res.status(403).json({ message: `Source session ${srcId} belongs to a different tenant` });
      }
      sourceMeetings.push(srcMeeting);
    }

    if (sourceMeetings.length === 0) {
      return res.status(400).json({ message: "No valid source sessions to merge" });
    }

    try {
      const targetTranscript = await storage.getTranscript(targetId);
      let combinedTranscriptContent = targetTranscript?.content || "";

      for (const src of sourceMeetings) {
        const srcTranscript = await storage.getTranscript(src.id);
        if (srcTranscript?.content) {
          combinedTranscriptContent += `\n\n--- Merged from: ${src.title} (${new Date(src.date).toLocaleDateString()}) ---\n\n${srcTranscript.content}`;
        }

        const srcActionItems = await storage.getActionItems(src.id);
        for (const item of srcActionItems) {
          await storage.createActionItem({
            meetingId: targetId,
            content: item.content,
            assignee: item.assignee,
            status: item.status,
          });
        }

        const srcTopics = await storage.getTopics(src.id);
        for (const topic of srcTopics) {
          await storage.createTopic({
            meetingId: targetId,
            name: topic.name,
            relevance: topic.relevance,
          });
        }
      }

      if (combinedTranscriptContent.trim()) {
        await storage.clearTranscript(targetId);
        await storage.createTranscript({
          meetingId: targetId,
          content: combinedTranscriptContent,
          language: targetTranscript?.language || "en",
        });
      }

      for (const src of sourceMeetings) {
        await storage.deleteMeeting(src.id);
      }

      await storage.updateMeetingStatus(targetId, "processing");
      res.json({ message: "Sessions merged. Reprocessing started.", meetingId: targetId });

      processMeetingCore(targetId)
        .then(() => console.log(`[merge] Meeting ${targetId} reprocessed after merge`))
        .catch(async (error) => {
          console.error("[merge] Reprocessing error after merge:", error);
          await storage.updateMeetingStatus(targetId, "failed");
        });
    } catch (err) {
      console.error("[merge] Error merging sessions:", err);
      res.status(500).json({ message: "Failed to merge sessions" });
    }
  });

  app.delete(api.meetings.delete.path, requireAuth, requireVerified, async (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    const meeting = await storage.getMeeting(id);
    if (!meeting || meeting.userId !== user.id) {
      return res.status(404).json({ message: "Session not found" });
    }
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  return httpServer;
}
