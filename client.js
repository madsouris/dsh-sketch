window.__ModuleLoader__.load({
  id: "@local/dsh-sketch",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    const API_PATH = "/api/sketch/settings";
    const NS = "sketch";

    /** English strings. Keep keys in sync with the Chinese dictionary. */
    const EN = {
      nav: "Sketch",
      connectionTitle: "Connection",
      connectionBody:
        "The agent edits the open Sketch document through the Sketch desktop app's local MCP server. In Sketch, press ⌘K and choose “Start MCP Server” (or Settings → General → MCP Server), then allow Local Network access if macOS asks.",
      urlLabel: "Sketch MCP server URL",
      urlPlaceholder: "http://127.0.0.1:31126/mcp",
      urlHint:
        "Default: http://127.0.0.1:31126/mcp. A local relay (127.0.0.1:31127) forwards MCP traffic and answers the modern-protocol probe with the legacy signal Sketch needs. Saving restarts the relay without restarting the app.",
      save: "Save",
      saving: "Saving…",
      saved: "Saved. The MCP client is reconnecting.",
      test: "Test connection",
      testing: "Testing…",
      refresh: "Refresh",
      checking: "Checking…",
      unavailable: "Settings API unavailable",
      waiting: "Waiting for Sketch",
      rowMissing: "MCP client row missing",
      toolsConnected: "Sketch tools available",
      connectedTitle: "Connected",
      probeOk: "The server answered",
      probeFail: "No answer",
      emptyUrl: "Enter the MCP server URL first",
      skillsTitle: "Sketch skills",
      skillsBody:
        "These skills are registered and model-invocable while the plugin is enabled. The agent loads them on demand with the skill tool.",
      skillsCli: "Other agents can install the same sources with",
      guardrailsTitle: "Design guardrails",
      guardrailsBody:
        "Every Sketch session carries these rules in the system prompt, in addition to the skills:",
      guardrailGuide:
        "Read get_guide (topics mcp, use, layout, and symbols when relevant) before touching the document.",
      guardrailStacks:
        "No absolute positioning except page-level placement, pinned chrome, overlays, and masks. Rows, columns, cards, lists, navs, and toolbars are stacks with explicit direction, gap, padding, and alignment.",
      guardrailSymbols:
        "UI that appears 2+ times becomes a symbol master on the Symbols page plus instances with overrides.",
      guardrailTokens:
        "Colors and type come from document swatches and shared styles, never hardcoded fills or sizes.",
      guardrailPlan:
        "The agent posts the region/stack/symbol plan first, then validates with get_layer_tree_summary and get_screenshot.",
      skillFromReference: "Sketch from a reference",
      skillToCode: "Sketch to code",
      skillFromReferenceBody: "Build a Sketch design from a URL, screenshot, or code with fidelity checks.",
      skillToCodeBody: "Generate 1:1 code from a Sketch frame and map symbols to components.",
      serverLabel: "Server",
      transportLabel: "Transport",
      toolsLabel: "Tools",
      versionLabel: "Version",
      relayLabel: "Relay",
      relayListening: "listening",
      relayStarting: "starting",
      relayError: "relay error",
      relayMismatch: "The MCP client row is not pointed at the relay, so the connection cannot negotiate.",
    };

    /** Chinese strings. */
    const ZH = {
      nav: "Sketch 设计",
      connectionTitle: "连接",
      connectionBody:
        "智能体通过 Sketch 桌面版的本地 MCP 服务器编辑当前打开的 Sketch 文档。在 Sketch 中按 ⌘K 并选择“Start MCP Server”（或 设置 → 通用 → MCP Server），macOS 询问时允许本地网络访问。",
      urlLabel: "Sketch MCP 服务器地址",
      urlPlaceholder: "http://127.0.0.1:31126/mcp",
      urlHint:
        "默认：http://127.0.0.1:31126/mcp。本地中继（127.0.0.1:31127）转发 MCP 流量，并以旧版协议信号回应新协议探测。保存后中继会重启，无需重启应用。",
      save: "保存",
      saving: "保存中…",
      saved: "已保存，MCP 客户端正在重新连接。",
      test: "测试连接",
      testing: "测试中…",
      refresh: "刷新",
      checking: "检查中…",
      unavailable: "设置接口不可用",
      waiting: "等待 Sketch",
      rowMissing: "缺少 MCP 客户端配置行",
      toolsConnected: "Sketch 工具可用",
      connectedTitle: "已连接",
      probeOk: "服务器有响应",
      probeFail: "无响应",
      emptyUrl: "请先填写 MCP 服务器地址",
      skillsTitle: "Sketch 技能",
      skillsBody: "插件启用期间，这些技能已注册并可由模型调用；智能体会通过 skill 工具按需加载。",
      skillsCli: "其他智能体可使用以下命令安装同一来源的技能：",
      guardrailsTitle: "设计规范",
      guardrailsBody: "除技能外，每个 Sketch 会话的 system prompt 都会包含以下规则：",
      guardrailGuide: "改动文档前先读取 get_guide（topic 为 mcp、use、layout，涉及符号时加 symbols）。",
      guardrailStacks:
        "除页面级定位、固定顶栏、浮层和遮罩外禁止绝对定位。行、列、卡片、列表、导航和工具栏都必须是具有明确方向、间距、内边距和对齐的 stack。",
      guardrailSymbols: "出现两次及以上的 UI 必须做成符号母版并放在 Symbols 页面，实例通过覆盖项区分。",
      guardrailTokens: "颜色和字体来自文档色板与共享样式，不写死填充或字号。",
      guardrailPlan: "先给出区域/stack/符号结构计划，再用 get_layer_tree_summary 和 get_screenshot 验证。",
      skillFromReference: "从参考稿做 Sketch 设计",
      skillToCode: "Sketch 转代码",
      skillFromReferenceBody: "根据 URL、截图或代码构建 Sketch 设计，并进行视觉比对。",
      skillToCodeBody: "从 Sketch 画板生成 1:1 代码，并将符号映射为组件。",
      serverLabel: "服务器",
      transportLabel: "传输",
      toolsLabel: "工具",
      versionLabel: "版本",
      relayLabel: "中继",
      relayListening: "监听中",
      relayStarting: "启动中",
      relayError: "中继错误",
      relayMismatch: "MCP 客户端配置行未指向中继，连接无法完成协议协商。",
    };

    const CSS = `
.dshsk-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 680px;
  padding: 4px 0 40px;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
}
.dshsk-section { display: flex; flex-direction: column; gap: 10px; }
.dshsk-heading {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.dshsk-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary);
}
.dshsk-form { display: flex; flex-direction: column; gap: 8px; margin: 0; }
.dshsk-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}
.dshsk-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  outline: none;
}
.dshsk-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: 0.7; }
.dshsk-input:focus-visible { border-color: var(--dsw-alias-brand-primary); }
.dshsk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.dshsk-button {
  box-sizing: border-box;
  height: 30px;
  padding: 0 12px;
  font-family: inherit;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dshsk-button:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.dshsk-button:disabled { opacity: 0.5; cursor: default; }
.dshsk-button-primary {
  background: var(--dsw-alias-brand-primary);
  border-color: transparent;
  color: var(--dsw-alias-bg-base);
}
.dshsk-button-primary:hover:not(:disabled) { border-color: transparent; opacity: 0.92; }
.dshsk-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dshsk-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.dshsk-dot-success { background: var(--dsw-alias-state-success-primary); }
.dshsk-dot-warn { background: var(--dsw-alias-state-warn-primary); }
.dshsk-dot-error { background: var(--dsw-alias-state-error-primary); }
.dshsk-message { font-size: 12px; line-height: 1.5; }
.dshsk-message-error { color: var(--dsw-alias-state-error-primary); }
.dshsk-message-ok { color: var(--dsw-alias-state-success-primary); }
.dshsk-message-muted { color: var(--dsw-alias-label-secondary); }
.dshsk-facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 14px;
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dshsk-facts dt { color: var(--dsw-alias-label-secondary); }
.dshsk-facts dd { margin: 0; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.dshsk-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.dshsk-list li { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.dshsk-list strong { color: var(--dsw-alias-label-primary); font-weight: 500; }
.dshsk-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshsk-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
`;

    function serviceOf(ctx, name) {
      try {
        return typeof ctx.get === "function" ? ctx.get(name) : undefined;
      } catch {
        return undefined;
      }
    }

    function localeIdOf(locale) {
      try {
        const snapshot = locale?.getLocale?.();
        const id =
          typeof snapshot === "string"
            ? snapshot
            : snapshot?.id ?? snapshot?.locale ?? snapshot?.language;
        return typeof id === "string" ? id : "en";
      } catch {
        return "en";
      }
    }

    function dictionaryFor(id) {
      return /^zh/i.test(String(id)) ? ZH : EN;
    }

    function translateWith(id, key) {
      const dictionary = dictionaryFor(id);
      return dictionary[key] ?? EN[key] ?? key;
    }

    /** Re-render when the locale preference changes. */
    function useLocaleId(locale) {
      const [id, setId] = React.useState(() => localeIdOf(locale));
      React.useEffect(() => {
        if (!locale || typeof locale.subscribe !== "function") return undefined;
        const update = () => setId(localeIdOf(locale));
        update();
        return locale.subscribe(update);
      }, [locale]);
      return id;
    }

    function messageOf(error) {
      if (error instanceof Error && typeof error.message === "string") return error.message;
      return String(error);
    }

    /** One JSON call to the Host settings route. */
    async function callApi(action, init) {
      const url = new URL(API_PATH, window.location.origin);
      if (action) url.searchParams.set("action", action);
      const response = await fetch(url, init);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok || body === null || body.ok === false) {
        const reason =
          body && typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return body;
    }

    function SketchPage({ locale }) {
      const id = useLocaleId(locale);
      const t = React.useCallback((key) => translateWith(id, key), [id]);

      const [phase, setPhase] = React.useState("loading");
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [draft, setDraft] = React.useState("");
      const [saving, setSaving] = React.useState(false);
      const [probing, setProbing] = React.useState(false);
      const [probe, setProbe] = React.useState(null);
      const [notice, setNotice] = React.useState(null);

      const alive = React.useRef(true);
      const timer = React.useRef(0);

      React.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
          window.clearTimeout(timer.current);
        };
      }, []);

      const load = React.useCallback(
        async (options) => {
          const probeNow = options?.probe === true;
          const keepDraft = options?.keepDraft === true;
          try {
            const body = await callApi(probeNow ? "probe" : "status", {
              method: "GET",
              headers: { accept: "application/json" },
            });
            if (!alive.current) return;
            setState(body);
            setPhase("ready");
            setError(null);
            if (!keepDraft) {
              setDraft(typeof body.url === "string" ? body.url : "");
            }
            if (probeNow) setProbe(body.probe ?? null);
          } catch (cause) {
            if (!alive.current) return;
            setPhase("error");
            setError(messageOf(cause));
          }
        },
        [],
      );

      React.useEffect(() => {
        void load();
      }, [load]);

      const save = React.useCallback(
        async (event) => {
          if (event) event.preventDefault();
          if (saving) return;
          const value = draft.trim();
          if (value.length === 0) {
            setNotice({ kind: "error", text: t("emptyUrl") });
            return;
          }
          setSaving(true);
          setNotice(null);
          setProbe(null);
          try {
            await callApi("save", {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ url: value }),
            });
            if (!alive.current) return;
            setNotice({ kind: "ok", text: t("saved") });
            await load();
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
              if (alive.current) void load();
            }, 1500);
          } catch (cause) {
            if (!alive.current) return;
            setNotice({ kind: "error", text: messageOf(cause) });
          } finally {
            if (alive.current) setSaving(false);
          }
        },
        [draft, load, saving, t],
      );

      const runProbe = React.useCallback(async () => {
        if (probing) return;
        setProbing(true);
        setNotice(null);
        try {
          await load({ probe: true, keepDraft: true });
        } finally {
          if (alive.current) setProbing(false);
        }
      }, [load, probing]);

      let dotClass = "dshsk-dot";
      let statusText = t("checking");
      if (phase === "error") {
        dotClass = "dshsk-dot dshsk-dot-error";
        statusText = t("unavailable");
      } else if (phase === "ready" && state) {
        if (state.connected) {
          dotClass = "dshsk-dot dshsk-dot-success";
          statusText = `${t("connectedTitle")} · ${state.tools.length} ${t("toolsConnected")}`;
        } else if (!state.rowActive) {
          dotClass = "dshsk-dot dshsk-dot-error";
          statusText = t("rowMissing");
        } else {
          dotClass = "dshsk-dot dshsk-dot-warn";
          statusText = t("waiting");
        }
      }

      const skills = Array.isArray(state?.skills) ? state.skills : [];
      const relayStatus = state?.relay?.status;
      const relayText =
        relayStatus === "listening"
          ? t("relayListening")
          : relayStatus === "error"
            ? `${t("relayError")}: ${state?.relay?.error ?? ""}`
            : t("relayStarting");

      return h(
        "div",
        { className: "dshsk-page" },
        h("style", { key: "style" }, CSS),

        h(
          "section",
          { className: "dshsk-section", key: "connection" },
          h("h3", { className: "dshsk-heading" }, t("connectionTitle")),
          h("p", { className: "dshsk-text" }, t("connectionBody")),
          h(
            "form",
            { className: "dshsk-form", onSubmit: save },
            h("label", { className: "dshsk-label", htmlFor: "dshsk-mcp-url" }, t("urlLabel")),
            h("input", {
              id: "dshsk-mcp-url",
              className: "dshsk-input",
              type: "url",
              inputMode: "url",
              spellCheck: false,
              autoComplete: "off",
              placeholder: t("urlPlaceholder"),
              value: draft,
              disabled: saving,
              onChange: (event) => setDraft(event.target.value),
            }),
            h("p", { className: "dshsk-hint" }, t("urlHint")),
            h(
              "div",
              { className: "dshsk-actions" },
              h(
                "button",
                { className: "dshsk-button dshsk-button-primary", type: "submit", disabled: saving },
                saving ? t("saving") : t("save"),
              ),
              h(
                "button",
                {
                  className: "dshsk-button",
                  type: "button",
                  disabled: probing,
                  onClick: runProbe,
                },
                probing ? t("testing") : t("test"),
              ),
              h(
                "span",
                { className: "dshsk-status", role: "status" },
                h("span", { className: dotClass, "aria-hidden": true }),
                statusText,
              ),
            ),
          ),
          notice
            ? h(
                "p",
                {
                  className: `dshsk-message dshsk-message-${notice.kind === "ok" ? "ok" : "error"}`,
                  role: "status",
                  "aria-live": "polite",
                },
                notice.text,
              )
            : null,
          error
            ? h("p", { className: "dshsk-message dshsk-message-error" }, error)
            : null,
          probe
            ? h(
                "p",
                {
                  className: `dshsk-message ${
                    probe.reachable ? "dshsk-message-muted" : "dshsk-message-error"
                  }`,
                },
                probe.reachable
                  ? `${t("probeOk")} (HTTP ${probe.status})`
                  : `${t("probeFail")}: ${probe.error ?? ""}`,
              )
            : null,
          state
            ? h(
                "dl",
                { className: "dshsk-facts" },
                h("dt", null, t("serverLabel")),
                h("dd", null, state.serverName ?? "sketch"),
                h("dt", null, t("transportLabel")),
                h("dd", null, state.transport ?? "streamable-http"),
                h("dt", null, t("relayLabel")),
                h("dd", null, `${state.proxyUrl ?? ""} · ${relayText}`),
                h("dt", null, t("toolsLabel")),
                h("dd", null, String(state.tools?.length ?? 0)),
                h("dt", null, t("versionLabel")),
                h("dd", null, String(state.version ?? "")),
              )
            : null,
          state && state.rowUsesRelay === false
            ? h("p", { className: "dshsk-message dshsk-message-error" }, t("relayMismatch"))
            : null,
        ),

        h(
          "section",
          { className: "dshsk-section", key: "skills" },
          h("h3", { className: "dshsk-heading" }, t("skillsTitle")),
          h("p", { className: "dshsk-text" }, t("skillsBody")),
          h(
            "ul",
            { className: "dshsk-list" },
            h(
              "li",
              null,
              h("strong", null, t("skillFromReference")),
              ` — ${t("skillFromReferenceBody")}`,
            ),
            h(
              "li",
              null,
              h("strong", null, t("skillToCode")),
              ` — ${t("skillToCodeBody")}`,
            ),
          ),
          skills.length > 0
            ? h(
                "p",
                { className: "dshsk-hint" },
                `${t("skillsCli")} `,
                h("code", { className: "dshsk-code" }, "npx skills add sketch-hq/agents"),
              )
            : null,
        ),

        h(
          "section",
          { className: "dshsk-section", key: "guardrails" },
          h("h3", { className: "dshsk-heading" }, t("guardrailsTitle")),
          h("p", { className: "dshsk-text" }, t("guardrailsBody")),
          h(
            "ul",
            { className: "dshsk-list" },
            h("li", null, t("guardrailGuide")),
            h("li", null, t("guardrailStacks")),
            h("li", null, t("guardrailSymbols")),
            h("li", null, t("guardrailTokens")),
            h("li", null, t("guardrailPlan")),
          ),
        ),
      );
    }

    return {
      inject: ["slots"],
      apply(ctx) {
        const locale = serviceOf(ctx, "locale");
        if (locale && typeof locale.register === "function") {
          ctx.effect(() => {
            const disposers = [];
            for (const [localeName, dictionary] of [
              ["en", EN],
              ["zh", ZH],
            ]) {
              try {
                const dispose = locale.register(NS, localeName, dictionary);
                if (typeof dispose === "function") disposers.push(dispose);
              } catch (error) {
                console.error("dsh-sketch: locale registration failed", error);
              }
            }
            return () => {
              for (const dispose of disposers) {
                try {
                  dispose();
                } catch {
                  // Already gone with the locale service.
                }
              }
            };
          });
        }

        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            {
              name: "settings.section",
              id: "sketch",
              order: 17,
              label: () => translateWith(localeIdOf(locale), "nav"),
            },
            () => h(SketchPage, { locale }),
          ),
        );
      },
    };
  },
});
