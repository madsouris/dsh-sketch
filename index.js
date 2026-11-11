/**
 * Sketch for DeepSeek Harness — Host half.
 *
 * The bundle patch inserts one `@deepseek-ai/dsh-mcp-client` row (`sketch-mcp`)
 * that talks to a local compatibility relay owned by this plugin, plus this
 * plugin's own row (`sketch`). This plugin:
 *
 *  - registers the two Sketch skills (`sketch-design-from-reference`,
 *    `sketch-design-to-code`) from the vendored `sketch-hq/agents` sources, so
 *    enabling the plugin makes them available without running
 *    `npx skills add sketch-hq/agents`;
 *  - adds a system-prompt section with the stack/symbol/token/validation
 *    guardrails and the "read `get_guide` before mutating" rule;
 *  - runs a loopback relay in front of the Sketch MCP server. The shipped MCP
 *    client negotiates the 2026-07-28 protocol by probing `server/discover`;
 *    Sketch's server answers that probe with HTTP 501, which the client treats
 *    as fatal instead of falling back to the legacy revision. The relay answers
 *    the probe with 404 (a documented legacy signal) and forwards every other
 *    request untouched, so the client settles on the protocol Sketch speaks;
 *  - serves the Settings page's JSON API at `/api/sketch/settings`, which reads
 *    the live connection state and persists a new Sketch URL into this plugin's
 *    own config through the config editor.
 *
 * The Client half (`client.js`) renders the Settings page.
 */

import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute directory of this package, used to locate the bundled skills. */
const PLUGIN_ROOT = fileURLToPath(new URL(".", import.meta.url));
/** Loader row id of our own entry; its config carries `upstreamUrl`. */
const PLUGIN_ROW_ID = "sketch";
/** Loader row id of the MCP client entry that talks to the relay. */
const MCP_ROW_ID = "sketch-mcp";
/** Default endpoint of the Sketch desktop MCP server. */
const DEFAULT_UPSTREAM_URL = "http://127.0.0.1:31126/mcp";
/** Loopback port of the compatibility relay. */
const DEFAULT_PROXY_PORT = 31127;
/** MCP server namespace used in `mcp__<serverName>__<tool>` names. */
const DEFAULT_SERVER_NAME = "sketch";
/** Exact route served to the Settings page. */
const ROUTE_PATH = "/api/sketch/settings";
/** Upper bound for a settings request body. */
const MAX_BODY_BYTES = 4_096;
/** Upper bound for one relayed MCP request body. */
const MAX_RELAY_BODY_BYTES = 8 * 1024 * 1024;
/** Reachability probe budget. */
const PROBE_TIMEOUT_MS = 4_000;
/** Plugin version echoed to the Settings page. */
const VERSION = "1.0.1";

/**
 * Skills bundled from https://github.com/sketch-hq/agents (Apache-2.0).
 * `dir` names the skill folder under `skills/`; the description stays short on
 * purpose because every catalog entry costs prompt tokens.
 */
const SKILLS = [
  {
    dir: "sketch-design-from-reference",
    name: "sketch-design-from-reference",
    description:
      "Recreate or build a UI in Sketch from a URL, screenshot, or code with side-by-side fidelity validation through Sketch MCP. Use when designing, mocking up, or reproducing a page or screen in Sketch.",
    whenToUse:
      "The user wants a Sketch design built or refined from a web page, image, or existing code.",
  },
  {
    dir: "sketch-design-to-code",
    name: "sketch-design-to-code",
    description:
      "Generate code from a Sketch frame with 1:1 visual fidelity, mapping Sketch symbols and overrides to reusable components through Sketch MCP. Use when implementing or updating UI from a Sketch document, page, or frame.",
    whenToUse:
      "The user wants React, SwiftUI, Kotlin, or other code built from a Sketch design.",
  },
];

/**
 * Read one bundled skill from `skills/<dir>/SKILL.md` and turn it into a
 * runtime registration. The catalog metadata stays in `SKILLS` (short
 * descriptions keep the catalog cheap); the file supplies the instruction body,
 * and its directory supplies the relative-reference base.
 *
 * @param {object} ctx context used for diagnostics.
 * @param {{ dir: string, name: string, description: string, whenToUse?: string }} entry skill metadata.
 * @returns {object | undefined} registration input, or undefined when the file is unusable.
 */
function loadSkill(ctx, entry) {
  const directory = join(PLUGIN_ROOT, "skills", entry.dir);
  const skillPath = join(directory, "SKILL.md");
  let raw;
  try {
    raw = readFileSync(skillPath, "utf8");
  } catch (error) {
    ctx.logger?.warn?.(
      `dsh-sketch: could not read bundled skill ${entry.name}: ${describeError(error)}`,
    );
    return undefined;
  }

  const content = stripFrontmatter(raw).trim();
  if (content.length === 0) {
    ctx.logger?.warn?.(`dsh-sketch: bundled skill ${entry.name} has an empty instruction body`);
    return undefined;
  }

  return {
    name: entry.name,
    description: entry.description,
    ...(entry.whenToUse === undefined ? {} : { whenToUse: entry.whenToUse }),
    source: "bundled",
    resourceBase: { kind: "directory", path: directory },
    path: skillPath,
    content,
  };
}

/**
 * Remove a leading YAML frontmatter block. The registry needs the instruction
 * body only; malformed or absent frontmatter is returned unchanged so the
 * caller still sees the file rather than silently dropping it.
 *
 * @param {string} raw file contents.
 * @returns {string} body without frontmatter.
 */
function stripFrontmatter(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const firstBreak = text.indexOf("\n");
  if (firstBreak < 0) return text;
  if (text.slice(0, firstBreak).replace(/\r$/u, "") !== "---") return text;

  let lineStart = firstBreak + 1;
  while (lineStart <= text.length) {
    const nextBreak = text.indexOf("\n", lineStart);
    const lineEnd = nextBreak < 0 ? text.length : nextBreak;
    if (text.slice(lineStart, lineEnd).replace(/\r$/u, "") === "---") {
      return nextBreak < 0 ? "" : text.slice(nextBreak + 1);
    }
    if (nextBreak < 0) return text;
    lineStart = nextBreak + 1;
  }
  return text;
}

/**
 * Guardrails injected as a system-prompt section. This is the compact,
 * always-on version of the rules; the full procedure lives in the skills.
 */
const GUARDRAILS = `### Sketch design guardrails (Sketch MCP)

The \`mcp__sketch__*\` tools edit the open Sketch document. \`get_guide\` is authoritative; read it before acting.

Before any mutation:
1. Call \`mcp__sketch__get_guide\` with topic "mcp", topic "use", and topic "layout"; call topic "symbols" whenever symbols or repeated UI are involved. Do not draw, restyle, or restructure until these guides are read.
2. Call \`mcp__sketch__get_document_info\`, then \`mcp__sketch__get_libraries\` and \`mcp__sketch__get_design_assets\`. Reuse the document's existing symbols, swatches, and shared styles instead of inventing primitives.
3. Write the structure plan before pixels: regions top to bottom; for each region, whether it is a stack (direction, gap, padding, alignment); which UI appears 2+ times and becomes a symbol master plus instances; which artwork is imported as an asset. Show the plan for non-trivial work.

Hard constraints:
- No absolute positioning except page-level placement of top-level regions, pinned chrome, overlays, and masks. Every row, column, card, list, nav, toolbar, form, and repeated block is a Sketch stack with explicit direction, gap, padding, sizing, and alignment — never a group of hand-positioned layers.
- Any UI that appears twice or more is one symbol master on the Symbols page plus instances with overrides. Do not duplicate layer groups.
- Colors and type come from document swatches and shared text/layer styles. Do not hardcode fills, borders, or font sizes.
- Use small, reversible \`run_code\` edits: one action per call. Never assign \`parent.layers = [...]\`; reorder with \`layer.index\` and reparent with \`child.parent = newParent\`.
- Patch, do not rebuild. If content already exists, fix frames, styles, overrides, and order instead of deleting and recreating regions.

Before reporting success:
- \`mcp__sketch__get_layer_tree_summary\` must show the planned stacks, the symbol instances, and no stray groups of freeform layers.
- \`mcp__sketch__get_screenshot\` must show the intended result at the target width; compare it with the reference and fix the differences you can see.
- Report which symbols, swatches, and styles you reused or created, and anything not visually verified.

If the Sketch MCP tools are not available, stop and say so. Do not fake design work from memory. If Sketch is not running, tell the user to open it and start the server (⌘K → "Start MCP Server", or Settings → General → MCP Server; the default URL is http://127.0.0.1:31126/mcp), then retry.`;

/**
 * Register the Sketch skills, the guardrail prompt section, the relay, and the
 * settings route. Every resource is owned by a Cordis effect so disabling the
 * plugin removes it again.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {object} rawConfig this plugin's row config (`upstreamUrl`, `proxyPort`).
 */
export function apply(ctx, rawConfig) {
  const settings = normalizeSettings(ctx, rawConfig);
  const relay = startRelay(ctx, settings);

  ctx.effect(() => () => relay.dispose(), "dsh-sketch.relay");

  ctx.inject(["skills"], (inner) => {
    for (const entry of SKILLS) {
      inner.effect(() => {
        const skill = loadSkill(inner, entry);
        if (skill === undefined) return () => {};
        return inner.skills.register(skill);
      }, `dsh-sketch.skill.${entry.name}`);
    }
  });

  ctx.inject(["systemPrompt"], (inner) => {
    inner.effect(
      () =>
        inner.systemPrompt.section({
          name: "sketch:design-guardrails",
          order: inner.systemPrompt.getSectionOrder("MCP_SERVERS") + 1,
          interpolate: false,
          text: GUARDRAILS,
        }),
      "dsh-sketch.guardrails",
    );
  });

  ctx.inject(["webServer", "configEditor", "tools"], (inner) => {
    inner.effect(
      () =>
        inner.webServer.register({
          kind: "exact",
          path: ROUTE_PATH,
          handler: (req, res) => {
            handleRequest(inner, settings, relay, req, res).catch((error) => {
              sendJson(res, 500, { ok: false, error: describeError(error) });
            });
          },
        }),
      "dsh-sketch.settings-route",
    );
  });
}

/**
 * Normalize this plugin's config into relay settings.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {object} rawConfig row config.
 * @returns {{ upstreamUrl: string, proxyPort: number, proxyUrl: string }} settings.
 */
function normalizeSettings(ctx, rawConfig) {
  const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  let upstreamUrl = DEFAULT_UPSTREAM_URL;
  if (typeof config.upstreamUrl === "string" && config.upstreamUrl.trim().length > 0) {
    try {
      upstreamUrl = normalizeEndpoint(config.upstreamUrl);
    } catch (error) {
      ctx.logger?.warn?.(`dsh-sketch: invalid upstreamUrl, using the default: ${describeError(error)}`);
    }
  }
  const proxyPort =
    Number.isInteger(config.proxyPort) && config.proxyPort > 0 && config.proxyPort < 65_536
      ? config.proxyPort
      : DEFAULT_PROXY_PORT;
  return { upstreamUrl, proxyPort, proxyUrl: `http://127.0.0.1:${proxyPort}/mcp` };
}

/**
 * Start the loopback compatibility relay.
 *
 * The relay forwards MCP traffic to the Sketch server and answers only the
 * modern `server/discover` probe with 404, the signal that makes the shipped
 * client negotiate the legacy revision Sketch actually speaks.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {{ upstreamUrl: string, proxyPort: number, proxyUrl: string }} settings relay settings.
 * @returns {{ state: object, dispose: () => Promise<void> }} relay handle.
 */
function startRelay(ctx, settings) {
  const upstream = new URL(settings.upstreamUrl);
  const transport = upstream.protocol === "https:" ? https : http;
  const state = { status: "starting", error: null, port: settings.proxyPort };

  const server = http.createServer((req, res) => {
    forward(req, res).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      res.end(`Sketch relay error: ${describeError(error)}`);
    });
  });

  server.on("error", (error) => {
    state.status = "error";
    state.error = describeError(error);
    ctx.logger?.error?.(`dsh-sketch: relay on 127.0.0.1:${settings.proxyPort} failed: ${state.error}`);
  });
  server.on("listening", () => {
    state.status = "listening";
    ctx.logger?.info?.(`dsh-sketch: relay listening on 127.0.0.1:${settings.proxyPort} -> ${settings.upstreamUrl}`);
  });

  try {
    server.listen(settings.proxyPort, "127.0.0.1");
  } catch (error) {
    state.status = "error";
    state.error = describeError(error);
  }

  /**
   * Relay one request to the Sketch MCP server.
   *
   * @param {import('node:http').IncomingMessage} req incoming request.
   * @param {import('node:http').ServerResponse} res outgoing response.
   * @returns {Promise<void>} settlement after the response is written.
   */
  async function forward(req, res) {
    const body = await readBody(req, MAX_RELAY_BODY_BYTES);
    if (body === undefined) {
      res.writeHead(413, { "content-type": "text/plain; charset=utf-8" });
      res.end("Request body is too large");
      return;
    }

    if (isModernProbe(body)) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end('{"jsonrpc":"2.0","id":null,"error":{"code":-32601,"message":"Method not found"}}');
      return;
    }

    const headers = { ...req.headers, host: upstream.host };
    if (body.length > 0) headers["content-length"] = String(body.length);

    const upstreamRequest = transport.request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: req.url,
        headers,
      },
      (upstreamResponse) => {
        res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(res);
      },
    );

    upstreamRequest.on("error", (error) => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      res.end(`Sketch relay upstream error: ${describeError(error)}`);
    });

    res.on("close", () => {
      if (!res.writableEnded) upstreamRequest.destroy();
    });

    upstreamRequest.end(body);
  }

  return {
    state,
    dispose: async () => {
      try {
        server.closeAllConnections?.();
      } catch {
        // Older Node versions lack the helper; close() alone still stops new work.
      }
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

/**
 * Detect the modern protocol probe: a JSON-RPC `server/discover` call, alone
 * or in a batch. The relay answers it with 404 so the client falls back.
 *
 * @param {Buffer} body request body.
 * @returns {boolean} whether this is a negotiation probe.
 */
function isModernProbe(body) {
  if (body.length === 0 || body.length > 64 * 1024) return false;
  const text = body.toString("utf8");
  if (!text.includes('"server/discover"')) return false;
  try {
    const message = JSON.parse(text);
    const messages = Array.isArray(message) ? message : [message];
    return messages.some((entry) => entry?.method === "server/discover");
  } catch {
    return false;
  }
}

/**
 * Route the Settings page's requests.
 *
 * `GET  ?action=status` reads the row, relay, and connection state.
 * `GET  ?action=probe`  additionally checks that the Sketch endpoint answers HTTP.
 * `POST ?action=save`   persists a new Sketch URL into this plugin's own row.
 *
 * @param {object} ctx injected context (webServer, configEditor, tools).
 * @param {{ upstreamUrl: string, proxyPort: number, proxyUrl: string }} settings relay settings.
 * @param {{ state: object }} relay relay handle.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 * @returns {Promise<void>} settlement after the response is written.
 */
async function handleRequest(ctx, settings, relay, req, res) {
  if (!sameOrigin(req, ctx)) {
    sendJson(res, 403, { ok: false, error: "Forbidden origin" });
    return;
  }

  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const action = requestUrl.searchParams.get("action") ?? "status";

  if (req.method === "GET" && (action === "status" || action === "probe")) {
    const payload = { ok: true, ...readState(ctx, settings, relay), version: VERSION };
    if (action === "probe") payload.probe = await probe(settings.upstreamUrl);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "POST" && action === "save") {
    let body;
    try {
      body = await readJsonBody(req, MAX_BODY_BYTES);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: describeError(error) });
      return;
    }

    let nextUrl;
    try {
      nextUrl = normalizeEndpoint(body?.url);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: describeError(error) });
      return;
    }

    if (nextUrl === settings.upstreamUrl) {
      sendJson(res, 200, { ok: true, url: nextUrl, unchanged: true });
      return;
    }

    const entry = findEntry(ctx, PLUGIN_ROW_ID);
    if (entry === undefined) {
      sendJson(res, 409, {
        ok: false,
        error: "The sketch row is missing. Reinstall the Sketch bundle to restore it.",
      });
      return;
    }

    // Respond before the config edit reloads this plugin and restarts the relay.
    sendJson(res, 200, { ok: true, url: nextUrl, applying: true });
    setTimeout(() => {
      ctx.configEditor
        .edit(entry, (config) => ({ ...config, upstreamUrl: nextUrl }))
        .catch((error) => {
          ctx.logger?.error?.(`dsh-sketch: could not persist the Sketch URL: ${describeError(error)}`);
        });
    }, 50);
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

/**
 * Read the live state from the rows, the relay, and the tool registry.
 *
 * @param {object} ctx injected context.
 * @param {{ upstreamUrl: string, proxyUrl: string }} settings relay settings.
 * @param {{ state: object }} relay relay handle.
 * @returns {object} state consumed by the Settings page.
 */
function readState(ctx, settings, relay) {
  const mcpEntry = findEntry(ctx, MCP_ROW_ID);
  const mcpConfig = mcpEntry?.options?.config ?? {};
  const serverName =
    typeof mcpConfig.serverName === "string" && mcpConfig.serverName.length > 0
      ? mcpConfig.serverName
      : DEFAULT_SERVER_NAME;
  const prefix = `mcp__${serverName}__`;
  let tools = [];
  try {
    tools = ctx.tools
      .schemas()
      .map((schema) => schema?.name)
      .filter((name) => typeof name === "string" && name.startsWith(prefix));
  } catch {
    tools = [];
  }
  const rowUrl = typeof mcpConfig.url === "string" ? mcpConfig.url : null;
  return {
    url: settings.upstreamUrl,
    defaultUrl: DEFAULT_UPSTREAM_URL,
    proxyUrl: settings.proxyUrl,
    rowUrl,
    rowUsesRelay: rowUrl === settings.proxyUrl,
    relay: { status: relay.state.status, error: relay.state.error, port: relay.state.port },
    serverName,
    transport: typeof mcpConfig.transport === "string" ? mcpConfig.transport : "streamable-http",
    rowActive: mcpEntry !== undefined,
    connected: tools.length > 0,
    tools,
    skills: SKILLS.map((skill) => skill.name),
  };
}

/**
 * Find the live Loader entry for a profile row.
 *
 * @param {object} ctx injected context exposing `configEditor`.
 * @param {string} id profile patch id.
 * @returns {object | undefined} entry.
 */
function findEntry(ctx, id) {
  try {
    return ctx.configEditor.entries().find((entry) => entry?.options?.id === id);
  } catch {
    return undefined;
  }
}

/**
 * Accept only absolute http(s) endpoints without embedded credentials.
 *
 * @param {unknown} raw user input.
 * @returns {string} normalized URL.
 */
function normalizeEndpoint(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("Enter an MCP server URL");
  }
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("That is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The MCP server URL must start with http:// or https://");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("Remove credentials from the URL; use headers in the row instead");
  }
  return parsed.toString();
}

/**
 * Read a bounded request body.
 *
 * @param {import('node:http').IncomingMessage} req request.
 * @param {number} limit byte limit.
 * @returns {Promise<Buffer>} body, or an empty buffer.
 */
async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Read a bounded JSON request body.
 *
 * @param {import('node:http').IncomingMessage} req request.
 * @param {number} limit byte limit.
 * @returns {Promise<any>} parsed JSON value.
 */
async function readJsonBody(req, limit) {
  const body = await readBody(req, limit);
  if (body === undefined) throw new Error("Request body is too large");
  if (body.length === 0) throw new Error("Request body is required");
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("Request body must be JSON");
  }
}

/**
 * Check that the Sketch endpoint answers HTTP at all. A 4xx MCP response still
 * proves that something is listening; the tool list is the stronger signal.
 *
 * @param {string} url endpoint.
 * @returns {Promise<object>} probe result.
 */
async function probe(url) {
  let endpoint;
  try {
    endpoint = new URL(url);
  } catch {
    return { reachable: false, error: "No valid server URL" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "text/event-stream, application/json" },
      signal: controller.signal,
    });
    try {
      await response.body?.cancel();
    } catch {
      // The status already answered the question.
    }
    return { reachable: true, status: response.status };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { reachable: false, error: "Timed out connecting to the server" };
    }
    return { reachable: false, error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reject cross-origin browser writes. Requests without an Origin header are
 * accepted because same-origin GETs and local tooling may omit it.
 *
 * @param {import('node:http').IncomingMessage} req request.
 * @param {object} ctx injected context exposing `webServer`.
 * @returns {boolean} whether the request may proceed.
 */
function sameOrigin(req, ctx) {
  const origin = req.headers?.origin;
  if (typeof origin !== "string" || origin.length === 0) return true;
  try {
    if (origin === ctx.webServer.getOrigin()) return true;
    const host = req.headers?.host;
    return typeof host === "string" && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Write one JSON response.
 *
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status.
 * @param {unknown} body JSON body.
 */
function sendJson(res, status, body) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Turn an unknown error into a short, safe message.
 *
 * @param {unknown} error thrown value.
 * @returns {string} message.
 */
function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
