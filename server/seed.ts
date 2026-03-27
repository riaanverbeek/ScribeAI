import { storage } from "./storage";

const DEFAULT_LANGUAGE_OPTIONS = [
  { code: "auto", label: "Auto-detect", sortOrder: 0, isActive: true },
  { code: "af", label: "Afrikaans / English (ZA)", sortOrder: 10, isActive: true },
  { code: "en", label: "English only", sortOrder: 20, isActive: true },
];

async function seedLanguageOptions() {
  const existing = await storage.getLanguageOptions();
  if (existing.length === 0) {
    for (const opt of DEFAULT_LANGUAGE_OPTIONS) {
      await storage.createLanguageOption(opt);
    }
    console.log("[seed] Default language options seeded.");
  }
}

export async function seedDatabase() {
  await seedLanguageOptions();

  const existingMeetings = await storage.getMeetings();
  if (existingMeetings.length === 0) {
    // Meeting 1: Product Strategy (Completed with full analysis)
    const meeting1 = await storage.createMeeting({
      title: "Q1 Product Strategy Review",
      date: new Date("2024-01-15T10:00:00Z"),
      audioUrl: "https://example.com/audio1.mp3",
    });
    
    // Manually set status to completed for seed data (hack since create defaults to uploading)
    await storage.updateMeetingStatus(meeting1.id, "completed");

    await storage.createTranscript({
      meetingId: meeting1.id,
      content: "John: Welcome everyone to the Q1 strategy review. The main focus today is our mobile app launch.\nSarah: I've updated the roadmap. We're targeting a beta release by mid-February.\nJohn: That sounds aggressive. Do we have the QA resources?\nMike: We might need to hire two more contractors for testing.\nSarah: Agreed. I'll open the requisitions today.",
      language: "en"
    });

    await storage.createActionItem({
      meetingId: meeting1.id,
      content: "Open requisitions for two QA contractors",
      assignee: "Sarah",
      status: "pending"
    });
    
    await storage.createActionItem({
        meetingId: meeting1.id,
        content: "Finalize beta feature list",
        assignee: "John",
        status: "completed"
    });

    await storage.createTopic({
        meetingId: meeting1.id,
        title: "Mobile App Launch",
        summary: "Targeting mid-February for beta. Resource constraints identified in QA.",
        relevanceScore: 95
    });

    await storage.createSummary({
        meetingId: meeting1.id,
        content: "The team agreed to target a mid-February beta launch for the mobile app. Key risks involve QA capacity, which will be addressed by hiring two new contractors immediately."
    });

    // Meeting 2: Weekly Standup (Processing)
    const meeting2 = await storage.createMeeting({
        title: "Engineering Weekly Standup",
        date: new Date("2024-01-22T09:00:00Z"),
        audioUrl: "https://example.com/audio2.mp3",
    });
    await storage.updateMeetingStatus(meeting2.id, "processing");

    // Meeting 3: Client Kickoff (New)
    await storage.createMeeting({
        title: "Acme Corp Kickoff",
        date: new Date(),
        audioUrl: undefined,
    });
  }
}
