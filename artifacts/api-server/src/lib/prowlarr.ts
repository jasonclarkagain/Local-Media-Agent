export interface ProwlarrResult {
  title: string;
  indexer: string;
  seeders: number;
  leechers: number;
  size: number;
  publishDate: string;
  downloadUrl: string | null;
  magnetUrl: string | null;
  infoUrl: string | null;
  category: string | null;
}

export interface ProwlarrSearchOptions {
  query: string;
  categories?: number[];
  minSeeders?: number;
  limit?: number;
}

export class ProwlarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "X-Api-Key": this.apiKey },
    });
    if (!res.ok) throw new Error(`Prowlarr request failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  async search(opts: ProwlarrSearchOptions): Promise<ProwlarrResult[]> {
    const params = new URLSearchParams({ query: opts.query });
    if (opts.categories?.length) {
      opts.categories.forEach((c) => params.append("categories", String(c)));
    }
    if (opts.limit) params.set("limit", String(opts.limit));

    const raw = await this.request<ProwlarrRaw[]>(`/api/v1/search?${params.toString()}`);

    let results = raw.map<ProwlarrResult>((r) => ({
      title: r.title ?? "",
      indexer: r.indexer ?? "",
      seeders: r.seeders ?? 0,
      leechers: r.leechers ?? 0,
      size: r.size ?? 0,
      publishDate: r.publishDate ?? new Date().toISOString(),
      downloadUrl: r.downloadUrl ?? null,
      magnetUrl: r.magnetUrl ?? null,
      infoUrl: r.infoUrl ?? null,
      category: r.categoryDesc ?? null,
    }));

    if (opts.minSeeders != null && opts.minSeeders > 0) {
      results = results.filter((r) => r.seeders >= (opts.minSeeders ?? 1));
    }

    return results.slice(0, opts.limit ?? 20);
  }

  async getVersion(): Promise<string> {
    const data = await this.request<{ version: string }>("/api/v1/system/status");
    return data.version;
  }
}

interface ProwlarrRaw {
  title?: string;
  indexer?: string;
  seeders?: number;
  leechers?: number;
  size?: number;
  publishDate?: string;
  downloadUrl?: string;
  magnetUrl?: string;
  infoUrl?: string;
  categoryDesc?: string;
}

export function createProwlarrClient(
  url: string | null | undefined,
  apiKey: string | null | undefined,
): ProwlarrClient | null {
  if (!url || !apiKey) return null;
  return new ProwlarrClient(url, apiKey);
}
