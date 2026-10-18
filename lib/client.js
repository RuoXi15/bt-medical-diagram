window.__ModuleLoader__.load({ id: "bt-medical-diagram", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
var API = "/bt-medical-diagram";
var SIZES = ["1024x1024", "1024x1536", "1536x1024", "1792x1024", "1024x1792"];
var CHANNELS = ["workbuddy", "qwenwork"];
var card = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(15,118,110,0.14)",
  borderRadius: 16,
  boxShadow: "0 8px 28px rgba(15,118,110,0.08)",
  padding: 20
};
var inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#ffffff",
  border: "1px solid #d7e3e1",
  borderRadius: 10,
  outline: "none",
  fontFamily: "inherit"
};
var labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "#0f766e"
};
var fieldWrap = { marginBottom: 14 };
var btnPrimary = {
  padding: "10px 22px",
  fontSize: 13,
  fontWeight: 600,
  color: "#ffffff",
  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 55%, #115e59 100%)",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 4px 14px rgba(13,148,136,0.28)"
};
var btnGhost = {
  ...btnPrimary,
  background: "#ffffff",
  color: "#0f766e",
  border: "1px solid #99d5cf",
  boxShadow: "none"
};
var btnDisabled = { ...btnPrimary, opacity: 0.55, cursor: "not-allowed" };
var hintStyle = { fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.6 };
async function callApi(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body === void 0 ? "GET" : "POST",
    headers: body === void 0 ? void 0 : { "Content-Type": "application/json" },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${res.status}`);
  return await res.json();
}
function WorkspaceComponent({ ctx }) {
  const [request, setRequest] = (0, import_react.useState)("");
  const [size, setSize] = (0, import_react.useState)("1024x1024");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [stage, setStage] = (0, import_react.useState)("idle");
  const [preview, setPreview] = (0, import_react.useState)(null);
  const [result, setResult] = (0, import_react.useState)(null);
  const [config, setConfig] = (0, import_react.useState)(null);
  const [bootError, setBootError] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    callApi("/config").then(setConfig).catch((error) => setBootError(error instanceof Error ? error.message : String(error)));
  }, []);
  const previewPrompt = (0, import_react.useCallback)(async () => {
    if (!request.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setStage("prompt");
    try {
      const res = await callApi(
        "/prompt",
        { request }
      );
      if (res.ok && res.optimizedPrompt) {
        setPreview({ type: res.illustrationType ?? "\u672A\u77E5", prompt: res.optimizedPrompt });
      } else {
        setResult({ ok: false, message: res.message ?? "Prompt \u4F18\u5316\u5931\u8D25\u3002" });
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [request, busy]);
  const run = (0, import_react.useCallback)(async () => {
    if (!request.trim() || busy) return;
    setBusy(true);
    setStage("generating");
    setResult(null);
    try {
      const res = await callApi("/generate", { request, size });
      setResult(res);
      if (res.ok && res.optimizedPrompt) {
        setPreview({ type: res.illustrationType ?? "\u672A\u77E5", prompt: res.optimizedPrompt });
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setStage("idle");
    }
  }, [request, size, busy]);
  const imageSrc = (0, import_react.useMemo)(() => {
    if (!result?.ok) return "";
    if (result.imageUrl) return result.imageUrl;
    return result.b64Json ? `data:image/png;base64,${result.b64Json}` : "";
  }, [result]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, maxWidth: 880, margin: "0 auto", fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif' }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 19 }, children: "\u{1FA7A}" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }, children: "\u533B\u5B66\u4E13\u4E1A\u56FE\u793A\u751F\u6210" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "0 0 18px", fontSize: 12, color: "#64748b" }, children: "\u8F93\u5165\u533B\u5B66\u56FE\u793A\u9700\u6C42\uFF0C\u81EA\u52A8\u4F18\u5316\u4E3A\u4E13\u4E1A Prompt \u540E\u8C03\u7528\u767E\u901A\u751F\u56FE\u670D\u52A1\u3002" }),
    config && !config.hasCredentials && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          marginBottom: 16,
          padding: "10px 14px",
          fontSize: 12,
          color: "#92400e",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10
        },
        children: "\u26A0\uFE0F \u5C1A\u672A\u914D\u7F6E\u767E\u901A\u51ED\u636E\uFF0C\u8BF7\u5148\u5728\u300C\u63D2\u4EF6\u8BBE\u7F6E \u2192 bt-medical-diagram\u300D\u4E2D\u586B\u5199\u670D\u52A1\u5730\u5740\u3001AppKey \u4E0E AppSecret\u3002"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: fieldWrap, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u56FE\u793A\u9700\u6C42" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          value: request,
          onChange: (e) => setRequest(e.target.value),
          placeholder: "\u4F8B\u5982\uFF1A\u751F\u6210\u4E00\u5F20\u53F8\u7F8E\u683C\u9C81\u80BD\u964D\u7CD6\u673A\u5236\u56FE",
          rows: 3,
          style: { ...inputStyle, resize: "vertical", lineHeight: 1.7 }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u652F\u6301\uFF1A\u836F\u7269\u4F5C\u7528\u673A\u5236 / \u75BE\u75C5\u673A\u5236 / \u8BCA\u7597\u6D41\u7A0B / \u89E3\u5256\u751F\u7406 / \u533B\u5B66\u5BF9\u6BD4 / \u60A3\u8005\u6559\u80B2\u3002\u4EC5\u7EC4\u7EC7\u4F60\u63D0\u4F9B\u7684\u533B\u5B66\u5BF9\u8C61\uFF0C\u4E0D\u8865\u9020\u5242\u91CF\u4E0E\u7597\u6548\u7ED3\u8BBA\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: 180 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u51FA\u56FE\u5C3A\u5BF8" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: size, onChange: (e) => setSize(e.target.value), style: inputStyle, children: SIZES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: s, children: s }, s)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: previewPrompt, disabled: busy || !request.trim(), style: btnGhost, children: "\u4EC5\u9884\u89C8 Prompt" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: run, disabled: busy || !request.trim(), style: busy ? btnDisabled : btnPrimary, children: busy ? stage === "prompt" ? "\u4F18\u5316\u4E2D\u2026" : "\u751F\u6210\u4E2D\uFF0C\u8BF7\u7A0D\u5019\u2026" : "\u751F\u6210\u533B\u5B66\u56FE\u793A" })
      ] })
    ] }),
    preview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, fontWeight: 600, color: "#0f766e", marginBottom: 6 }, children: [
        "\u4F18\u5316\u540E Prompt \xB7 \u7C7B\u578B\uFF1A",
        preview.type
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
            color: "#334155",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            wordBreak: "break-word"
          },
          children: preview.prompt
        }
      )
    ] }),
    result && !result.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          padding: 12,
          fontSize: 12,
          lineHeight: 1.8,
          color: "#991b1b",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          whiteSpace: "pre-wrap"
        },
        children: [
          result.message,
          result.retryReasons?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: { margin: "8px 0 0", paddingLeft: 18 }, children: result.retryReasons.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: r }, i)) }) : null
        ]
      }
    ),
    imageSrc && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, fontWeight: 600, color: "#0f766e", marginBottom: 8 }, children: "\u751F\u6210\u7ED3\u679C" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "img",
        {
          src: imageSrc,
          alt: result?.illustrationType ?? "\u533B\u5B66\u56FE\u793A",
          style: {
            width: "100%",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#ffffff"
          }
        }
      ),
      result?.imageUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "a",
        {
          href: result.imageUrl,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "inline-block", marginTop: 10, fontSize: 12, color: "#0d9488" },
          children: "\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u539F\u56FE \u2197"
        }
      )
    ] }),
    bootError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 14, fontSize: 12, color: "#b91c1c" }, children: [
      "\u914D\u7F6E\u8BFB\u53D6\u5931\u8D25\uFF1A",
      bootError
    ] })
  ] });
}
function SettingsComponent({ ctx }) {
  const [form, setForm] = (0, import_react.useState)({
    baseUrl: "",
    appKey: "",
    appSecret: "",
    channel: "workbuddy",
    skillCode: "BT_08DA7C1A",
    timeoutSeconds: 300,
    maxAttempts: 3,
    retryOnTimeout: true,
    defaultSize: "1024x1024"
  });
  const [secretTip, setSecretTip] = (0, import_react.useState)("");
  const [status, setStatus] = (0, import_react.useState)("");
  const [saving, setSaving] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    callApi("/config").then((cfg) => {
      setForm({
        baseUrl: cfg.baseUrl ?? "",
        appKey: cfg.appKey ?? "",
        appSecret: "",
        channel: cfg.channel ?? "workbuddy",
        skillCode: cfg.skillCode ?? "BT_08DA7C1A",
        timeoutSeconds: cfg.timeoutSeconds ?? 300,
        maxAttempts: cfg.maxAttempts ?? 3,
        retryOnTimeout: cfg.retryOnTimeout ?? true,
        defaultSize: cfg.defaultSize ?? "1024x1024"
      });
      setSecretTip(cfg.hasAppSecret ? `\u5DF2\u914D\u7F6E\uFF08${cfg.appSecretMasked}\uFF09\uFF0C\u7559\u7A7A\u5219\u4FDD\u6301\u4E0D\u53D8` : "\u5C1A\u672A\u914D\u7F6E");
    }).catch(() => setSecretTip("\u8BFB\u53D6\u914D\u7F6E\u5931\u8D25"));
  }, []);
  const save = (0, import_react.useCallback)(async () => {
    setSaving(true);
    setStatus("\u4FDD\u5B58\u4E2D\u2026");
    try {
      const payload = { ...form };
      if (!form.appSecret) delete payload.appSecret;
      const res = await callApi("/config", payload);
      setStatus(`\u5DF2\u4FDD\u5B58${res.changed?.length ? `\uFF08\u66F4\u65B0\uFF1A${res.changed.join("\u3001")}\uFF09` : "\uFF08\u65E0\u53D8\u66F4\uFF09"}`);
      if (form.appSecret) setSecretTip("\u5DF2\u66F4\u65B0");
      setForm((f) => ({ ...f, appSecret: "" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [form]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif' }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#0f172a" }, children: "\u767E\u901A\u751F\u56FE\u670D\u52A1\u914D\u7F6E" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "0 0 18px", fontSize: 12, color: "#64748b" }, children: "\u51ED\u636E\u4EC5\u4FDD\u5B58\u5728\u672C\u673A\u63D2\u4EF6\u914D\u7F6E\u4E2D\uFF0C\u4E0D\u4F1A\u5199\u5165\u65E5\u5FD7\u6216\u968F\u5305\u5206\u53D1\u3002\u73AF\u5883\u53D8\u91CF\u4F18\u5148\u7EA7\u66F4\u9AD8\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: fieldWrap, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u670D\u52A1\u5730\u5740 Base URL" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          value: form.baseUrl,
          onChange: (e) => setForm({ ...form, baseUrl: e.target.value }),
          placeholder: "https://your-host",
          style: inputStyle
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: hintStyle, children: [
        "\u53EF\u586B ",
        `{host}`,
        "\u3001",
        `{host}/api`,
        " \u6216 ",
        `{host}/baitong_ai/api`,
        "\uFF0C\u63D2\u4EF6\u4F1A\u81EA\u52A8\u5F52\u4E00\u5316\u5230 ",
        `{host}/baitong_ai/api/skill/generateImage`,
        "\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 220px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "AppKey" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.appKey, onChange: (e) => setForm({ ...form, appKey: e.target.value }), style: inputStyle })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 220px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "AppSecret" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "password",
            value: form.appSecret,
            onChange: (e) => setForm({ ...form, appSecret: e.target.value }),
            placeholder: secretTip,
            style: inputStyle
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 150px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u63A5\u5165\u65B9 channel" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: form.channel, onChange: (e) => setForm({ ...form, channel: e.target.value }), style: inputStyle, children: CHANNELS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: c, children: c }, c)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 150px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u6280\u80FD\u7F16\u7801 skillCode" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: form.skillCode, onChange: (e) => setForm({ ...form, skillCode: e.target.value }), style: inputStyle })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 120px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u8D85\u65F6\uFF08\u79D2\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "number",
            min: 10,
            value: form.timeoutSeconds,
            onChange: (e) => setForm({ ...form, timeoutSeconds: Number(e.target.value) }),
            style: inputStyle
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 120px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u5C1D\u8BD5\u6B21\u6570" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "number",
            min: 1,
            max: 6,
            value: form.maxAttempts,
            onChange: (e) => setForm({ ...form, maxAttempts: Number(e.target.value) }),
            style: inputStyle
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 150px", ...fieldWrap }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: labelStyle, children: "\u9ED8\u8BA4\u5C3A\u5BF8" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: form.defaultSize, onChange: (e) => setForm({ ...form, defaultSize: e.target.value }), style: inputStyle, children: SIZES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: s, children: s }, s)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16, color: "#334155" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "checkbox",
          checked: form.retryOnTimeout,
          onChange: (e) => setForm({ ...form, retryOnTimeout: e.target.checked })
        }
      ),
      "\u8BFB\u8D85\u65F6\u540E\u81EA\u52A8\u91CD\u8BD5",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: hintStyle, children: "\u26A0\uFE0F \u751F\u6210\u7C7B\u63A5\u53E3\u6309\u79EF\u5206\u8BA1\u8D39\uFF0C\u5173\u95ED\u53EF\u907F\u514D\u91CD\u590D\u751F\u6210\u4E0E\u91CD\u590D\u6263\u8D39\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: save, disabled: saving, style: saving ? btnDisabled : btnPrimary, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u914D\u7F6E" }),
      status && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: status.startsWith("\u5DF2\u4FDD\u5B58") ? "#0f766e" : "#b91c1c" }, children: status })
    ] })
  ] });
}
var overlayListeners = /* @__PURE__ */ new Set();
var overlayOpen = false;
function setOverlay(open) {
  overlayOpen = open;
  for (const listener of overlayListeners) listener(open);
}
function OverlayHost({ ctx }) {
  const [open, setOpen] = import_react.default.useState(overlayOpen);
  import_react.default.useEffect(() => {
    overlayListeners.add(setOpen);
    return () => {
      overlayListeners.delete(setOpen);
    };
  }, []);
  if (!open) return null;
  return import_react.default.createElement(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 2147483e3,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) setOverlay(false);
      }
    },
    import_react.default.createElement(
      "div",
      {
        style: {
          width: "min(880px, 100%)",
          maxHeight: "86vh",
          overflow: "auto",
          background: "#ffffff",
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)"
        }
      },
      import_react.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
        import_react.default.createElement("strong", { style: { fontSize: 15 } }, "\u533B\u5B66\u4E13\u4E1A\u56FE\u793A\u751F\u6210"),
        import_react.default.createElement(
          "button",
          {
            type: "button",
            onClick: () => setOverlay(false),
            style: { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }
          },
          "\u5173\u95ED"
        )
      ),
      import_react.default.createElement(WorkspaceComponent, { ctx })
    )
  );
}
function FooterEntry({ ctx }) {
  return import_react.default.createElement(
    "button",
    {
      type: "button",
      title: "\u533B\u5B66\u56FE\u793A",
      onClick: () => {
        console.info("[bt-medical-diagram] footer click -> open overlay");
        setOverlay(true);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        color: "#0f172a",
        fontSize: 12,
        cursor: "pointer"
      }
    },
    "\u533B\u5B66\u56FE\u793A"
  );
}
function apply(ctx) {
  const log = (...args) => console.info("[bt-medical-diagram]", ...args);
  const fail = (...args) => console.error("[bt-medical-diagram]", ...args);
  const wrap = (Component) => () => import_react.default.createElement(Component, { ctx });
  const TAB_KIND = "bt-medical-diagram";
  log("apply() start", { hasSlots: !!ctx.slots, hasGet: typeof ctx.get === "function" });
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject(
        "sidebar.footer.action",
        () => ctx.slots.register(
          { name: "sidebar.footer.action", id: "bt-medical-diagram", key: "bt-medical-diagram", order: 9, label: () => "\u533B\u5B66\u56FE\u793A" },
          wrap(FooterEntry)
        )
      );
      log("registered sidebar.footer.action", typeof dispose);
      return dispose;
    } catch (error) {
      fail("sidebar.footer.action failed", error);
      return () => {
      };
    }
  }, "bt-medical-diagram: footer action");
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject(
        "shell.overlay",
        () => ctx.slots.register(
          { name: "shell.overlay", id: "bt-medical-diagram-overlay", label: () => "\u533B\u5B66\u56FE\u793A" },
          wrap(OverlayHost)
        )
      );
      log("registered shell.overlay", typeof dispose);
      return dispose;
    } catch (error) {
      fail("shell.overlay failed", error);
      return () => {
      };
    }
  }, "bt-medical-diagram: overlay host");
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject(
        "plugins.bundle.config",
        () => ctx.slots.register(
          { name: "plugins.bundle.config", key: "bt-medical-diagram", inject: () => ({}) },
          wrap(SettingsComponent)
        )
      );
      log("registered plugins.bundle.config", typeof dispose);
      return dispose;
    } catch (error) {
      fail("plugins.bundle.config failed", error);
      return () => {
      };
    }
  }, "bt-medical-diagram: config card");
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject(
        "settings.section",
        () => ctx.slots.register(
          { name: "settings.section", id: "bt-medical-diagram", order: 12, label: () => "\u533B\u5B66\u56FE\u793A", inject: () => ({}) },
          wrap(WorkspaceComponent)
        )
      );
      log("registered settings.section", typeof dispose);
      return dispose;
    } catch (error) {
      fail("settings.section failed", error);
      return () => {
      };
    }
  }, "bt-medical-diagram: settings section");
  ctx.effect(() => {
    const disposers = [];
    try {
      const tabs = typeof ctx.get === "function" ? ctx.get("sidebarRightTabs") : void 0;
      log("sidebarRightTabs =", !!tabs);
      const disposeType = tabs?.register?.({ id: TAB_KIND, kind: TAB_KIND, title: () => "\u533B\u5B66\u56FE\u793A" });
      if (typeof disposeType === "function") disposers.push(disposeType);
      disposers.push(
        ctx.slots.inject(
          "sidebar.right.pane.tab",
          () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_KIND }, wrap(WorkspaceComponent))
        )
      );
      disposers.push(
        ctx.slots.inject(
          "sidebar.right.pane.tab.title",
          () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_KIND }, () => "\u533B\u5B66\u56FE\u793A")
        )
      );
      log("registered right pane seats", disposers.length);
    } catch (error) {
      fail("right pane tab failed", error);
    }
    return () => {
      for (const dispose of disposers.reverse()) {
        try {
          dispose();
        } catch {
        }
      }
    };
  }, "bt-medical-diagram: right pane tab");
}


return module.exports;
} });
