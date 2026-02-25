import { db } from "./db";
import { 
    users, clients, meetings, transcripts, actionItems, topics, meetingSummaries, templates, roles, policies, meetingPolicies,
    type InsertUser, type InsertClient, type InsertMeeting, type InsertTranscript, type InsertActionItem, type InsertTopic, type InsertMeetingSummary, type InsertTemplate, type InsertRole, type InsertPolicy, type InsertMeetingPolicy,
    type User, type Client, type Meeting, type Transcript, type ActionItem, type Topic, type MeetingSummary, type Template, type Role, type Policy, type MeetingPolicy
} from "@shared/schema";
import { eq, and, desc, lt, ne } from "drizzle-orm";

export interface IStorage {
    // Users
    getUserById(id: number): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    getUserByVerificationToken(token: string): Promise<User | undefined>;
    getUserByResetToken(token: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    verifyUser(id: number): Promise<User>;
    setVerificationToken(id: number, token: string, expiry: Date): Promise<void>;
    setResetToken(id: number, token: string, expiry: Date): Promise<void>;
    updatePassword(id: number, passwordHash: string): Promise<void>;
    clearResetToken(id: number): Promise<void>;
    updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt">>): Promise<User>;
    makeSuperuser(id: number): Promise<void>;
    getAllUsers(): Promise<User[]>;
    updateUser(id: number, data: Partial<Pick<User, "firstName" | "lastName" | "email" | "isAdmin" | "isSuperuser" | "isVerified" | "subscriptionStatus">>): Promise<User>;
    deleteUser(id: number): Promise<void>;
    getAllClients(): Promise<Client[]>;
    getAllMeetings(): Promise<Meeting[]>;
    updateClient(id: number, data: Partial<Pick<Client, "name" | "email" | "company">>): Promise<Client>;

    // Roles
    getRoles(): Promise<Role[]>;
    getRole(id: number): Promise<Role | undefined>;
    createRole(role: InsertRole): Promise<Role>;
    updateRole(id: number, data: { name: string }): Promise<Role>;
    deleteRole(id: number): Promise<void>;
    updateUserRole(userId: number, roleId: number | null, customRole: string | null): Promise<User>;

    // Templates
    getTemplates(): Promise<Template[]>;
    getTemplate(id: number): Promise<Template | undefined>;
    createTemplate(template: InsertTemplate): Promise<Template>;
    updateTemplate(id: number, data: Partial<Pick<Template, "name" | "description" | "formatPrompt" | "isDefault">>): Promise<Template>;
    deleteTemplate(id: number): Promise<void>;

    // Meetings - context
    updateMeetingContext(id: number, data: { contextText?: string | null; templateId?: number | null; includePreviousContext?: boolean; outputLanguage?: string; isInternal?: boolean; clientRecordingConsent?: string; detailLevel?: string }): Promise<Meeting>;
    updateMeetingContextFile(id: number, contextFileUrl: string, contextFileName: string): Promise<Meeting>;

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
    updateMeetingIncludePreviousContext(id: number, includePreviousContext: boolean): Promise<Meeting>;
    getPreviousClientMeetingSummaries(clientId: number, beforeMeetingId: number): Promise<{ title: string; summary: string; date: Date }[]>;
    deleteMeeting(id: number): Promise<void>;

    // Transcripts
    getTranscript(meetingId: number): Promise<Transcript | undefined>;
    createTranscript(transcript: InsertTranscript): Promise<Transcript>;

    // Action Items
    getActionItems(meetingId: number): Promise<ActionItem[]>;
    getClientActionItems(clientId: number, userId: number): Promise<(ActionItem & { meetingTitle: string; meetingDate: Date })[]>;
    getActionItem(id: number): Promise<ActionItem | undefined>;
    updateActionItemStatus(id: number, status: "pending" | "completed"): Promise<ActionItem>;
    createActionItem(item: InsertActionItem): Promise<ActionItem>;
    deleteActionItem(id: number): Promise<void>;

    // Topics
    getTopics(meetingId: number): Promise<Topic[]>;
    createTopic(topic: InsertTopic): Promise<Topic>;

    // Summaries
    getSummary(meetingId: number): Promise<MeetingSummary | undefined>;
    createSummary(summary: InsertMeetingSummary): Promise<MeetingSummary>;

    // Policies
    getPoliciesByClient(clientId: number): Promise<Policy[]>;
    getPolicy(id: number): Promise<Policy | undefined>;
    createPolicy(policy: InsertPolicy): Promise<Policy>;
    updatePolicy(id: number, data: Partial<Pick<Policy, "type" | "insurer" | "policyNumber" | "isActive">>): Promise<Policy>;
    deletePolicy(id: number): Promise<void>;

    // Meeting-Policy links
    getMeetingPolicies(meetingId: number): Promise<Policy[]>;
    setMeetingPolicies(meetingId: number, policyIds: number[]): Promise<void>;

    // Clear analysis data (for reprocessing)
    clearMeetingAnalysis(meetingId: number): Promise<void>;
    clearTranscript(meetingId: number): Promise<void>;
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
        trialEnd.setMonth(trialEnd.getMonth() + 1);
        const [user] = await db.update(users).set({
            isVerified: true,
            verificationToken: null,
            verificationTokenExpiry: null,
            subscriptionStatus: "trialing",
            trialEndsAt: trialEnd,
        }).where(eq(users.id, id)).returning();
        return user;
    }

    async getUserByResetToken(token: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.resetToken, token));
        return user;
    }

    async setVerificationToken(id: number, token: string, expiry: Date): Promise<void> {
        await db.update(users).set({ verificationToken: token, verificationTokenExpiry: expiry }).where(eq(users.id, id));
    }

    async setResetToken(id: number, token: string, expiry: Date): Promise<void> {
        await db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.id, id));
    }

    async updatePassword(id: number, passwordHash: string): Promise<void> {
        await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, id));
    }

    async clearResetToken(id: number): Promise<void> {
        await db.update(users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(users.id, id));
    }

    async updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt">>): Promise<User> {
        const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return user;
    }

    async makeSuperuser(id: number): Promise<void> {
        await db.update(users).set({ isSuperuser: true, isAdmin: true, isVerified: true, subscriptionStatus: "active" }).where(eq(users.id, id));
    }

    async getAllUsers(): Promise<User[]> {
        return await db.select().from(users).orderBy(desc(users.createdAt));
    }

    async updateUser(id: number, data: Partial<Pick<User, "firstName" | "lastName" | "email" | "isAdmin" | "isSuperuser" | "isVerified" | "subscriptionStatus">>): Promise<User> {
        const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return user;
    }

    async deleteUser(id: number): Promise<void> {
        await db.delete(users).where(eq(users.id, id));
    }

    async getAllClients(): Promise<Client[]> {
        return await db.select().from(clients).orderBy(clients.name);
    }

    async getAllMeetings(): Promise<Meeting[]> {
        return await db.select().from(meetings).orderBy(desc(meetings.createdAt));
    }

    async updateClient(id: number, data: Partial<Pick<Client, "name" | "email" | "company">>): Promise<Client> {
        const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
        return client;
    }

    // Roles
    async getRoles(): Promise<Role[]> {
        return await db.select().from(roles).orderBy(roles.name);
    }

    async getRole(id: number): Promise<Role | undefined> {
        const [role] = await db.select().from(roles).where(eq(roles.id, id));
        return role;
    }

    async createRole(insertRole: InsertRole): Promise<Role> {
        const [role] = await db.insert(roles).values(insertRole).returning();
        return role;
    }

    async updateRole(id: number, data: { name: string }): Promise<Role> {
        const [role] = await db.update(roles).set(data).where(eq(roles.id, id)).returning();
        return role;
    }

    async deleteRole(id: number): Promise<void> {
        await db.update(users).set({ roleId: null }).where(eq(users.roleId, id));
        await db.delete(roles).where(eq(roles.id, id));
    }

    async updateUserRole(userId: number, roleId: number | null, customRole: string | null): Promise<User> {
        const [user] = await db.update(users).set({ roleId, customRole }).where(eq(users.id, userId)).returning();
        return user;
    }

    // Templates
    async getTemplates(): Promise<Template[]> {
        return await db.select().from(templates).orderBy(desc(templates.createdAt));
    }

    async getTemplate(id: number): Promise<Template | undefined> {
        const [template] = await db.select().from(templates).where(eq(templates.id, id));
        return template;
    }

    async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
        const [template] = await db.insert(templates).values(insertTemplate).returning();
        return template;
    }

    async updateTemplate(id: number, data: Partial<Pick<Template, "name" | "description" | "formatPrompt" | "isDefault">>): Promise<Template> {
        const [template] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
        return template;
    }

    async deleteTemplate(id: number): Promise<void> {
        await db.delete(templates).where(eq(templates.id, id));
    }

    // Meetings - context
    async updateMeetingContext(id: number, data: { contextText?: string | null; templateId?: number | null; includePreviousContext?: boolean; outputLanguage?: string; isInternal?: boolean; clientRecordingConsent?: string; detailLevel?: string }): Promise<Meeting> {
        const [meeting] = await db.update(meetings).set(data).where(eq(meetings.id, id)).returning();
        return meeting;
    }

    async updateMeetingContextFile(id: number, contextFileUrl: string, contextFileName: string): Promise<Meeting> {
        const [meeting] = await db.update(meetings).set({ contextFileUrl, contextFileName }).where(eq(meetings.id, id)).returning();
        return meeting;
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

    async updateMeetingIncludePreviousContext(id: number, includePreviousContext: boolean): Promise<Meeting> {
        const [meeting] = await db.update(meetings)
            .set({ includePreviousContext })
            .where(eq(meetings.id, id))
            .returning();
        return meeting;
    }

    async getPreviousClientMeetingSummaries(clientId: number, currentMeetingId: number): Promise<{ title: string; summary: string; date: Date }[]> {
        const currentMeeting = await this.getMeeting(currentMeetingId);
        if (!currentMeeting) return [];

        const previousMeetings = await db.select({
            id: meetings.id,
            title: meetings.title,
            date: meetings.date,
            summaryContent: meetingSummaries.content,
        })
        .from(meetings)
        .innerJoin(meetingSummaries, eq(meetingSummaries.meetingId, meetings.id))
        .where(and(
            eq(meetings.clientId, clientId),
            eq(meetings.status, "completed"),
            ne(meetings.id, currentMeetingId),
            lt(meetings.date, currentMeeting.date)
        ))
        .orderBy(desc(meetings.date))
        .limit(5);

        return previousMeetings.map(m => ({
            title: m.title,
            summary: m.summaryContent,
            date: m.date,
        }));
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

    async getActionItem(id: number): Promise<ActionItem | undefined> {
        const [item] = await db.select().from(actionItems).where(eq(actionItems.id, id));
        return item;
    }

    async getClientActionItems(clientId: number, userId: number): Promise<(ActionItem & { meetingTitle: string; meetingDate: Date })[]> {
        const rows = await db
            .select({
                id: actionItems.id,
                meetingId: actionItems.meetingId,
                content: actionItems.content,
                assignee: actionItems.assignee,
                status: actionItems.status,
                meetingTitle: meetings.title,
                meetingDate: meetings.date,
            })
            .from(actionItems)
            .innerJoin(meetings, eq(actionItems.meetingId, meetings.id))
            .where(and(eq(meetings.clientId, clientId), eq(meetings.userId, userId)))
            .orderBy(desc(meetings.date));
        return rows as any;
    }

    async updateActionItemStatus(id: number, status: "pending" | "completed"): Promise<ActionItem> {
        const [item] = await db.update(actionItems).set({ status }).where(eq(actionItems.id, id)).returning();
        return item;
    }

    async createActionItem(insertItem: InsertActionItem): Promise<ActionItem> {
        const [item] = await db.insert(actionItems).values(insertItem).returning();
        return item;
    }

    async deleteActionItem(id: number): Promise<void> {
        await db.delete(actionItems).where(eq(actionItems.id, id));
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

    // Policies
    async getPoliciesByClient(clientId: number): Promise<Policy[]> {
        return await db.select().from(policies).where(eq(policies.clientId, clientId)).orderBy(policies.type);
    }

    async getPolicy(id: number): Promise<Policy | undefined> {
        const [policy] = await db.select().from(policies).where(eq(policies.id, id));
        return policy;
    }

    async createPolicy(insertPolicy: InsertPolicy): Promise<Policy> {
        const [policy] = await db.insert(policies).values(insertPolicy).returning();
        return policy;
    }

    async updatePolicy(id: number, data: Partial<Pick<Policy, "type" | "insurer" | "policyNumber" | "isActive">>): Promise<Policy> {
        const [policy] = await db.update(policies).set(data).where(eq(policies.id, id)).returning();
        return policy;
    }

    async deletePolicy(id: number): Promise<void> {
        await db.delete(policies).where(eq(policies.id, id));
    }

    // Meeting-Policy links
    async getMeetingPolicies(meetingId: number): Promise<Policy[]> {
        const rows = await db.select({ policy: policies })
            .from(meetingPolicies)
            .innerJoin(policies, eq(meetingPolicies.policyId, policies.id))
            .where(eq(meetingPolicies.meetingId, meetingId));
        return rows.map(r => r.policy);
    }

    async setMeetingPolicies(meetingId: number, policyIds: number[]): Promise<void> {
        await db.delete(meetingPolicies).where(eq(meetingPolicies.meetingId, meetingId));
        if (policyIds.length > 0) {
            await db.insert(meetingPolicies).values(policyIds.map(policyId => ({ meetingId, policyId })));
        }
    }

    async clearMeetingAnalysis(meetingId: number): Promise<void> {
        await db.delete(actionItems).where(and(eq(actionItems.meetingId, meetingId), eq(actionItems.isManual, false)));
        await db.delete(topics).where(eq(topics.meetingId, meetingId));
        await db.delete(meetingSummaries).where(eq(meetingSummaries.meetingId, meetingId));
    }

    async clearTranscript(meetingId: number): Promise<void> {
        await db.delete(transcripts).where(eq(transcripts.meetingId, meetingId));
    }
}

export const storage = new DatabaseStorage();
