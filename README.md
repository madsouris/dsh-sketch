# Sketch for DeepSeek Harness

Design in the **Sketch desktop app** from a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(DSH) session.

This bundle connects DSH to Sketch's local MCP server, registers Sketch's own
design skills, and adds stack/symbol/token guardrails so the agent edits the
open document structurally instead of hand-positioning layers.

## What it adds

| Row or resource | Purpose |
| --- | --- |
| `sketch-mcp` | DSH's Streamable HTTP MCP client, pointed at this plugin's local relay (`http://127.0.0.1:31127/mcp`). `failOnStartupError: false` keeps DSH usable when Sketch is closed. |
| `sketch` | This plugin's Host and Web halves: relay, skills, guardrail prompt, and the Settings page. |
| Settings → Sketch | Live connection state, tool count, MCP server URL, **Test connection**, and the active skills and guardrails. |
| `sketch-design-from-reference` | Skill: build or recreate a design from a URL, screenshot, or code, with side-by-side visual validation. |
| `sketch-design-to-code` | Skill: generate 1:1 code from a Sketch frame and map symbols to components. |

### Why the relay

Sketch's MCP server answers the modern `server/discover` negotiation probe with
**HTTP 501**. The MCP client shipped with DSH treats any 5xx as fatal instead of
falling back to the legacy revision that Sketch speaks.

The plugin therefore runs a loopback relay that answers **only**
`server/discover` with **404** — the client's documented legacy signal — and
forwards every other request untouched. The Settings page edits the real Sketch
endpoint; the relay is transparent in normal use.

## Requirements

- macOS, with **Sketch 2025.2.4 or later**. Sketch is a paid app; a valid Sketch
  license is required.
- DeepSeek Harness with the `plugin_manager` tool. The desktop and web profiles
  include it.
- The Settings page needs a profile with a web server and config editor. A
  headless profile still works; configure the rows directly as shown below.

No API key is needed. By default the plugin talks only to Sketch on your
machine.

## Install

1. Clone this repository anywhere on your machine:

   ```bash
   git clone https://github.com/madsouris/dsh-sketch.git
   ```

2. In a DSH session, install the bundle from the absolute path:

   ```text
   plugin_manager install_bundle target=/absolute/path/to/dsh-sketch
   ```

   You can also ask the agent: “Install the DSH bundle at
   /absolute/path/to/dsh-sketch.”

3. Restart DSH if the Sketch page or `mcp__sketch__*` tools do not appear.

The package is named `@local/dsh-sketch` and marked `private` so it is not
accidentally published to npm. Installing from the cloned directory links it
into your DSH profile.

The bundle patch contributes two rows:

```yaml
- insert:
    - id: sketch-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: sketch
        transport: streamable-http
        url: http://127.0.0.1:31127/mcp
        failOnStartupError: false
        toolCallTimeoutMs: 120000
        reconnect:
          enabled: true
          initialDelayMs: 1000
          maxDelayMs: 30000
          maxAttempts: 30
    - id: sketch
      name: '@local/dsh-sketch'
      config:
        upstreamUrl: http://127.0.0.1:31126/mcp
        proxyPort: 31127
```

## Set up Sketch

1. Open Sketch and a document.
2. Press **⌘K** and choose **Start MCP Server**, or use **Settings → General →
   MCP Server**. Allow Local Network access when macOS asks. The default
   endpoint is `http://127.0.0.1:31126/mcp`.
3. In DSH, open **Settings → Sketch**. Confirm the URL and press **Save** if you
   changed it. Press **Test connection**; the tool count updates once the
   client discovers Sketch's tools.
4. Ask the agent for a design. It should call `get_guide` first, inspect the
   document, libraries, and assets, post a structure plan, then build in stacks
   and symbols.

## Using it

```text
Recreate this page in Sketch: https://example.com
Turn the selected Sketch frame into React components.
Build a settings screen in this document using its existing styles.
```

The agent loads the relevant skill on demand. Both skills are model-invocable
and user-invocable while the plugin is enabled, so you do not need to run
`npx skills add sketch-hq/agents`.

## Guardrails

The plugin adds a compact system-prompt section before any design work:

- Read `get_guide` with topics `mcp`, `use`, and `layout`, plus `symbols` when
  symbols or repeated UI are involved, before mutating the document.
- Call `get_document_info`, then `get_libraries` and `get_design_assets`, and
  reuse existing symbols, swatches, and shared styles.
- Post the structure plan before pixels: regions, stacks (direction, gap,
  padding, alignment), symbol candidates, and imported assets.
- No absolute positioning except page-level placement, pinned chrome, overlays,
  and masks. Rows, columns, cards, lists, navs, forms, and toolbars are stacks.
- UI appearing 2+ times becomes one symbol master on the Symbols page plus
  instances with overrides.
- Colors and type come from document swatches and shared text/layer styles.
- Use small, reversible `run_code` edits; never assign `parent.layers = [...]`.
- Validate with `get_layer_tree_summary` and `get_screenshot` before reporting
  success.

The skills carry the longer procedure and per-direction rules.

## Configuration

The Sketch endpoint lives in the plugin's own row. The MCP client row stays
pointed at the relay:

```yaml
- id: sketch
  config:
    upstreamUrl: http://127.0.0.1:31126/mcp
    proxyPort: 31127
- id: sketch-mcp
  config:
    url: http://127.0.0.1:31127/mcp
```

The Settings page is the easiest way to change `upstreamUrl`; it validates the
URL, keeps the row's other fields, and restarts the relay so the next
connection reaches the new endpoint.

If you change `proxyPort`, update `sketch-mcp.url` to match. A matching override
replaces the whole config, so include every field you want to keep.

## Troubleshooting

- **“Waiting for Sketch”** — Sketch is closed, its MCP server is not started, or
  the URL points at the wrong port. Start the server, then press **Test
  connection**. The tool count updates once tools are discovered.
- **Relay error (port in use)** — another process owns `127.0.0.1:31127`.
  Change `proxyPort` in the plugin row and `sketch-mcp.url` to match, then
  reload.
- **“The MCP client row is not pointed at the relay”** — set `sketch-mcp.url`
  back to `http://127.0.0.1:31127/mcp`. Without it, the client hits the 501
  negotiation failure described above.
- **“MCP client row missing”** — reinstall the bundle. The Settings page cannot
  create a Loader row on its own.
- **“Settings API unavailable”** — this composition has no web server or config
  editor, for example a headless profile. Edit the profile patch directly.
- **Stale tool list** — MCP tools are named `mcp__sketch__<tool>`. If the list is
  stale, save the URL again to reload the row; the reconnect budget may be
  exhausted.

## Security

- The relay binds to `127.0.0.1` only and caps request sizes. The Settings route
  also rejects cross-origin browser writes.
- The plugin stores no API keys or credentials. URLs with embedded credentials
  are rejected.
- The relay forwards MCP traffic to the configured `upstreamUrl`. Point it only
  at Sketch on your machine or a host you trust.
- The plugin itself does not send document data anywhere except that configured
  upstream. As with any DSH session, content the agent reads may be sent to your
  configured model provider.

## Third-party content

`skills/sketch-design-from-reference/` and `skills/sketch-design-to-code/` are
vendored unmodified from <https://github.com/sketch-hq/agents> and are licensed
under Apache-2.0. Each directory keeps its upstream `LICENSE.txt`. The rest of
this repository is MIT-licensed.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Development

There is no build step. Check the Host half with:

```bash
node --check index.js
node --check client.js
```

Install the directory with `plugin_manager install_bundle`, then open
**Settings → Sketch** and exercise a design request. Replacing an
already-installed package may require a DSH restart so the new module generation
is loaded.

## License

MIT for this plugin's code. See [LICENSE](LICENSE). The vendored Sketch skills
remain Apache-2.0.

This is an unofficial community plugin. It is not affiliated with Sketch B.V. or
DeepSeek.
