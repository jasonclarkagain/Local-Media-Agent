import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  qbittorrentUrl: text("qbittorrent_url"),
  qbittorrentUsername: text("qbittorrent_username"),
  qbittorrentPassword: text("qbittorrent_password"),
  prowlarrUrl: text("prowlarr_url"),
  prowlarrApiKey: text("prowlarr_api_key"),
  lidarrUrl: text("lidarr_url"),
  lidarrApiKey: text("lidarr_api_key"),
  radarrUrl: text("radarr_url"),
  radarrApiKey: text("radarr_api_key"),
  sonarrUrl: text("sonarr_url"),
  sonarrApiKey: text("sonarr_api_key"),
  ollamaUrl: text("ollama_url"),
  ollamaModel: text("ollama_model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
