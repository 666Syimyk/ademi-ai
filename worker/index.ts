/** Cloudflare Worker entry point for ADEMI MIND. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ensureLocalDevDatabase } from "../build/local-dev-db";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MATERIALS: R2Bucket;
  ADEMI_LOCAL_DEV_AUTH?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (["/chat", "/login"].includes(url.pathname)) {
      return new Response(null, { status: 302, headers: { Location: "/" } });
    }

    if (
      env.ADEMI_LOCAL_DEV_AUTH === "true" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      if (url.pathname === "/signin-with-chatgpt") {
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
      const headers = new Headers(request.headers);
      headers.set("oai-authenticated-user-id", "local-dev-user");
      headers.set("oai-authenticated-user-email", "local@ademi.test");
      headers.set(
        "oai-authenticated-user-full-name",
        encodeURIComponent("Local Developer"),
      );
      headers.set(
        "oai-authenticated-user-full-name-encoding",
        "percent-encoded-utf-8",
      );
      request = new Request(request, { headers });
      await ensureLocalDevDatabase(env.DB);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;
