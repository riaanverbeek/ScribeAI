import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  tagline: text("tagline"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperuser: boolean("is_superuser").default(false).notNull(),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionStatus: text("subscription_status", {
    enum: ["none", "trialing", "active", "cancelled", "expired", "lifetime"]
  }).notNull().default("none"),
  payfastToken: text("payfast_token"),
  payfastSubscriptionId: text("payfast_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  roleId: integer("role_id").references(() => roles.id, { onDelete: "set null" }),
  customRole: text("custom_role"),
  cancelledAt: timestamp("cancelled_at"),
  subscriptionPaymentFailedAt: timestamp("subscription_payment_failed_at"),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  formatPrompt: text("format_prompt").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  analysisModel: text("analysis_model"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templateTenants = pgTable("template_tenants", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetings = pgTable("meetings", {
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => templates.id, { onDelete: "set null" }),
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  audioUrl: text("audio_url"),
  contextText: text("context_text"),
  contextFileUrl: text("context_file_url"),
  contextFileName: text("context_file_name"),
  userRole: text("user_role"),
  includePreviousContext: boolean("include_previous_context").default(false).notNull(),
  outputLanguage: text("output_language").default("en").notNull(),
  audioLanguage: text("audio_language").default("auto").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  clientRecordingConsent: text("client_recording_consent", { enum: ["not_asked", "yes", "no"] }).default("not_asked"),
  detailLevel: text("detail_level", { enum: ["high", "medium", "low"] }).default("high").notNull(),
  status: text("status", { enum: ["uploading", "processing", "completed", "failed"] }).notNull().default("uploading"),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  language: text("language").default("en"),
  isSpeakerLabelled: boolean("is_speaker_labelled").default(false),
});

export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  assignee: text("assignee"),
  status: text("status", { enum: ["pending", "completed"] }).default("pending"),
  isManual: boolean("is_manual").notNull().default(false),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  relevanceScore: integer("relevance_score"),
});

export const meetingSummaries = pgTable("meeting_summaries", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const POLICY_TYPES = [
  "Life Insurance",
  "Investments",
  "Medical Aid",
  "GAP Cover",
  "Employee Benefits",
  "Short-term Commercial",
  "Short-term Personal",
  "Short-term Agri",
] as const;

export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  insurer: text("insurer").notNull(),
  policyNumber: text("policy_number").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingPolicies = pgTable("meeting_policies", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  policyId: integer("policy_id").notNull().references(() => policies.id, { onDelete: "cascade" }),
});

export const audioLanguageOptions = pgTable("audio_language_options", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  normalize: boolean("normalize").notNull().default(false),
  normalizationPrompt: text("normalization_prompt"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promptSettings = pgTable("prompt_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  value: text("value").notNull(),
  defaultValue: text("default_value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  value: text("value").notNull(),
  defaultValue: text("default_value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payfastItnEvents = pgTable("payfast_itn_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  payfastToken: text("payfast_token"),
  paymentStatus: text("payment_status").notNull(),
  rawData: text("raw_data"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const insertPayfastItnEventSchema = createInsertSchema(payfastItnEvents).omit({ id: true, receivedAt: true });
export type PayfastItnEvent = typeof payfastItnEvents.$inferSelect;
export type InsertPayfastItnEvent = z.infer<typeof insertPayfastItnEventSchema>;

export const payfastAuditLog = pgTable("payfast_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attemptedBy: integer("attempted_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  result: text("result", { enum: ["ok", "error"] }).notNull(),
  detail: text("detail"),
});

export const insertPayfastAuditLogSchema = createInsertSchema(payfastAuditLog).omit({ id: true, attemptedAt: true });
export type PayfastAuditLog = typeof payfastAuditLog.$inferSelect;
export type InsertPayfastAuditLog = z.infer<typeof insertPayfastAuditLogSchema>;

// === CHAT TABLES FOR REPLIT INTEGRATIONS ===

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// === RELATIONS ===

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  meetings: many(meetings),
  templates: many(templates),
  roles: many(roles),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  creator: one(users, { fields: [templates.createdBy], references: [users.id] }),
  tenant: one(tenants, { fields: [templates.tenantId], references: [tenants.id] }),
  templateTenants: many(templateTenants),
}));

export const templateTenantsRelations = relations(templateTenants, ({ one }) => ({
  template: one(templates, { fields: [templateTenants.templateId], references: [templates.id] }),
  tenant: one(tenants, { fields: [templateTenants.tenantId], references: [tenants.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  meetings: many(meetings),
  clients: many(clients),
  templates: many(templates),
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [clients.tenantId], references: [tenants.id] }),
  meetings: many(meetings),
  policies: many(policies),
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  client: one(clients, { fields: [policies.clientId], references: [clients.id] }),
  meetingPolicies: many(meetingPolicies),
}));

export const meetingPoliciesRelations = relations(meetingPolicies, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingPolicies.meetingId], references: [meetings.id] }),
  policy: one(policies, { fields: [meetingPolicies.policyId], references: [policies.id] }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  user: one(users, { fields: [meetings.userId], references: [users.id] }),
  client: one(clients, {
    fields: [meetings.clientId],
    references: [clients.id],
  }),
  template: one(templates, {
    fields: [meetings.templateId],
    references: [templates.id],
  }),
  tenant: one(tenants, { fields: [meetings.tenantId], references: [tenants.id] }),
  transcript: one(transcripts, {
    fields: [meetings.id],
    references: [transcripts.meetingId],
  }),
  actionItems: many(actionItems),
  topics: many(topics),
  summary: one(meetingSummaries, {
      fields: [meetings.id],
      references: [meetingSummaries.meetingId]
  })
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  meeting: one(meetings, {
    fields: [transcripts.meetingId],
    references: [meetings.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, {
    fields: [actionItems.meetingId],
    references: [meetings.id],
  }),
}));

export const topicsRelations = relations(topics, ({ one }) => ({
  meeting: one(meetings, {
    fields: [topics.meetingId],
    references: [meetings.id],
  }),
}));

export const meetingSummariesRelations = relations(meetingSummaries, ({ one }) => ({
    meeting: one(meetings, {
        fields: [meetingSummaries.meetingId],
        references: [meetings.id],
    }),
}));

// === BASE SCHEMAS ===

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, isVerified: true, verificationToken: true,
  verificationTokenExpiry: true, trialEndsAt: true, subscriptionStatus: true,
  payfastToken: true, payfastSubscriptionId: true, subscriptionCurrentPeriodEnd: true,
  cancelledAt: true, subscriptionPaymentFailedAt: true, roleId: true, customRole: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  passwordHash: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });

export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertTemplateTenantSchema = createInsertSchema(templateTenants).omit({ id: true });

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });

export const insertMeetingSchema = createInsertSchema(meetings).extend({
  date: z.string().transform((str) => new Date(str)),
  title: z.string().optional(),
}).omit({ id: true, createdAt: true, status: true });
export const insertTranscriptSchema = createInsertSchema(transcripts).omit({ id: true });
export const insertActionItemSchema = createInsertSchema(actionItems).omit({ id: true });
export const insertTopicSchema = createInsertSchema(topics).omit({ id: true });
export const insertMeetingSummarySchema = createInsertSchema(meetingSummaries).omit({ id: true, createdAt: true });

export const insertPolicySchema = createInsertSchema(policies).omit({ id: true, createdAt: true });
export const insertMeetingPolicySchema = createInsertSchema(meetingPolicies).omit({ id: true });

export const insertAudioLanguageOptionSchema = createInsertSchema(audioLanguageOptions).omit({ id: true, createdAt: true });

export const insertPromptSettingSchema = createInsertSchema(promptSettings).omit({ id: true, createdAt: true });

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true });

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// === EXPLICIT API CONTRACT TYPES ===

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type TemplateTenant = typeof templateTenants.$inferSelect;
export type InsertTemplateTenant = z.infer<typeof insertTemplateTenantSchema>;
export type TemplateWithTenants = Template & { tenantIds: number[] };

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;

export type MeetingSummary = typeof meetingSummaries.$inferSelect;
export type InsertMeetingSummary = z.infer<typeof insertMeetingSummarySchema>;

export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type MeetingPolicy = typeof meetingPolicies.$inferSelect;
export type InsertMeetingPolicy = z.infer<typeof insertMeetingPolicySchema>;

export type AudioLanguageOption = typeof audioLanguageOptions.$inferSelect;
export type InsertAudioLanguageOption = z.infer<typeof insertAudioLanguageOptionSchema>;

export type PromptSetting = typeof promptSettings.$inferSelect;
export type InsertPromptSetting = z.infer<typeof insertPromptSettingSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type SafeUser = Omit<User, "passwordHash" | "verificationToken" | "verificationTokenExpiry" | "resetToken" | "resetTokenExpiry">;
export type SuperuserSafeUser = Omit<User, "passwordHash" | "resetToken" | "resetTokenExpiry">;

// Request types
export type CreateMeetingRequest = InsertMeeting;
export type UpdateMeetingStatusRequest = { status: "uploading" | "processing" | "completed" | "failed" };
export type AnalyzeMeetingRequest = { meetingId: number };

// Response types
export type MeetingListResponse = Meeting[];
export type MeetingDetailResponse = Meeting & {
    transcript?: Transcript;
    actionItems: ActionItem[];
    topics: Topic[];
    summary?: MeetingSummary;
};
