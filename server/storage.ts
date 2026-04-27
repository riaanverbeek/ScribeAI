import { db } from "./db";
import { 
    users, clients, meetings, transcripts, actionItems, topics, meetingSummaries, templates, templateTenants, roles, policies, meetingPolicies, tenants, audioLanguageOptions, promptSettings, systemSettings, payfastItnEvents, payfastAuditLog,
    type InsertUser, type InsertClient, type InsertMeeting, type InsertTranscript, type InsertActionItem, type InsertTopic, type InsertMeetingSummary, type InsertTemplate, type InsertRole, type InsertPolicy, type InsertMeetingPolicy, type InsertTenant, type InsertAudioLanguageOption, type InsertPromptSetting,
    type User, type Client, type Meeting, type Transcript, type ActionItem, type Topic, type MeetingSummary, type Template, type TemplateWithTenants, type Role, type Policy, type MeetingPolicy, type Tenant, type AudioLanguageOption, type PromptSetting, type SystemSetting, type PayfastItnEvent, type PayfastAuditLog
} from "@shared/schema";
import { eq, and, desc, lt, ne, or, isNull, isNotNull, sql, inArray } from "drizzle-orm";

export interface IStorage {
    // Tenants
    getTenants(): Promise<Tenant[]>;
    getTenant(id: number): Promise<Tenant | undefined>;
    getTenantByDomain(domain: string): Promise<Tenant | undefined>;
    getTenantBySlug(slug: string): Promise<Tenant | undefined>;
    createTenant(tenant: InsertTenant): Promise<Tenant>;
    updateTenant(id: number, data: Partial<Pick<Tenant, "name" | "slug" | "domain" | "logoUrl" | "primaryColor" | "accentColor" | "tagline" | "isActive">>): Promise<Tenant>;

    // Users
    getUserById(id: number): Promise<User | undefined>;
    getUserByEmail(email: string, tenantId?: number): Promise<User | undefined>;
    getUserByVerificationToken(token: string): Promise<User | undefined>;
    getUserByResetToken(token: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;
    verifyUser(id: number): Promise<User>;
    setVerificationToken(id: number, token: string, expiry: Date): Promise<void>;
    setResetToken(id: number, token: string, expiry: Date): Promise<void>;
    updatePassword(id: number, passwordHash: string): Promise<void>;
    clearResetToken(id: number): Promise<void>;
    updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt" | "subscriptionPaymentFailedAt">>): Promise<User>;
    makeSuperuser(id: number): Promise<void>;
    getAllUsers(tenantId?: number): Promise<User[]>;
    getSuperusers(): Promise<User[]>;
    getPayfastAuditUsers(): Promise<User[]>;
    logPayfastItnEvent(data: { userId?: number | null; payfastToken?: string | null; paymentStatus: string; rawData?: string | null }): Promise<PayfastItnEvent>;
    logPayfastAuditRetry(data: { userId: number; attemptedBy: number; result: "ok" | "error"; detail?: string | null }): Promise<PayfastAuditLog>;
    getLatestPayfastAuditLogs(userIds: number[]): Promise<Map<number, PayfastAuditLog & { adminEmail: string }>>;
    updateUser(id: number, data: Partial<Pick<User, "firstName" | "lastName" | "email" | "isAdmin" | "isSuperuser" | "isVerified" | "subscriptionStatus">>): Promise<User>;
    deleteUser(id: number): Promise<void>;
    getAllClients(tenantId?: number): Promise<Client[]>;
    getAllMeetings(tenantId?: number): Promise<Meeting[]>;
    updateClient(id: number, data: Partial<Pick<Client, "name" | "email" | "company">>): Promise<Client>;

    // Roles
    getRoles(tenantId?: number): Promise<Role[]>;
    getRole(id: number): Promise<Role | undefined>;
    createRole(role: InsertRole): Promise<Role>;
    updateRole(id: number, data: { name: string }): Promise<Role>;
    deleteRole(id: number): Promise<void>;
    updateUserRole(userId: number, roleId: number | null, customRole: string | null): Promise<User>;

    // Templates
    getTemplates(tenantId?: number): Promise<Template[]>;
    getTemplate(id: number): Promise<Template | undefined>;
    createTemplate(template: InsertTemplate): Promise<Template>;
    updateTemplate(id: number, data: Partial<Pick<Template, "name" | "description" | "formatPrompt" | "isDefault" | "analysisModel">>): Promise<Template>;
    deleteTemplate(id: number): Promise<void>;
    getTemplateTenantIds(templateId: number): Promise<number[]>;
    setTemplateTenants(templateId: number, tenantIds: number[]): Promise<void>;
    getTemplatesWithTenants(): Promise<TemplateWithTenants[]>;
    migrateTemplateTenants(): Promise<void>;

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
    updateMeetingTitle(id: number, title: string): Promise<Meeting>;
    updateMeetingStatus(id: number, status: "uploading" | "processing" | "completed" | "failed"): Promise<Meeting>;
    updateMeetingAudioUrl(id: number, audioUrl: string): Promise<Meeting>;
    updateMeetingClient(id: number, clientId: number | null): Promise<Meeting>;
    updateMeetingIncludePreviousContext(id: number, includePreviousContext: boolean): Promise<Meeting>;
    getPreviousClientMeetingSummaries(clientId: number, beforeMeetingId: number): Promise<{ title: string; summary: string; date: Date }[]>;
    deleteMeeting(id: number): Promise<void>;

    // Transcripts
    deleteTranscriptForMeeting(meetingId: number): Promise<void>;
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

    // Audio Language Options
    getAudioLanguageOptions(activeOnly?: boolean): Promise<AudioLanguageOption[]>;
    getAudioLanguageOptionByCode(code: string): Promise<AudioLanguageOption | undefined>;
    getAudioLanguageOption(id: number): Promise<AudioLanguageOption | undefined>;
    createAudioLanguageOption(option: InsertAudioLanguageOption): Promise<AudioLanguageOption>;
    updateAudioLanguageOption(id: number, data: Partial<Pick<AudioLanguageOption, "code" | "label" | "normalize" | "normalizationPrompt" | "sortOrder" | "isActive">>): Promise<AudioLanguageOption>;
    deleteAudioLanguageOption(id: number): Promise<void>;

    // Prompt Settings
    getPromptSettings(): Promise<PromptSetting[]>;
    getPromptSettingByKey(key: string): Promise<PromptSetting | undefined>;
    upsertPromptSetting(key: string, value: string): Promise<PromptSetting>;
    resetPromptSettingToDefault(key: string): Promise<PromptSetting | undefined>;

    // System Settings
    getSystemSettings(): Promise<SystemSetting[]>;
    getSystemSettingByKey(key: string): Promise<SystemSetting | undefined>;
    upsertSystemSetting(key: string, value: string): Promise<SystemSetting>;
}

export class DatabaseStorage implements IStorage {
    // Tenants
    async getTenants(): Promise<Tenant[]> {
        return await db.select().from(tenants).orderBy(tenants.name);
    }

    async getTenant(id: number): Promise<Tenant | undefined> {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
        return tenant;
    }

    async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.domain, domain));
        return tenant;
    }

    async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
        return tenant;
    }

    async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
        const [tenant] = await db.insert(tenants).values(insertTenant).returning();
        return tenant;
    }

    async updateTenant(id: number, data: Partial<Pick<Tenant, "name" | "slug" | "domain" | "logoUrl" | "primaryColor" | "accentColor" | "tagline" | "isActive">>): Promise<Tenant> {
        const [tenant] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
        return tenant;
    }

    // Users
    async getUserById(id: number): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }

    async getUserByEmail(email: string, tenantId?: number): Promise<User | undefined> {
        const conditions = [eq(users.email, email.toLowerCase())];
        if (tenantId) {
            conditions.push(or(eq(users.tenantId, tenantId), isNull(users.tenantId))!);
        }
        const [user] = await db.select().from(users).where(and(...conditions));
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

    async updateUserSubscription(id: number, data: Partial<Pick<User, "subscriptionStatus" | "payfastToken" | "payfastSubscriptionId" | "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionCurrentPeriodEnd" | "cancelledAt" | "trialEndsAt" | "subscriptionPaymentFailedAt">>): Promise<User> {
        const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return user;
    }

    async makeSuperuser(id: number): Promise<void> {
        await db.update(users).set({ isSuperuser: true, isAdmin: true, isVerified: true, subscriptionStatus: "active" }).where(eq(users.id, id));
    }

    async getAllUsers(tenantId?: number): Promise<User[]> {
        if (tenantId) {
            return await db.select().from(users).where(or(eq(users.tenantId, tenantId), isNull(users.tenantId))).orderBy(desc(users.createdAt));
        }
        return await db.select().from(users).orderBy(desc(users.createdAt));
    }

    async getSuperusers(): Promise<User[]> {
        return await db.select().from(users).where(eq(users.isSuperuser, true));
    }

    async getPayfastAuditUsers(): Promise<User[]> {
        // Users potentially still being billed by PayFast despite local "cancelled" status:
        // 1. subscriptionStatus = 'cancelled' locally
        // 2. payfastToken IS NOT NULL  — PayFast still knows about this subscription
        // 3. cancelledAt IS NOT NULL   — cancellation was recorded
        // 4. subscriptionCurrentPeriodEnd > cancelledAt — billing period extended past cancellation (PayFast would re-bill)
        // 5. No PayFast CANCELLED ITN received after their cancellation date — PayFast never confirmed the cancellation
        return await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.subscriptionStatus, "cancelled"),
                    isNotNull(users.payfastToken),
                    isNotNull(users.cancelledAt),
                    isNotNull(users.subscriptionCurrentPeriodEnd),
                    sql`${users.subscriptionCurrentPeriodEnd} > ${users.cancelledAt}`,
                    sql`NOT EXISTS (
                        SELECT 1 FROM payfast_itn_events pie
                        WHERE pie.user_id = ${users.id}
                        AND pie.payment_status = 'CANCELLED'
                        AND pie.received_at > ${users.cancelledAt}
                    )`,
                ),
            )
            .orderBy(desc(users.cancelledAt));
    }

    async logPayfastItnEvent(data: { userId?: number | null; payfastToken?: string | null; paymentStatus: string; rawData?: string | null }): Promise<PayfastItnEvent> {
        const [event] = await db.insert(payfastItnEvents).values({
            userId: data.userId ?? null,
            payfastToken: data.payfastToken ?? null,
            paymentStatus: data.paymentStatus,
            rawData: data.rawData ?? null,
        }).returning();
        return event;
    }

    async logPayfastAuditRetry(data: { userId: number; attemptedBy: number; result: "ok" | "error"; detail?: string | null }): Promise<PayfastAuditLog> {
        const [entry] = await db.insert(payfastAuditLog).values({
            userId: data.userId,
            attemptedBy: data.attemptedBy,
            result: data.result,
            detail: data.detail ?? null,
        }).returning();
        return entry;
    }

    async getLatestPayfastAuditLogs(userIds: number[]): Promise<Map<number, PayfastAuditLog & { adminEmail: string }>> {
        if (userIds.length === 0) return new Map();
        const entries = await db
            .select({
                id: payfastAuditLog.id,
                userId: payfastAuditLog.userId,
                attemptedBy: payfastAuditLog.attemptedBy,
                attemptedAt: payfastAuditLog.attemptedAt,
                result: payfastAuditLog.result,
                detail: payfastAuditLog.detail,
                adminEmail: users.email,
            })
            .from(payfastAuditLog)
            .innerJoin(users, eq(payfastAuditLog.attemptedBy, users.id))
            .where(inArray(payfastAuditLog.userId, userIds))
            .orderBy(desc(payfastAuditLog.attemptedAt));
        const result = new Map<number, PayfastAuditLog & { adminEmail: string }>();
        for (const entry of entries) {
            if (!result.has(entry.userId)) {
                result.set(entry.userId, entry);
            }
        }
        return result;
    }

    async updateUser(id: number, data: Partial<Pick<User, "firstName" | "lastName" | "email" | "isAdmin" | "isSuperuser" | "isVerified" | "subscriptionStatus">>): Promise<User> {
        const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return user;
    }

    async deleteUser(id: number): Promise<void> {
        await db.delete(users).where(eq(users.id, id));
    }

    async getAllClients(tenantId?: number): Promise<Client[]> {
        if (tenantId) {
            return await db.select().from(clients).where(or(eq(clients.tenantId, tenantId), isNull(clients.tenantId))).orderBy(clients.name);
        }
        return await db.select().from(clients).orderBy(clients.name);
    }

    async getAllMeetings(tenantId?: number): Promise<Meeting[]> {
        if (tenantId) {
            return await db.select().from(meetings).where(or(eq(meetings.tenantId, tenantId), isNull(meetings.tenantId))).orderBy(desc(meetings.createdAt));
        }
        return await db.select().from(meetings).orderBy(desc(meetings.createdAt));
    }

    async updateClient(id: number, data: Partial<Pick<Client, "name" | "email" | "company">>): Promise<Client> {
        const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
        return client;
    }

    // Roles
    async getRoles(tenantId?: number): Promise<Role[]> {
        if (tenantId) {
            return await db.select().from(roles).where(or(eq(roles.tenantId, tenantId), isNull(roles.tenantId))).orderBy(roles.name);
        }
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
    async getTemplates(tenantId?: number): Promise<Template[]> {
        if (tenantId) {
            const allJunctions = await db.select().from(templateTenants);
            const templateIdsWithAnyAssignment = new Set(allJunctions.map(r => r.templateId));
            const assignedToThisTenant = new Set(allJunctions.filter(r => r.tenantId === tenantId).map(r => r.templateId));
            const allTemplates = await db.select().from(templates).orderBy(desc(templates.createdAt));
            return allTemplates.filter(t => {
                if (assignedToThisTenant.has(t.id)) return true;
                if (!templateIdsWithAnyAssignment.has(t.id)) return true;
                return false;
            });
        }
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

    async updateTemplate(id: number, data: Partial<Pick<Template, "name" | "description" | "formatPrompt" | "isDefault" | "analysisModel">>): Promise<Template> {
        const [template] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
        return template;
    }

    async deleteTemplate(id: number): Promise<void> {
        await db.delete(templates).where(eq(templates.id, id));
    }

    async getTemplateTenantIds(templateId: number): Promise<number[]> {
        const rows = await db.select({ tenantId: templateTenants.tenantId }).from(templateTenants).where(eq(templateTenants.templateId, templateId));
        return rows.map(r => r.tenantId);
    }

    async setTemplateTenants(templateId: number, tenantIds: number[]): Promise<void> {
        await db.delete(templateTenants).where(eq(templateTenants.templateId, templateId));
        if (tenantIds.length > 0) {
            await db.insert(templateTenants).values(tenantIds.map(tenantId => ({ templateId, tenantId })));
        }
    }

    async getTemplatesWithTenants(): Promise<TemplateWithTenants[]> {
        const allTemplates = await db.select().from(templates).orderBy(desc(templates.createdAt));
        const allJunctions = await db.select().from(templateTenants);
        const tenantMap = new Map<number, number[]>();
        for (const j of allJunctions) {
            const arr = tenantMap.get(j.templateId) || [];
            arr.push(j.tenantId);
            tenantMap.set(j.templateId, arr);
        }
        return allTemplates.map(t => ({ ...t, tenantIds: tenantMap.get(t.id) || [] }));
    }

    async migrateTemplateTenants(): Promise<void> {
        const allTemplates = await db.select().from(templates);
        const existingJunctions = await db.select().from(templateTenants);
        const existingPairs = new Set(existingJunctions.map(j => `${j.templateId}-${j.tenantId}`));
        const toInsert: { templateId: number; tenantId: number }[] = [];
        for (const t of allTemplates) {
            if (t.tenantId && !existingPairs.has(`${t.id}-${t.tenantId}`)) {
                toInsert.push({ templateId: t.id, tenantId: t.tenantId });
            }
        }
        if (toInsert.length > 0) {
            await db.insert(templateTenants).values(toInsert);
            console.log(`Migrated ${toInsert.length} template-tenant associations to junction table`);
        }
    }

    // Meetings - context
    async updateMeetingContext(id: number, data: { contextText?: string | null; templateId?: number | null; includePreviousContext?: boolean; outputLanguage?: string; audioLanguage?: string; isInternal?: boolean; clientRecordingConsent?: string; detailLevel?: string }): Promise<Meeting> {
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

    async updateMeetingTitle(id: number, title: string): Promise<Meeting> {
        const [meeting] = await db.update(meetings)
            .set({ title })
            .where(eq(meetings.id, id))
            .returning();
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
    async deleteTranscriptForMeeting(meetingId: number): Promise<void> {
        await db.delete(transcripts).where(eq(transcripts.meetingId, meetingId));
    }

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

    // Audio Language Options
    async getAudioLanguageOptions(activeOnly = false): Promise<AudioLanguageOption[]> {
        if (activeOnly) {
            return await db.select().from(audioLanguageOptions).where(eq(audioLanguageOptions.isActive, true)).orderBy(audioLanguageOptions.sortOrder, audioLanguageOptions.label);
        }
        return await db.select().from(audioLanguageOptions).orderBy(audioLanguageOptions.sortOrder, audioLanguageOptions.label);
    }

    async getAudioLanguageOptionByCode(code: string): Promise<AudioLanguageOption | undefined> {
        const [opt] = await db.select().from(audioLanguageOptions).where(eq(audioLanguageOptions.code, code));
        return opt;
    }

    async getAudioLanguageOption(id: number): Promise<AudioLanguageOption | undefined> {
        const [opt] = await db.select().from(audioLanguageOptions).where(eq(audioLanguageOptions.id, id));
        return opt;
    }

    async createAudioLanguageOption(option: InsertAudioLanguageOption): Promise<AudioLanguageOption> {
        const [opt] = await db.insert(audioLanguageOptions).values(option).returning();
        return opt;
    }

    async updateAudioLanguageOption(id: number, data: Partial<Pick<AudioLanguageOption, "code" | "label" | "normalize" | "normalizationPrompt" | "sortOrder" | "isActive">>): Promise<AudioLanguageOption> {
        const [opt] = await db.update(audioLanguageOptions).set(data).where(eq(audioLanguageOptions.id, id)).returning();
        return opt;
    }

    async deleteAudioLanguageOption(id: number): Promise<void> {
        await db.delete(audioLanguageOptions).where(eq(audioLanguageOptions.id, id));
    }

    // Prompt Settings
    async getPromptSettings(): Promise<PromptSetting[]> {
        return await db.select().from(promptSettings).orderBy(promptSettings.key);
    }

    async getPromptSettingByKey(key: string): Promise<PromptSetting | undefined> {
        const [row] = await db.select().from(promptSettings).where(eq(promptSettings.key, key));
        return row;
    }

    async upsertPromptSetting(key: string, value: string): Promise<PromptSetting> {
        const existing = await this.getPromptSettingByKey(key);
        if (!existing) {
            throw new Error(`Prompt setting key "${key}" not found`);
        }
        const [row] = await db.update(promptSettings).set({ value }).where(eq(promptSettings.key, key)).returning();
        return row;
    }

    async resetPromptSettingToDefault(key: string): Promise<PromptSetting | undefined> {
        const existing = await this.getPromptSettingByKey(key);
        if (!existing) return undefined;
        const [row] = await db.update(promptSettings)
            .set({ value: existing.defaultValue })
            .where(eq(promptSettings.key, key))
            .returning();
        return row;
    }

    // System Settings
    async getSystemSettings(): Promise<SystemSetting[]> {
        return await db.select().from(systemSettings).orderBy(systemSettings.key);
    }

    async getSystemSettingByKey(key: string): Promise<SystemSetting | undefined> {
        const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
        return row;
    }

    async upsertSystemSetting(key: string, value: string): Promise<SystemSetting> {
        const existing = await this.getSystemSettingByKey(key);
        if (!existing) {
            throw new Error(`System setting key "${key}" not found`);
        }
        const [row] = await db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key)).returning();
        return row;
    }
}

export const storage = new DatabaseStorage();
