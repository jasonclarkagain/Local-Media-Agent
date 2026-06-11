export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OllamaToolCall {
  id?: string;
  type?: "function";
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
}

export interface ParsedIntent {
  intentType: string;
  artist: string | null;
  title: string | null;
  mediaType: string;
  scope: string;
  query: string | null;
  confidence: number;
}

const INTENT_TOOL: OllamaTool = {
  type: "function",
  function: {
    name: "parse_media_intent",
    description:
      "Parse the user's natural language media request into structured intent and entities.",
    parameters: {
      type: "object",
      properties: {
        intentType: {
          type: "string",
          enum: [
            "media_bulk_download",
            "media_single_download",
            "search_query",
            "status_check",
            "manage_downloads",
            "unknown",
          ],
          description:
            "The type of intent: media_bulk_download (full discography/filmography), media_single_download (single item), search_query (find/search), status_check (check state), manage_downloads (pause/resume/delete), unknown",
        },
        artist: {
          type: "string",
          description: "Artist or band name if mentioned, otherwise empty string",
        },
        title: {
          type: "string",
          description: "Specific album/movie/show title if mentioned, otherwise empty string",
        },
        mediaType: {
          type: "string",
          enum: ["music", "movies", "tv", "unknown"],
          description: "Type of media being requested",
        },
        scope: {
          type: "string",
          enum: ["discography", "single", "album", "season", "all", "specific"],
          description: "Scope of the request",
        },
        query: {
          type: "string",
          description: "Normalized search query to use when looking up content",
        },
        confidence: {
          type: "string",
          description: "Confidence score 0-100",
        },
      },
      required: ["intentType", "artist", "title", "mediaType", "scope", "query", "confidence"],
    },
  },
};

const SYSTEM_PROMPT = `You are Echo, an intelligent local media automation assistant.
Your job is to parse natural language commands and extract structured intent and entities.
When a user says something like "Download everything the Rolling Stones ever did", you recognize this as a bulk music download request for the artist "The Rolling Stones".
Always use the parse_media_intent tool to return structured data.`;

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model = "llama3:8b") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
  }

  async parseIntent(command: string): Promise<ParsedIntent> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: command },
      ],
      tools: [INTENT_TOOL],
      stream: false,
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    const toolCalls = data.message?.tool_calls;

    if (!toolCalls?.length) {
      return fallbackParse(command);
    }

    const call = toolCalls[0];
    let args: Record<string, unknown>;
    if (typeof call.function.arguments === "string") {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } else {
      args = call.function.arguments as Record<string, unknown>;
    }

    return {
      intentType: String(args.intentType ?? "unknown"),
      artist: args.artist ? String(args.artist) : null,
      title: args.title ? String(args.title) : null,
      mediaType: String(args.mediaType ?? "unknown"),
      scope: String(args.scope ?? "specific"),
      query: args.query ? String(args.query) : null,
      confidence: Number(args.confidence ?? 50),
    };
  }

  async getVersion(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/version`);
    if (!res.ok) throw new Error(`Ollama version check failed: HTTP ${res.status}`);
    const data = (await res.json()) as { version: string };
    return data.version;
  }
}

function fallbackParse(command: string): ParsedIntent {
  const lower = command.toLowerCase();
  const isMusic =
    lower.includes("music") ||
    lower.includes("song") ||
    lower.includes("album") ||
    lower.includes("discography") ||
    lower.includes("band") ||
    lower.includes("artist");
  const isMovie =
    lower.includes("movie") || lower.includes("film") || lower.includes("cinema");
  const isTV =
    lower.includes("series") || lower.includes("show") || lower.includes("season") || lower.includes("episode");
  const isBulk =
    lower.includes("everything") ||
    lower.includes("all") ||
    lower.includes("discography") ||
    lower.includes("filmography");

  return {
    intentType: isBulk ? "media_bulk_download" : "media_single_download",
    artist: null,
    title: null,
    mediaType: isMusic ? "music" : isMovie ? "movies" : isTV ? "tv" : "unknown",
    scope: isBulk ? "discography" : "specific",
    query: command,
    confidence: 40,
  };
}

export function createOllamaClient(
  url: string | null | undefined,
  model: string | null | undefined,
): OllamaClient | null {
  if (!url) return null;
  return new OllamaClient(url, model ?? "llama3:8b");
}
