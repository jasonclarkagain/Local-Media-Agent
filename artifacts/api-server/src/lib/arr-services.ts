export interface ArrServiceConfig {
  url: string;
  apiKey: string;
}

export interface LidarrArtist {
  id: number;
  artistName: string;
  monitored: boolean;
  status: string;
}

export interface ArrServiceInfo {
  version: string;
  appName: string;
}

async function arrRequest<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Arr request to ${path} failed: HTTP ${res.status} — ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getArrVersion(
  baseUrl: string,
  apiKey: string,
): Promise<string> {
  const data = await arrRequest<{ version: string }>(baseUrl, apiKey, "/api/v1/system/status");
  return data.version;
}

export async function lidarrAddArtist(
  cfg: ArrServiceConfig,
  artistName: string,
  metadataProfileId = 1,
  qualityProfileId = 1,
  rootFolderPath = "/music",
): Promise<LidarrArtist> {
  const searchRes = await arrRequest<Array<{ foreignArtistId: string; artistName: string }>>(
    cfg.url,
    cfg.apiKey,
    `/api/v1/artist/lookup?term=${encodeURIComponent(artistName)}`,
  );

  if (!searchRes.length) {
    throw new Error(`Artist "${artistName}" not found in Lidarr lookup`);
  }

  const found = searchRes[0];
  const body = {
    foreignArtistId: found.foreignArtistId,
    artistName: found.artistName,
    monitored: true,
    metadataProfileId,
    qualityProfileId,
    rootFolderPath,
    addOptions: {
      monitor: "all",
      searchForMissingAlbums: true,
    },
  };

  const added = await arrRequest<LidarrArtist>(cfg.url, cfg.apiKey, "/api/v1/artist", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return added;
}

export async function radarrAddMovie(
  cfg: ArrServiceConfig,
  title: string,
  qualityProfileId = 1,
  rootFolderPath = "/movies",
): Promise<{ id: number; title: string }> {
  const searchRes = await arrRequest<Array<{ tmdbId: number; title: string; year: number }>>(
    cfg.url,
    cfg.apiKey,
    `/api/v3/movie/lookup?term=${encodeURIComponent(title)}`,
  );

  if (!searchRes.length) {
    throw new Error(`Movie "${title}" not found in Radarr lookup`);
  }

  const found = searchRes[0];
  const body = {
    tmdbId: found.tmdbId,
    title: found.title,
    qualityProfileId,
    rootFolderPath,
    monitored: true,
    addOptions: { searchForMovie: true },
  };

  return arrRequest<{ id: number; title: string }>(cfg.url, cfg.apiKey, "/api/v3/movie", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sonarrAddSeries(
  cfg: ArrServiceConfig,
  title: string,
  qualityProfileId = 1,
  rootFolderPath = "/tv",
): Promise<{ id: number; title: string }> {
  const searchRes = await arrRequest<Array<{ tvdbId: number; title: string }>>(
    cfg.url,
    cfg.apiKey,
    `/api/v3/series/lookup?term=${encodeURIComponent(title)}`,
  );

  if (!searchRes.length) {
    throw new Error(`Series "${title}" not found in Sonarr lookup`);
  }

  const found = searchRes[0];
  const body = {
    tvdbId: found.tvdbId,
    title: found.title,
    qualityProfileId,
    rootFolderPath,
    monitored: true,
    addOptions: { searchForMissingEpisodes: true },
  };

  return arrRequest<{ id: number; title: string }>(cfg.url, cfg.apiKey, "/api/v3/series", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
