import { db } from "./db";
import { 
    users, clients, meetings, transcripts, actionItems, topics, meetingSummaries,
    type InsertUser, type InsertClient, type InsertMeeting, type InsertTranscript, type InsertActionItem, type InsertTopic, type InsertMeetingSummary,
    type User, type Client, type Meeting, type Transcript, type ActionItem, type Topic, type MeetingSummary
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
    // Users
    getUserById(id: number): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    getUserByVerificationToken(token: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    verifyUser(id: number): Promise<User>;
    updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt">>): Promise<User>;

    // Clients
    getClients(userId?: number): Promise<Client[]>;
    getClient(id: number): Promise<Client | undefined>;
    createClient(client: InsertClient): Promise<Client>;
    deleteClient(id: number): Promise<void>;

    // Meetings
    getMeetings(userId?: number): Promise<Meeting[]>;
    getMeetingsByClient(clientId: number): Promise<Meeting[]>;
    getMeeting(id: number): Promise<Meeting | undefined>;
    createMeeting(meeting: InsertMeeting): Promise<Meeting>;
    updateMeetingStatus(id: number, status: "uploading" | "processing" | "completed" | "failed"): Promise<Meeting>;
    updateMeetingAudioUrl(id: number, audioUrl: string): Promise<Meeting>;
    updateMeetingClient(id: number, clientId: number | null): Promise<Meeting>;
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
    // Users
    async getUserById(id: number): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }

    async getUserByEmail(email: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
        return user;
    }

    async getUserByVerificationToken(token: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
        return user;
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const [user] = await db.insert(users).values({
            ...insertUser,
            email: insertUser.email.toLowerCase(),
        }).returning();
        return user;
    }

    async verifyUser(id: number): Promise<User> {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        const [user] = await db.update(users).set({
            isVerified: true,
            verificationToken: null,
            verificationTokenExpiry: null,
            subscriptionStatus: "trialing",
            trialEndsAt: trialEnd,
        }).where(eq(users.id, id)).returning();
        return user;
    }

    async updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt">>): Promise<User> {
        const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return user;
    }

    // Clients
    async getClients(userId?: number): Promise<Client[]> {
        if (userId) {
            return await db.select().from(clients).where(eq(clients.userId, userId)).orderBy(clients.name);
        }
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
    async getMeetings(userId?: number): Promise<Meeting[]> {
        if (userId) {
            return await db.select().from(meetings).where(eq(meetings.userId, userId)).orderBy(meetings.createdAt);
        }
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

    async updateMeetingClient(id: number, clientId: number | null): Promise<Meeting> {
        const [meeting] = await db.update(meetings)
            .set({ clientId })
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
