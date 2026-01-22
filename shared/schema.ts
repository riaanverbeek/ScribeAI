import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  audioUrl: text("audio_url"),
  status: text("status", { enum: ["uploading", "processing", "completed", "failed"] }).notNull().default("uploading"),
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
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  relevanceScore: integer("relevance_score"), // 1-100
});

export const meetingSummaries = pgTable("meeting_summaries", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // Executive summary
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
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

export const insertMeetingSchema = createInsertSchema(meetings).extend({
  date: z.string().transform((str) => new Date(str)),
}).omit({ id: true, createdAt: true, status: true });
export const insertTranscriptSchema = createInsertSchema(transcripts).omit({ id: true });
export const insertActionItemSchema = createInsertSchema(actionItems).omit({ id: true });
export const insertTopicSchema = createInsertSchema(topics).omit({ id: true });
export const insertMeetingSummarySchema = createInsertSchema(meetingSummaries).omit({ id: true, createdAt: true });

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// === EXPLICIT API CONTRACT TYPES ===

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

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;


// Request types
export type CreateMeetingRequest = InsertMeeting;
export type UpdateMeetingStatusRequest = { status: "uploading" | "processing" | "completed" | "failed" };
export type AnalyzeMeetingRequest = { meetingId: number }; // Triggers AI process

// Response types
export type MeetingListResponse = Meeting[];
export type MeetingDetailResponse = Meeting & {
    transcript?: Transcript;
    actionItems: ActionItem[];
    topics: Topic[];
    summary?: MeetingSummary;
};
