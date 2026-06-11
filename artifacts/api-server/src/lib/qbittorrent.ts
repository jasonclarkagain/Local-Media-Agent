import { logger } from "./logger";

export interface QbtTorrent {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  downloaded: number;
  upspeed: number;
  dlspeed: number;
  eta: number;
  category: string;
  save_path: string;
  num_seeds: number;
  num_leechs: number;
  added_on: number;
}

export interface QbtAddOptions {
  magnetUri?: string;
  torrentUrl?: string;
  category?: string;
  savePath?: string;
}

export class QBittorrentClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;

  constructor(baseUrl: string, username = "admin", password = "adminadmin") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.username = username;
    this.password = password;
  }

  async login(): Promise<void> {
    const form = new URLSearchParams();
    form.set("username", this.username);
    form.set("password", this.password);

    const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) {
      throw new Error(`qBittorrent login failed: HTTP ${res.status}`);
    }

    const body = await res.text();
    if (body !== "Ok.") {
      throw new Error(`qBittorrent login rejected: ${body}`);
    }

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/SID=[^;]+/);
      if (match) this.cookie = match[0];
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    if (!this.cookie) {
      await this.login();
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: this.cookie ?? "",
      },
    });

    if (res.status === 403) {
      this.cookie = null;
      await this.login();
      return fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...options.headers,
          Cookie: this.cookie ?? "",
        },
      });
    }

    return res;
  }

  async getTorrents(): Promise<QbtTorrent[]> {
    const res = await this.request("/api/v2/torrents/info");
    if (!res.ok) throw new Error(`Failed to get torrents: HTTP ${res.status}`);
    return res.json() as Promise<QbtTorrent[]>;
  }

  async addMagnet(magnetUri: string, category = "echo-agent", savePath?: string): Promise<void> {
    const form = new URLSearchParams();
    form.set("urls", magnetUri);
    form.set("category", category);
    if (savePath) form.set("savepath", savePath);

    const res = await this.request("/api/v2/torrents/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) throw new Error(`Failed to add torrent: HTTP ${res.status}`);
    const body = await res.text();
    if (body !== "Ok.") throw new Error(`qBittorrent add failed: ${body}`);
  }

  async addUrl(torrentUrl: string, category = "echo-agent", savePath?: string): Promise<void> {
    await this.addMagnet(torrentUrl, category, savePath);
  }

  async deleteTorrent(hash: string, deleteFiles = true): Promise<void> {
    const form = new URLSearchParams();
    form.set("hashes", hash);
    form.set("deleteFiles", deleteFiles ? "true" : "false");

    const res = await this.request("/api/v2/torrents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!res.ok) throw new Error(`Failed to delete torrent: HTTP ${res.status}`);
  }

  async getVersion(): Promise<string> {
    const res = await this.request("/api/v2/app/version");
    if (!res.ok) throw new Error(`Failed to get version: HTTP ${res.status}`);
    return res.text();
  }
}

export function createQbtClient(
  url: string | null | undefined,
  username: string | null | undefined,
  password: string | null | undefined,
): QBittorrentClient | null {
  if (!url) return null;
  return new QBittorrentClient(url, username ?? "admin", password ?? "adminadmin");
}
