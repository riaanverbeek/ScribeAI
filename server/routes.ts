import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import { speechToText } from "./replit_integrations/audio";
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

  // GET /api/meetings
  app.get(api.meetings.list.path, async (req, res) => {
    const meetings = await storage.getMeetings();
    res.json(meetings);
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
  app.post("/api/meetings/:id/audio", upload.single('file'), async (req, res) => {
      const id = Number(req.params.id);
      if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
      }
      
      // In a real app, upload to cloud storage (S3/GCS). 
      // For now, we'll keep the local path but move it to a public folder or just store the path.
      // Since Replit uploads are ephemeral, this is just for demo.
      const audioUrl = req.file.path; // TODO: Move to persistent storage
      
      const meeting = await storage.updateMeetingAudioUrl(id, audioUrl);
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
          const transcriptText = await speechToText(audioBuffer);
          
          await storage.createTranscript({
              meetingId: id,
              content: transcriptText,
              language: "en" // Could detect language
          });

          // 2. Analyze with GPT-4o
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
              model: "gpt-5.1",
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
