import { eq } from "drizzle-orm";
import { db, jobsTable, jobLogsTable, settingsTable } from "@workspace/db";
import { createOllamaClient } from "./ollama";
import { createQbtClient } from "./qbittorrent";
import { createProwlarrClient } from "./prowlarr";
import { lidarrAddArtist, radarrAddMovie, sonarrAddSeries } from "./arr-services";
import { logger } from "./logger";

async function getSettings() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings ?? null;
}

async function addLog(
  jobId: number,
  level: "info" | "warn" | "error" | "debug",
  message: string,
  metadata?: unknown,
): Promise<void> {
  await db.insert(jobLogsTable).values({
    jobId,
    level,
    message,
    metadata: metadata != null ? JSON.stringify(metadata) : null,
  });
}

async function updateJob(
  jobId: number,
  update: {
    status?: "pending" | "running" | "completed" | "failed" | "cancelled";
    intentType?: string | null;
    entities?: string | null;
    progress?: number | null;
    summary?: string | null;
  },
): Promise<void> {
  await db
    .update(jobsTable)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(jobsTable.id, jobId));
}

export async function runOrchestration(jobId: number, command: string): Promise<void> {
  try {
    await updateJob(jobId, { status: "running", summary: "Parsing intent..." });
    await addLog(jobId, "info", `Received command: "${command}"`);

    const settings = await getSettings();

    if (!settings) {
      await addLog(jobId, "warn", "No settings configured. Configure services in Settings.");
      await updateJob(jobId, {
        status: "completed",
        summary: "No services configured. Please set up Echo in Settings.",
        progress: 100,
      });
      return;
    }

    await addLog(jobId, "info", "Parsing intent with local LLM...");

    const ollamaClient = createOllamaClient(settings.ollamaUrl, settings.ollamaModel);
    let intent;

    if (ollamaClient) {
      try {
        intent = await ollamaClient.parseIntent(command);
        await addLog(jobId, "info", `Intent parsed: ${intent.intentType}`, {
          intentType: intent.intentType,
          mediaType: intent.mediaType,
          scope: intent.scope,
          artist: intent.artist,
          title: intent.title,
          confidence: intent.confidence,
        });
      } catch (err) {
        await addLog(jobId, "warn", `Ollama unavailable, using fallback parser: ${String(err)}`);
        intent = fallbackParse(command);
      }
    } else {
      await addLog(jobId, "warn", "Ollama not configured. Using rule-based intent parser.");
      intent = fallbackParse(command);
    }

    await updateJob(jobId, {
      intentType: intent.intentType,
      entities: JSON.stringify({
        artist: intent.artist,
        title: intent.title,
        mediaType: intent.mediaType,
        scope: intent.scope,
        query: intent.query,
      }),
      progress: 20,
      summary: `Intent: ${intent.intentType} (${intent.mediaType})`,
    });

    switch (intent.intentType) {
      case "media_bulk_download":
      case "media_single_download":
        await handleMediaDownload(jobId, intent, settings);
        break;
      case "search_query":
        await handleSearch(jobId, intent, settings);
        break;
      case "status_check":
        await handleStatusCheck(jobId, settings);
        break;
      case "manage_downloads":
        await addLog(jobId, "info", "Download management commands can be used via the Downloads tab.");
        await updateJob(jobId, { status: "completed", progress: 100, summary: "Use the Downloads tab to manage active downloads." });
        break;
      default:
        await addLog(jobId, "warn", `Unknown intent type: ${intent.intentType}. Could not determine what action to take.`);
        await updateJob(jobId, {
          status: "failed",
          progress: 0,
          summary: `Could not understand command. Please be more specific.`,
        });
    }
  } catch (err) {
    logger.error({ err, jobId }, "Orchestration error");
    try {
      await addLog(jobId, "error", `Fatal error: ${String(err)}`);
      await updateJob(jobId, {
        status: "failed",
        summary: `Error: ${String(err)}`,
      });
    } catch {
    }
  }
}

async function handleMediaDownload(
  jobId: number,
  intent: ReturnType<typeof fallbackParse>,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  if (!settings) return;

  const searchQuery = intent.query ?? intent.artist ?? intent.title ?? "";

  if (!searchQuery) {
    await addLog(jobId, "error", "No search query could be extracted from the command.");
    await updateJob(jobId, { status: "failed", summary: "Could not extract search terms." });
    return;
  }

  if (intent.mediaType === "music" && settings.lidarrUrl && settings.lidarrApiKey && intent.artist) {
    await addLog(jobId, "info", `Adding artist "${intent.artist}" to Lidarr with full discography monitoring...`);
    await updateJob(jobId, { progress: 40, summary: `Adding to Lidarr: ${intent.artist}` });
    try {
      const result = await lidarrAddArtist(
        { url: settings.lidarrUrl, apiKey: settings.lidarrApiKey },
        intent.artist,
      );
      await addLog(jobId, "info", `Lidarr: Artist "${result.artistName}" added (ID: ${result.id}). Monitoring all albums.`);
      await updateJob(jobId, { status: "completed", progress: 100, summary: `Artist added to Lidarr: ${result.artistName}` });
      return;
    } catch (err) {
      await addLog(jobId, "warn", `Lidarr add failed: ${String(err)}. Falling back to Prowlarr search.`);
    }
  }

  if (intent.mediaType === "movies" && settings.radarrUrl && settings.radarrApiKey && (intent.title || intent.query)) {
    const movieTitle = intent.title ?? intent.query ?? "";
    await addLog(jobId, "info", `Adding movie "${movieTitle}" to Radarr...`);
    await updateJob(jobId, { progress: 40, summary: `Adding to Radarr: ${movieTitle}` });
    try {
      const result = await radarrAddMovie(
        { url: settings.radarrUrl, apiKey: settings.radarrApiKey },
        movieTitle,
      );
      await addLog(jobId, "info", `Radarr: Movie "${result.title}" added (ID: ${result.id}).`);
      await updateJob(jobId, { status: "completed", progress: 100, summary: `Movie added to Radarr: ${result.title}` });
      return;
    } catch (err) {
      await addLog(jobId, "warn", `Radarr add failed: ${String(err)}. Falling back to Prowlarr search.`);
    }
  }

  if (intent.mediaType === "tv" && settings.sonarrUrl && settings.sonarrApiKey && (intent.title || intent.query)) {
    const seriesTitle = intent.title ?? intent.query ?? "";
    await addLog(jobId, "info", `Adding series "${seriesTitle}" to Sonarr...`);
    await updateJob(jobId, { progress: 40, summary: `Adding to Sonarr: ${seriesTitle}` });
    try {
      const result = await sonarrAddSeries(
        { url: settings.sonarrUrl, apiKey: settings.sonarrApiKey },
        seriesTitle,
      );
      await addLog(jobId, "info", `Sonarr: Series "${result.title}" added (ID: ${result.id}).`);
      await updateJob(jobId, { status: "completed", progress: 100, summary: `Series added to Sonarr: ${result.title}` });
      return;
    } catch (err) {
      await addLog(jobId, "warn", `Sonarr add failed: ${String(err)}. Falling back to Prowlarr search.`);
    }
  }

  await handleSearch(jobId, intent, settings);
}

async function handleSearch(
  jobId: number,
  intent: ReturnType<typeof fallbackParse>,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  if (!settings) return;

  const prowlarrClient = createProwlarrClient(settings.prowlarrUrl, settings.prowlarrApiKey);

  if (!prowlarrClient) {
    await addLog(jobId, "warn", "Prowlarr not configured. Cannot search for torrents.");
    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      summary: "Prowlarr not configured. Set up Prowlarr in Settings to enable torrent search.",
    });
    return;
  }

  const query = intent.query ?? intent.artist ?? intent.title ?? "";
  if (!query) {
    await addLog(jobId, "error", "No search query could be extracted.");
    await updateJob(jobId, { status: "failed", summary: "Could not build search query." });
    return;
  }

  await addLog(jobId, "info", `Searching Prowlarr for: "${query}"...`);
  await updateJob(jobId, { progress: 50, summary: `Searching Prowlarr: ${query}` });

  try {
    const results = await prowlarrClient.search({ query, minSeeders: 1, limit: 10 });
    await addLog(jobId, "info", `Found ${results.length} results for "${query}".`);

    if (!results.length) {
      await updateJob(jobId, { status: "completed", progress: 100, summary: `No results found for: ${query}` });
      return;
    }

    const best = results
      .filter((r) => r.seeders > 0)
      .sort((a, b) => b.seeders - a.seeders)[0];

    if (!best) {
      await addLog(jobId, "warn", "All results have zero seeders. Skipping auto-add.");
      await updateJob(jobId, { status: "completed", progress: 100, summary: `Found ${results.length} results but none have seeders.` });
      return;
    }

    const sizeStr = formatBytes(best.size);
    await addLog(jobId, "info", `Best result: "${best.title}" — ${best.seeders} seeders, ${sizeStr} via ${best.indexer}`);

    const qbtClient = createQbtClient(
      settings.qbittorrentUrl,
      settings.qbittorrentUsername,
      settings.qbittorrentPassword,
    );

    if (!qbtClient) {
      await addLog(jobId, "warn", "qBittorrent not configured. Cannot add torrent automatically.");
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        summary: `Found "${best.title}" (${sizeStr}, ${best.seeders} seeders) — configure qBittorrent to auto-add.`,
      });
      return;
    }

    await updateJob(jobId, { progress: 75, summary: `Sending "${best.title}" to qBittorrent...` });

    const magnetOrUrl = best.magnetUrl ?? best.downloadUrl;
    if (!magnetOrUrl) {
      await addLog(jobId, "error", "Best result has no magnet or download URL.");
      await updateJob(jobId, { status: "failed", summary: "Result has no usable URL." });
      return;
    }

    await addLog(jobId, "info", `Sending to qBittorrent...`);
    await qbtClient.addMagnet(magnetOrUrl, "echo-agent");
    await addLog(jobId, "info", `Torrent added to qBittorrent successfully.`);
    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      summary: `Added "${best.title}" (${sizeStr}) to qBittorrent.`,
    });
  } catch (err) {
    await addLog(jobId, "error", `Search/add failed: ${String(err)}`);
    await updateJob(jobId, { status: "failed", summary: `Error during search: ${String(err)}` });
  }
}

async function handleStatusCheck(
  jobId: number,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<void> {
  if (!settings) {
    await updateJob(jobId, { status: "completed", progress: 100, summary: "No services configured." });
    return;
  }

  await addLog(jobId, "info", "Checking service status...");
  const results: string[] = [];

  const qbtClient = createQbtClient(
    settings.qbittorrentUrl,
    settings.qbittorrentUsername,
    settings.qbittorrentPassword,
  );
  if (qbtClient) {
    try {
      const v = await qbtClient.getVersion();
      results.push(`qBittorrent v${v.trim()}: online`);
    } catch {
      results.push("qBittorrent: offline/unreachable");
    }
  } else {
    results.push("qBittorrent: not configured");
  }

  if (settings.prowlarrUrl && settings.prowlarrApiKey) {
    const pc = createProwlarrClient(settings.prowlarrUrl, settings.prowlarrApiKey);
    try {
      const v = await pc!.getVersion();
      results.push(`Prowlarr v${v}: online`);
    } catch {
      results.push("Prowlarr: offline/unreachable");
    }
  } else {
    results.push("Prowlarr: not configured");
  }

  const summary = results.join(" | ");
  await addLog(jobId, "info", summary);
  await updateJob(jobId, { status: "completed", progress: 100, summary });
}

function fallbackParse(command: string) {
  const lower = command.toLowerCase();
  const isMusic =
    lower.includes("music") || lower.includes("song") || lower.includes("album") ||
    lower.includes("discography") || lower.includes("band") || lower.includes("artist");
  const isMovie = lower.includes("movie") || lower.includes("film");
  const isTV = lower.includes("series") || lower.includes("show") || lower.includes("season");
  const isBulk =
    lower.includes("everything") || lower.includes("all") ||
    lower.includes("discography") || lower.includes("filmography");

  return {
    intentType: isBulk ? "media_bulk_download" : "media_single_download",
    artist: null as string | null,
    title: null as string | null,
    mediaType: isMusic ? "music" : isMovie ? "movies" : isTV ? "tv" : "unknown",
    scope: isBulk ? "discography" : "specific",
    query: command,
    confidence: 40,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
