import http from "node:http";

type RawResponse = { status: number } | { error: string };

/**
 * Minimal HTTP client that forces every request over one keep-alive socket. Playwright's request context may open a
 * fresh connection at any time, which hides transport-level defects; this client makes connection reuse deterministic.
 */
export class KeepAliveClient {
  private readonly agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  private readonly target: URL;

  constructor(baseUrl: string) {
    this.target = new URL(baseUrl);
  }

  send(method: string, path: string, options: { body?: unknown; accessToken?: string } = {}): Promise<RawResponse> {
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);

    return new Promise((resolve) => {
      const request = http.request(
        {
          host: this.target.hostname,
          port: this.target.port,
          method,
          path,
          agent: this.agent,
          headers: {
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
          },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
        },
      );

      request.on("error", (error: NodeJS.ErrnoException) => resolve({ error: error.code ?? error.message }));
      request.end(payload);
    });
  }

  close() {
    this.agent.destroy();
  }
}
