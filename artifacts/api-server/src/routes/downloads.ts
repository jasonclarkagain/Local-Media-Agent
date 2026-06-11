import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { DeleteDownloadParams } from "@workspace/api-zod";
import { createQbtClient, type QbtTorrent } from "../lib/qbittorrent";

const router: IRouter = Router();

async function getQbtClient() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) return null;
  return createQbtClient(
    settings.qbittorrentUrl,
    settings.qbittorrentUsername,
    settings.qbittorrentPassword,
  );
}

function mapTorrent(t: QbtTorrent) {
  return {
    hash: t.hash,
    name: t.name,
    state: t.state,
    progress: t.progress,
    size: t.size,
    downloadedBytes: t.downloaded,
    uploadSpeed: t.upspeed,
    downloadSpeed: t.dlspeed,
    eta: t.eta,
    category: t.category,
    savePath: t.save_path ?? null,
    seeders: t.num_seeds ?? null,
    leechers: t.num_leechs ?? null,
    addedOn: t.added_on ?? null,
  };
}

router.get("/downloads", async (req, res): Promise<void> => {
  const client = await getQbtClient();
  if (!client) {
    res.json([]);
    return;
  }

  try {
    const torrents = await client.getTorrents();
    res.json(torrents.map(mapTorrent));
  } catch (err) {
    req.log.warn({ err }, "qBittorrent unavailable");
    res.json([]);
  }
});

router.delete("/downloads/:hash", async (req, res): Promise<void> => {
  const params = DeleteDownloadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const client = await getQbtClient();
  if (!client) {
    res.status(503).json({ error: "qBittorrent not configured" });
    return;
  }

  try {
    await client.deleteTorrent(params.data.hash, true);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete torrent");
    res.status(404).json({ error: "Download not found or could not be removed" });
  }
});

export default router;
