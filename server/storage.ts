import { db } from "./db";
import { 
    clients, meetings, transcripts, actionItems, topics, meetingSummaries,
    type InsertClient, type InsertMeeting, type InsertTranscript, type InsertActionItem, type InsertTopic, type InsertMeetingSummary,
    type Client, type Meeting, type Transcript, type ActionItem, type Topic, type MeetingSummary
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
    // Clients
    getClients(): Promise<Client[]>;
    getClient(id: number): Promise<Client | undefined>;
    createClient(client: InsertClient): Promise<Client>;
    deleteClient(id: number): Promise<void>;

    // Meetings
    getMeetings(): Promise<Meeting[]>;
    getMeetingsByClient(clientId: number): Promise<Meeting[]>;
    getMeeting(id: number): Promise<Meeting | undefined>;
    createMeeting(meeting: InsertMeeting): Promise<Meeting>;
    updateMeetingStatus(id: number, status: "uploading" | "processing" | "completed" | "failed"): Promise<Meeting>;
    updateMeetingAudioUrl(id: number, audioUrl: string): Promise<Meeting>;
    deleteMeeting(id: number): Promise<void>;

    // Transcripts
    getTranscript(meetingId: number): Promise<Transcript | undefined>;
    createTranscript(transcript: InsertTranscript): Promise<Transcript>;

    // Action Items
    getActionItems(meetingId: number): Promise<ActionItem[]>;
    createActionItem(item: InsertActionItem): Promise<ActionItem>;

    // Topics
    getTopics(meetingId: number): Promise<Topic[]>;
    createTopic(topic: InsertTopic): Promise<Topic>;

    // Summaries
    getSummary(meetingId: number): Promise<MeetingSummary | undefined>;
    createSummary(summary: InsertMeetingSummary): Promise<MeetingSummary>;
}

export class DatabaseStorage implements IStorage {
    // Clients
    async getClients(): Promise<Client[]> {
        return await db.select().from(clients).orderBy(clients.name);
    }

    async getClient(id: number): Promise<Client | undefined> {
        const [client] = await db.select().from(clients).where(eq(clients.id, id));
        return client;
    }

    async createClient(insertClient: InsertClient): Promise<Client> {
        const [client] = await db.insert(clients).values(insertClient).returning();
        return client;
    }

    async deleteClient(id: number): Promise<void> {
        await db.delete(clients).where(eq(clients.id, id));
    }

    // Meetings
    async getMeetings(): Promise<Meeting[]> {
        return await db.select().from(meetings).orderBy(meetings.createdAt);
    }

    async getMeetingsByClient(clientId: number): Promise<Meeting[]> {
        return await db.select().from(meetings).where(eq(meetings.clientId, clientId)).orderBy(meetings.createdAt);
    }

    async getMeeting(id: number): Promise<Meeting | undefined> {
        const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
        return meeting;
    }

    async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
        const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
        return meeting;
    }

    async updateMeetingStatus(id: number, status: "uploading" | "processing" | "completed" | "failed"): Promise<Meeting> {
        const [meeting] = await db.update(meetings)
            .set({ status })
            .where(eq(meetings.id, id))
            .returning();
        return meeting;
    }

    async updateMeetingAudioUrl(id: number, audioUrl: string): Promise<Meeting> {
        const [meeting] = await db.update(meetings)
            .set({ audioUrl, status: "processing" })
            .where(eq(meetings.id, id))
            .returning();
        return meeting;
    }

    async deleteMeeting(id: number): Promise<void> {
        await db.delete(meetings).where(eq(meetings.id, id));
    }

    // Transcripts
    async getTranscript(meetingId: number): Promise<Transcript | undefined> {
        const [transcript] = await db.select().from(transcripts).where(eq(transcripts.meetingId, meetingId));
        return transcript;
    }

    async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
        const [transcript] = await db.insert(transcripts).values(insertTranscript).returning();
        return transcript;
    }

    // Action Items
    async getActionItems(meetingId: number): Promise<ActionItem[]> {
        return await db.select().from(actionItems).where(eq(actionItems.meetingId, meetingId));
    }

    async createActionItem(insertItem: InsertActionItem): Promise<ActionItem> {
        const [item] = await db.insert(actionItems).values(insertItem).returning();
        return item;
    }

    // Topics
    async getTopics(meetingId: number): Promise<Topic[]> {
        return await db.select().from(topics).where(eq(topics.meetingId, meetingId));
    }

    async createTopic(insertTopic: InsertTopic): Promise<Topic> {
        const [topic] = await db.insert(topics).values(insertTopic).returning();
        return topic;
    }

    // Summaries
    async getSummary(meetingId: number): Promise<MeetingSummary | undefined> {
        const [summary] = await db.select().from(meetingSummaries).where(eq(meetingSummaries.meetingId, meetingId));
        return summary;
    }

    async createSummary(insertSummary: InsertMeetingSummary): Promise<MeetingSummary> {
        const [summary] = await db.insert(meetingSummaries).values(insertSummary).returning();
        return summary;
    }
}

export const storage = new DatabaseStorage();
