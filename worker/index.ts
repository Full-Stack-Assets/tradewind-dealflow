/** Cloudflare Worker entry point for the static-capable DealFlow site. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleIngestionApi } from "../server/ingestion-api.ts";
import { handleControlPlaneApi } from "../server/control-plane-api.ts";
import { handleAiFieldGeneration } from "../server/ai-field-generation.ts";
import { handleElevenLabsWebhook } from "../server/webhooks/elevenlabs.ts";
import { runDuePolicies } from "../server/ingestion-scheduler.ts";
import type { D1Database } from "../server/d1.ts";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
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
    const ingestionResponse = await handleIngestionApi(request, env);
    if (ingestionResponse) return ingestionResponse;
    const controlPlaneResponse = await handleControlPlaneApi(request, env);
    if (controlPlaneResponse) return controlPlaneResponse;
    if (url.pathname === "/api/ai/field-generation") {
      return handleAiFieldGeneration(request, env);
    }
    if (url.pathname === "/api/webhooks/elevenlabs") {
      return handleElevenLabsWebhook(request, env);
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

    return handler.fetch(request, env, ctx);
  },
  async scheduled(
    controller: { scheduledTime: number },
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runDuePolicies(env, new Date(controller.scheduledTime)));
  },
};

export default worker;
