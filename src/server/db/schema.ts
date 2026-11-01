import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Answers, FormDraft, Settings } from "@/features/forms/schema";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Google OAuth grant for Sheets (scope drive.file). refreshToken is AES-GCM encrypted (src/server/crypto.ts). */
export const googleConnections = pgTable("google_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A personal workspace per user, plus any number of shared team workspaces. */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  personal: boolean("personal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = "owner" | "editor" | "viewer";

export const members = pgTable(
  "members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("members_user").on(t.userId)],
);

export const invites = pgTable("invites", {
  token: text("token").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: text("role").$type<Exclude<Role, "owner">>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const forms = pgTable(
  "forms",
  {
    id: text("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    draft: jsonb("draft").$type<FormDraft>().notNull(),
    settings: jsonb("settings").$type<Settings>().notNull(),
    responseCount: integer("response_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("forms_workspace_updated").on(t.workspaceId, t.updatedAt)],
);

export const responses = pgTable(
  "responses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Answers>().notNull(),
    /** sha256 of the respondent's edit token (the token itself is only ever in their link). */
    editTokenHash: text("edit_token_hash"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("responses_form_created").on(t.formId, t.createdAt), index("responses_edit_token").on(t.editTokenHash)],
);

/** Durable outbox for webhook posts and Google Sheets appends. Retried with backoff until done or dead. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"webhook" | "sheet">().notNull(),
    target: text("target"),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    deadAt: timestamp("dead_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deliveries_due").on(t.nextAt)],
);
