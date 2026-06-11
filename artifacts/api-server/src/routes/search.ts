import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { SearchTorrentsBody, AddTorrentBody } from "@workspace/api-zod";
import { createProwlarrClient } from "../lib/prowlarr";
import { createQbtClient } from "../lib/qbittorrent";

const router: IRouter = Router();

router.post("/search", async (req, res): Promise<void> => {
  const parsed = SearchTorrentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  const client = createProwlarrClient(
    settings?.prowlarrUrl,
    settings?.prowlarrApiKey,
  );

  if (!client) {
    res.status(503).json({ error: "Prowlarr not configured. Add Prowlarr URL and API key in Settings." });
    return;
  }

  try {
    const results = await client.search({
      query: parsed.data.query,
      minSeeders: parsed.data.minSeeders ?? 1,
      limit: parsed.data.limit ?? 20,
    });
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Prowlarr search failed");
    res.status(502).json({ error: `Prowlarr search failed: ${String(err)}` });
  }
});

router.post("/torrents", async (req, res): Promise<void> => {
  const parsed = AddTorrentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { magnetUrl, torrentUrl, category = "echo-agent", savePath, name } = parsed.data;

  if (!magnetUrl && !torrentUrl) {
    res.status(400).json({ error: "Either magnetUrl or torrentUrl is required" });
    return;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  const client = createQbtClient(
    settings?.qbittorrentUrl,
    settings?.qbittorrentUsername,
    settings?.qbittorrentPassword,
  );

  if (!client) {
    res.status(503).json({ error: "qBittorrent not configured. Add qBittorrent URL in Settings." });
    return;
  }

  try {
    const url = magnetUrl ?? torrentUrl!;
    await client.addMagnet(url, category ?? "echo-agent", savePath ?? undefined);

    const torrents = await client.getTorrents();
    const added = torrents.find((t) => t.name === name) ?? torrents[torrents.length - 1];

    if (!added) {
      res.status(201).json({
        hash: "pending",
        name: name ?? "Added",
        state: "queued",
        progress: 0,
        size: 0,
        downloadedBytes: 0,
        uploadSpeed: 0,
        downloadSpeed: 0,
        eta: -1,
        category: category ?? "echo-agent",
        savePath: null,
        seeders: null,
        leechers: null,
        addedOn: null,
      });
      return;
    }

    res.status(201).json({
      hash: added.hash,
      name: added.name,
      state: added.state,
      progress: added.progress,
      size: added.size,
      downloadedBytes: added.downloaded,
      uploadSpeed: added.upspeed,
      downloadSpeed: added.dlspeed,
      eta: added.eta,
      category: added.category,
      savePath: added.save_path ?? null,
      seeders: added.num_seeds ?? null,
      leechers: added.num_leechs ?? null,
      addedOn: added.added_on ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add torrent");
    res.status(502).json({ error: `Failed to add torrent: ${String(err)}` });
  }
});

export default router;
