import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, jobsTable, settingsTable } from "@workspace/db";
import { createQbtClient } from "../lib/qbittorrent";
import { createProwlarrClient } from "../lib/prowlarr";
import { createOllamaClient } from "../lib/ollama";
import { getArrVersion } from "../lib/arr-services";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const [totalRow] = await db.select({ count: count() }).from(jobsTable);
  const [pendingRow] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "pending"));
  const [runningRow] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "running"));
  const [completedRow] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "completed"));
  const [failedRow] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "failed"));

  const recentJobs = await db
    .select()
    .from(jobsTable)
    .orderBy(desc(jobsTable.createdAt))
    .limit(5);

  const [settings] = await db.select().from(settingsTable).limit(1);
  const qbtClient = createQbtClient(
    settings?.qbittorrentUrl,
    settings?.qbittorrentUsername,
    settings?.qbittorrentPassword,
  );

  let totalDownloads = 0;
  let activeDownloads = 0;
  let totalDownloadedBytes = 0;

  if (qbtClient) {
    try {
      const torrents = await qbtClient.getTorrents();
      totalDownloads = torrents.length;
      activeDownloads = torrents.filter((t) =>
        ["downloading", "stalledDL", "checkingDL", "queued"].includes(t.state),
      ).length;
      totalDownloadedBytes = torrents.reduce((sum, t) => sum + (t.downloaded ?? 0), 0);
    } catch {
      // qBittorrent unreachable — leave defaults
    }
  }

  res.json({
    totalJobs: totalRow?.count ?? 0,
    pendingJobs: pendingRow?.count ?? 0,
    runningJobs: runningRow?.count ?? 0,
    completedJobs: completedRow?.count ?? 0,
    failedJobs: failedRow?.count ?? 0,
    totalDownloads,
    activeDownloads,
    totalDownloadedBytes,
    recentJobs,
  });
});

router.get("/services/status", async (req, res): Promise<void> => {
  const [settings] = await db.select().from(settingsTable).limit(1);

  const services = await Promise.all([
    checkService("Ollama (LLM)", async () => {
      if (!settings?.ollamaUrl) return { configured: false };
      const c = createOllamaClient(settings.ollamaUrl, settings.ollamaModel);
      const v = await c!.getVersion();
      return { configured: true, version: v };
    }),
    checkService("qBittorrent", async () => {
      if (!settings?.qbittorrentUrl) return { configured: false };
      const c = createQbtClient(settings.qbittorrentUrl, settings.qbittorrentUsername, settings.qbittorrentPassword);
      const v = await c!.getVersion();
      return { configured: true, version: v.trim() };
    }),
    checkService("Prowlarr", async () => {
      if (!settings?.prowlarrUrl || !settings.prowlarrApiKey) return { configured: false };
      const c = createProwlarrClient(settings.prowlarrUrl, settings.prowlarrApiKey);
      const v = await c!.getVersion();
      return { configured: true, version: v };
    }),
    checkService("Lidarr", async () => {
      if (!settings?.lidarrUrl || !settings.lidarrApiKey) return { configured: false };
      const v = await getArrVersion(settings.lidarrUrl, settings.lidarrApiKey);
      return { configured: true, version: v };
    }),
    checkService("Radarr", async () => {
      if (!settings?.radarrUrl || !settings.radarrApiKey) return { configured: false };
      const v = await getArrVersion(settings.radarrUrl, settings.radarrApiKey);
      return { configured: true, version: v };
    }),
    checkService("Sonarr", async () => {
      if (!settings?.sonarrUrl || !settings.sonarrApiKey) return { configured: false };
      const v = await getArrVersion(settings.sonarrUrl, settings.sonarrApiKey);
      return { configured: true, version: v };
    }),
  ]);

  res.json({ services });
});

async function checkService(
  name: string,
  fn: () => Promise<{ configured: boolean; version?: string }>,
): Promise<{ name: string; configured: boolean; reachable: boolean; version: string | null; error: string | null }> {
  try {
    const result = await fn();
    if (!result.configured) {
      return { name, configured: false, reachable: false, version: null, error: null };
    }
    return { name, configured: true, reachable: true, version: result.version ?? null, error: null };
  } catch (err) {
    return { name, configured: true, reachable: false, version: null, error: String(err) };
  }
}

export default router;
