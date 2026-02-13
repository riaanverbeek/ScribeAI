import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { speechToText, convertWebmToWav } from "./replit_integrations/audio";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Setup multer for file uploads
const upload = multer({ dest: "uploads/" });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed data on startup
  await seedDatabase();

  app.use("/uploads", express.static(path.resolve("uploads")));

  // === CLIENT ROUTES ===

  app.get(api.clients.list.path, async (req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get(api.clients.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    const clientMeetings = await storage.getMeetingsByClient(id);
    res.json({ ...client, meetings: clientMeetings });
  });

  app.post(api.clients.create.path, async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.clients.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    await storage.deleteClient(id);
    res.status(204).send();
  });

  // === MEETING ROUTES ===

  // GET /api/meetings
  app.get(api.meetings.list.path, async (req, res) => {
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    if (clientId) {
      const filtered = await storage.getMeetingsByClient(clientId);
      return res.json(filtered);
    }
    const allMeetings = await storage.getMeetings();
    res.json(allMeetings);
  });

  // GET /api/meetings/:id
  app.get(api.meetings.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    
    const transcript = await storage.getTranscript(id);
    const actionItems = await storage.getActionItems(id);
    const topics = await storage.getTopics(id);
    const summary = await storage.getSummary(id);

    res.json({
        ...meeting,
        transcript,
        actionItems,
        topics,
        summary
    });
  });

  // POST /api/meetings
  app.post(api.meetings.create.path, async (req, res) => {
    try {
      const input = api.meetings.create.input.parse(req.body);
      const meeting = await storage.createMeeting(input);
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // POST /api/meetings/:id/audio
  app.post("/api/meetings/:id/audio", upload.single('audio'), async (req, res) => {
      const id = Number(req.params.id);
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

  // POST /api/meetings/:id/process
  app.post("/api/meetings/:id/process", async (req, res) => {
      const id = Number(req.params.id);
      const meeting = await storage.getMeeting(id);
      
      if (!meeting) {
          return res.status(404).json({ message: "Meeting not found" });
      }
      if (!meeting.audioUrl) {
          return res.status(400).json({ message: "No audio uploaded for this meeting" });
      }

      // Start processing in background (or await if fast enough - for long audio, background job is better)
      // Here we await for simplicity in MVP, but this might time out for long files.
      // Ideally use a job queue.
      
      try {
          await storage.updateMeetingStatus(id, "processing");

          // 1. Transcribe
          const audioBuffer = fs.readFileSync(meeting.audioUrl);
          const audioExt = path.extname(meeting.audioUrl).toLowerCase();
          const format: "wav" | "mp3" | "webm" = audioExt === ".mp3" ? "mp3" : audioExt === ".webm" ? "webm" : "wav";
          const transcriptText = await speechToText(audioBuffer, format);
          
          await storage.createTranscript({
              meetingId: id,
              content: transcriptText,
              language: "en" 
          });

          // 2. Analyze with LLM
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

          // 3. Save results
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

  // PATCH /api/meetings/:id/client
  app.patch(api.meetings.updateClient.path, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) {
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

  // DELETE /api/meetings/:id
  app.delete(api.meetings.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  return httpServer;
}
