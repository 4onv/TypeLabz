import { sqliteTable, integer, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const typingSessions = sqliteTable("typing_sessions", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  savedAt: integer("saved_at").notNull(),
  phase: text("phase").notNull(),
  kind: text("kind").notNull(),
  target: integer("target").notNull(),
  profile: text("profile").notNull(),
  punctuation: integer("punctuation").notNull(),
  caps: integer("caps").notNull(),
  elapsedMs: integer("elapsed_ms").notNull(),
  correctChars: integer("correct_chars").notNull(),
  hits: integer("hits").notNull(),
  attempts: integer("attempts").notNull(),
}, table => [
  primaryKey({columns: [table.userId, table.id]}),
  index("typing_sessions_user_time").on(table.userId, table.savedAt),
]);
