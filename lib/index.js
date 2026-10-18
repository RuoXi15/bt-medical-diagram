// src/baitong-client.ts
import { createHash } from "node:crypto";
var IMAGE_PATH = "/baitong_ai/api/skill/generateImage";
var API_PATH_PREFIX = "/baitong_ai";
var RETRYABLE_HTTP_STATUSES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var RETRYABLE_BUSINESS_CODES = /* @__PURE__ */ new Set([503]);
var RATE_LIMIT_HINTS = [
  "\u9891\u7E41",
  "\u9650\u6D41",
  "\u8BF7\u7A0D\u540E\u518D\u8BD5",
  "too many",
  "rate limit",
  "timeout",
  "\u8D85\u65F6",
  "busy"
];
var NON_RETRYABLE_HINTS = ["\u53C2\u6570", "\u4E0D\u80FD\u4E3A\u7A7A", "\u957F\u5EA6", "\u6821\u9A8C", "\u975E\u6CD5", "invalid", "must be", "required"];
var RETRY_BASE_SECONDS = 2;
var RETRY_MAX_SECONDS = 30;
var RETRY_JITTER = 0.2;
var BaitongRequestError = class extends Error {
  retries;
  constructor(message, retries = []) {
    super(retries.length ? `${message} (\u5DF2\u91CD\u8BD5 ${retries.length} \u6B21)` : message);
    this.name = "BaitongRequestError";
    this.retries = retries;
  }
};
function md5Hex(input) {
  return createHash("md5").update(input, "utf8").digest("hex");
}
function normalizeBaseUrl(raw) {
  let base = raw.trim().replace(/\/+$/, "");
  const marker = base.indexOf(API_PATH_PREFIX);
  if (marker !== -1) {
    base = base.slice(0, marker);
  } else if (base.endsWith("/api")) {
    base = base.slice(0, -"/api".length);
  }
  return base.replace(/\/+$/, "");
}
function buildImageUrl(baseUrl, channel, skillCode) {
  const base = normalizeBaseUrl(baseUrl);
  const query = new URLSearchParams({ channel, skillCode }).toString();
  return `${base}${IMAGE_PATH}?${query}`;
}
function isSuccess(body) {
  if (!body) return false;
  const code = String(body.code);
  return code === "200" || code === "0";
}
function backoffSeconds(failedAttempt) {
  const base = Math.min(RETRY_BASE_SECONDS * 2 ** Math.max(0, failedAttempt - 1), RETRY_MAX_SECONDS);
  const jittered = base * (1 + (Math.random() * 2 - 1) * RETRY_JITTER);
  return Math.max(0, jittered);
}
function classifyBusinessFailure(status, body) {
  const rawCode = body.code;
  const msg = String(body.msg ?? "");
  const description = `HTTP ${status} / code ${rawCode}: ${msg}`;
  const numericCode = Number(rawCode);
  if (NON_RETRYABLE_HINTS.some((hint) => msg.toLowerCase().includes(hint.toLowerCase()))) {
    return { retryable: false, description };
  }
  if (Number.isFinite(numericCode) && RETRYABLE_BUSINESS_CODES.has(numericCode)) {
    return { retryable: true, description };
  }
  if (Number.isFinite(numericCode) && numericCode >= 500 && RATE_LIMIT_HINTS.some((hint) => msg.toLowerCase().includes(hint))) {
    return { retryable: true, description };
  }
  if (RETRYABLE_HTTP_STATUSES.has(status) && !Number.isFinite(numericCode)) {
    return { retryable: true, description };
  }
  return { retryable: false, description };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var BaitongImageClient = class {
  constructor(settings) {
    this.settings = settings;
  }
  settings;
  headers() {
    const { appKey, appSecret } = this.settings;
    if (!appKey || !appSecret) {
      throw new BaitongRequestError("\u767E\u901A AppKey / AppSecret \u672A\u914D\u7F6E\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u9762\u677F\u586B\u5199\u51ED\u636E\u3002");
    }
    const timestamp = String(Date.now());
    return {
      "Content-Type": "application/json",
      "X-App-Key": appKey,
      "X-Timestamp": timestamp,
      "X-Sign": md5Hex(`${appKey}${timestamp}${appSecret}`)
    };
  }
  async attempt(url, payload) {
    const timeoutMs = this.settings.timeoutSeconds * 1e3;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      const aborted = controller.signal.aborted;
      const detail = error instanceof Error ? error.message : String(error);
      if (aborted) {
        return {
          body: null,
          error: `\u767E\u901A\u8BF7\u6C42\u5728 ${this.settings.timeoutSeconds} \u79D2\u540E\u8D85\u65F6\uFF1A${detail}`,
          retryable: this.settings.retryOnTimeout,
          reason: `timeout after ${this.settings.timeoutSeconds}s`
        };
      }
      return {
        body: null,
        error: `\u767E\u901A\u7F51\u7EDC\u9519\u8BEF\uFF1A${detail}`,
        retryable: true,
        reason: `network error: ${detail}`
      };
    } finally {
      clearTimeout(timer);
    }
    const status = response.status;
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        body: null,
        error: `\u767E\u901A\u8FD4\u56DE\u975E JSON \u54CD\u5E94 HTTP ${status}\uFF1A${text.slice(0, 500)}`,
        retryable: RETRYABLE_HTTP_STATUSES.has(status),
        reason: `non-JSON HTTP ${status}`
      };
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { body: null, error: "\u767E\u901A\u8FD4\u56DE\u7684 JSON \u4E0D\u662F\u5BF9\u8C61\u3002", retryable: false, reason: "non-object JSON" };
    }
    const record = body;
    if (isSuccess(record)) {
      return { body: record, error: null, retryable: false, reason: "" };
    }
    const { retryable, description } = classifyBusinessFailure(status, record);
    return { body: record, error: description, retryable, reason: description };
  }
  async generateImage(prompt, options = {}) {
    const { baseUrl, channel, skillCode } = this.settings;
    if (!baseUrl) {
      throw new BaitongRequestError("\u767E\u901A\u670D\u52A1\u5730\u5740\u672A\u914D\u7F6E\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u9762\u677F\u586B\u5199 Base URL\u3002");
    }
    const payload = {
      prompt,
      n: options.n ?? 1,
      responseFormat: "url"
    };
    if (options.size) payload.size = options.size;
    const url = buildImageUrl(baseUrl, channel, skillCode);
    const attempts = Math.max(1, Math.floor(this.settings.maxAttempts));
    const retryReasons = [];
    let last = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      last = await this.attempt(url, payload);
      if (isSuccess(last.body)) {
        const body = last.body;
        const result = {
          code: body.code ?? 200,
          msg: String(body.msg ?? "ok"),
          data: body.data ?? null
        };
        if (retryReasons.length) {
          result.retries = retryReasons.length;
          result.retryReasons = retryReasons;
        }
        return result;
      }
      if (!last.retryable || attempt >= attempts) break;
      retryReasons.push(`\u7B2C ${attempt} \u6B21\u5C1D\u8BD5\uFF1A${last.reason}`);
      await sleep(backoffSeconds(attempt) * 1e3);
    }
    if (last?.body) {
      const result = {
        code: last.body.code ?? null,
        msg: String(last.body.msg ?? last.error ?? "\u767E\u901A\u8FD4\u56DE\u672A\u77E5\u5931\u8D25"),
        data: last.body.data ?? null
      };
      if (retryReasons.length) {
        result.retries = retryReasons.length;
        result.retryReasons = retryReasons;
      }
      return result;
    }
    throw new BaitongRequestError(last?.error ?? "\u767E\u901A\u8BF7\u6C42\u5931\u8D25\u3002", retryReasons);
  }
};
function extractImage(result) {
  const image = result.data?.images?.[0];
  if (!image) return null;
  return { url: image.url, b64Json: image.b64Json };
}

// src/prompt-builder.ts
var PROMPT_MAX_LENGTH = 4e3;
var TYPE_RULES = [
  {
    type: "drug_mechanism",
    keywords: ["\u4F5C\u7528\u673A\u5236", "\u836F\u7269", "\u53D7\u4F53", "\u9776\u70B9", "\u964D\u7CD6", "\u836F\u7406"],
    guidance: "drug action mechanism with target, organ/cell pathway, directional arrows, and therapeutic effect"
  },
  {
    type: "disease_mechanism",
    keywords: ["\u53D1\u75C5\u673A\u5236", "\u75BE\u75C5\u673A\u5236", "\u75C5\u7406", "\u75C5\u56E0", "\u53D1\u75C5"],
    guidance: "disease pathogenesis diagram with risk factors, pathophysiological cascade, and clinical consequences"
  },
  {
    type: "medical_flowchart",
    keywords: ["\u6D41\u7A0B", "\u8DEF\u5F84", "\u8BCA\u7597", "\u7B5B\u67E5", "\u7BA1\u7406", "\u6B65\u9AA4"],
    guidance: "clinical process flowchart with ordered steps, decision nodes, and directional arrows"
  },
  {
    type: "medical_comparison",
    keywords: ["\u533A\u522B", "\u5BF9\u6BD4", "\u6BD4\u8F83", "vs", "VS"],
    guidance: "side-by-side comparison infographic with balanced columns, aligned dimensions, and contrasting visual encoding"
  },
  {
    type: "patient_education",
    keywords: ["\u60A3\u8005\u6559\u80B2", "\u5BA3\u6559", "\u79D1\u666E", "\u6CE8\u5C04", "\u81EA\u6211\u7BA1\u7406", "\u4F9D\u4ECE\u6027"],
    guidance: "patient education infographic with simple visual sequence, inclusive people, and non-alarming presentation"
  },
  {
    type: "anatomy_physiology",
    keywords: ["\u7ED3\u6784", "\u89E3\u5256", "\u751F\u7406", "\u5668\u5B98", "\u7EC4\u7EC7"],
    guidance: "anatomy and physiology schematic with accurate relative spatial relationships and callout labels"
  }
];
var FALLBACK = {
  type: "medical_concept",
  keywords: [],
  guidance: "medical concept diagram with causal relationships, layered structure, and directional arrows"
};
var ALLOWED_SIZES = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1792x1024",
  "1024x1792"
];
var DEFAULT_SIZE = "1024x1024";
function classifyIllustrationType(request) {
  const haystack = request.toLowerCase();
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return { type: rule.type, guidance: rule.guidance };
    }
  }
  return { type: FALLBACK.type, guidance: FALLBACK.guidance };
}
function buildMedicalPrompt(request) {
  const subject = request.trim();
  if (!subject) {
    throw new Error("\u533B\u5B66\u56FE\u793A\u9700\u6C42\u4E0D\u80FD\u4E3A\u7A7A\u3002");
  }
  const { type, guidance } = classifyIllustrationType(subject);
  const optimizedPrompt = [
    "Professional medical textbook illustration and medical infographic for a medical conference, training, or pharmaceutical PPT.",
    `Illustration type: ${type}.`,
    `Subject from user request: ${subject}.`,
    `Composition: ${guidance}.`,
    "Use a clean light background, restrained clinical blue and teal palette, clear hierarchy, precise directional arrows, publication-ready vector-like rendering, and generous space for legible Chinese labels.",
    "Show only concepts explicitly supplied by the user; do not invent dosage, efficacy statistics, clinical claims, or guideline recommendations."
  ].join(" ");
  if (optimizedPrompt.length > PROMPT_MAX_LENGTH) {
    throw new Error(
      `\u4F18\u5316\u540E\u7684\u533B\u5B66\u56FE\u793A Prompt \u957F\u5EA6 ${optimizedPrompt.length} \u5B57\u7B26\uFF0C\u8D85\u8FC7\u767E\u901A\u63A5\u53E3 ${PROMPT_MAX_LENGTH} \u5B57\u7B26\u4E0A\u9650\uFF0C\u8BF7\u7F29\u5C0F\u9700\u6C42\u8303\u56F4\u540E\u91CD\u8BD5\u3002`
    );
  }
  return { illustrationType: type, optimizedPrompt };
}
function normalizeSize(size) {
  const raw = (size ?? "").trim();
  if (!raw) return DEFAULT_SIZE;
  return ALLOWED_SIZES.includes(raw) ? raw : DEFAULT_SIZE;
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  baseUrl: "",
  appKey: "",
  appSecret: "",
  channel: "workbuddy",
  skillCode: "BT_08DA7C1A",
  timeoutSeconds: 300,
  maxAttempts: 3,
  retryOnTimeout: true,
  defaultSize: DEFAULT_SIZE
};
var WRITABLE_KEYS = [
  "baseUrl",
  "appKey",
  "appSecret",
  "channel",
  "skillCode",
  "timeoutSeconds",
  "maxAttempts",
  "retryOnTimeout",
  "defaultSize"
];
var ENV_KEYS = {
  baseUrl: ["BAITONG_API_BASE_URL", "BAITONG_BASE_URL"],
  appKey: ["BAITONG_APP_KEY"],
  appSecret: ["BAITONG_APP_SECRET"],
  channel: ["BAITONG_CHANNEL", "CHANNEL"],
  skillCode: ["BAITONG_SKILL_CODE", "SKILL_CODE"],
  timeoutSeconds: ["BAITONG_TIMEOUT_SECONDS", "BAITONG_TIMEOUT"],
  maxAttempts: ["BAITONG_MAX_ATTEMPTS", "BAITONG_RETRY_ATTEMPTS"],
  retryOnTimeout: ["BAITONG_RETRY_ON_TIMEOUT"],
  defaultSize: ["BAITONG_DEFAULT_SIZE"]
};
var NUMERIC_KEYS = /* @__PURE__ */ new Set(["timeoutSeconds", "maxAttempts"]);
function envFirst(keys) {
  for (const key of keys) {
    const value = process.env?.[key]?.trim();
    if (value) return value;
  }
  return "";
}
function coerce(key, raw) {
  if (key === "retryOnTimeout") {
    if (typeof raw === "boolean") return raw;
    const text2 = String(raw).trim().toLowerCase();
    if (["1", "true", "yes", "on", "y"].includes(text2)) return true;
    if (["0", "false", "no", "off", "n"].includes(text2)) return false;
    return void 0;
  }
  if (NUMERIC_KEYS.has(key)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : void 0;
  }
  const text = String(raw ?? "").trim();
  return text || void 0;
}
var SettingsStore = class {
  persisted = { ...DEFAULT_SETTINGS };
  constructor(initial) {
    if (initial) this.persisted = { ...this.persisted, ...initial };
  }
  /** 合并设置面板提交的部分字段，返回被实际改动的键。 */
  patch(input) {
    const changed = [];
    for (const key of WRITABLE_KEYS) {
      if (!(key in input)) continue;
      const value = coerce(key, input[key]);
      if (value === void 0) continue;
      if (this.persisted[key] !== value) {
        ;
        this.persisted[key] = value;
        changed.push(key);
      }
    }
    return changed;
  }
  /** 生效配置：环境变量覆盖持久化值。 */
  effective() {
    const resolved = { ...this.persisted };
    for (const key of WRITABLE_KEYS) {
      const raw = envFirst(ENV_KEYS[key]);
      if (!raw) continue;
      const value = coerce(key, raw);
      if (value !== void 0) {
        ;
        resolved[key] = value;
      }
    }
    return resolved;
  }
  /** 对外暴露的快照：AppSecret 脱敏，只回传是否已配置与末 4 位。 */
  snapshot() {
    const settings = this.effective();
    const secret = settings.appSecret;
    return {
      ...settings,
      appSecret: "",
      appSecretMasked: secret ? `****${secret.slice(-4)}` : "",
      hasAppSecret: Boolean(secret),
      hasCredentials: Boolean(settings.baseUrl && settings.appKey && secret)
    };
  }
};

// src/index.ts
var inject = ["webServer"];
var ROUTE_PREFIX = "/bt-medical-diagram";
function formatFailure(result) {
  const lines = [`\u751F\u6210\u5931\u8D25\uFF1Acode=${result.code}\uFF0Cmsg=${result.msg}`];
  if (result.retries && result.retryReasons?.length) {
    lines.push(`\u5DF2\u91CD\u8BD5 ${result.retries} \u6B21\uFF1A`);
    for (const reason of result.retryReasons) lines.push(`  - ${reason}`);
  }
  return lines.join("\n");
}
function apply(ctx) {
  const settings = new SettingsStore();
  async function generate(request, options = {}) {
    const built = buildMedicalPrompt(request);
    const base = settings.effective();
    const client = new BaitongImageClient({
      ...base,
      timeoutSeconds: options.timeoutSeconds ?? base.timeoutSeconds,
      maxAttempts: options.maxAttempts ?? base.maxAttempts,
      retryOnTimeout: options.retryOnTimeout ?? base.retryOnTimeout
    });
    try {
      const result = await client.generateImage(built.optimizedPrompt, {
        size: normalizeSize(options.size ?? base.defaultSize),
        n: options.n ?? 1
      });
      if (String(result.code) !== "200" && String(result.code) !== "0") {
        return {
          ok: false,
          message: formatFailure(result),
          illustrationType: built.illustrationType,
          optimizedPrompt: built.optimizedPrompt,
          code: result.code,
          retries: result.retries,
          retryReasons: result.retryReasons
        };
      }
      const image = extractImage(result);
      if (!image?.url && !image?.b64Json) {
        return {
          ok: false,
          message: "\u5E73\u53F0\u8FD4\u56DE\u6210\u529F\u4F46\u672A\u5305\u542B\u56FE\u7247\u6570\u636E\uFF08data.images \u4E3A\u7A7A\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
          illustrationType: built.illustrationType,
          optimizedPrompt: built.optimizedPrompt,
          code: result.code
        };
      }
      return {
        ok: true,
        message: image.url ? "\u533B\u5B66\u56FE\u793A\u751F\u6210\u6210\u529F\u3002" : "\u533B\u5B66\u56FE\u793A\u751F\u6210\u6210\u529F\uFF08\u5E73\u53F0\u8FD4\u56DE Base64\uFF09\u3002",
        illustrationType: built.illustrationType,
        optimizedPrompt: built.optimizedPrompt,
        imageUrl: image.url,
        b64Json: image.b64Json,
        code: result.code,
        retries: result.retries,
        retryReasons: result.retryReasons
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const isTimeout = /超时|timeout/i.test(detail);
      return {
        ok: false,
        message: isTimeout ? `${detail}\u3002\u5E73\u53F0\u751F\u6210\u961F\u5217\u53EF\u80FD\u8F83\u91CD\uFF0C\u5EFA\u8BAE\u7A0D\u540E\u91CD\u8BD5\u3002` : detail,
        illustrationType: built.illustrationType,
        optimizedPrompt: built.optimizedPrompt
      };
    }
  }
  ctx.provide("medicalDiagram", {
    buildPrompt: (request) => buildMedicalPrompt(request),
    generate: (request, options) => generate(request, options),
    getSettings: () => settings.snapshot(),
    supportedSizes: () => [...ALLOWED_SIZES]
  });
  ctx.effect(() => {
    ctx.command("medical-diagram <request>", "\u751F\u6210\u533B\u5B66\u4E13\u4E1A\u56FE\u793A\uFF08\u836F\u7269/\u75BE\u75C5\u673A\u5236\u3001\u8BCA\u7597\u6D41\u7A0B\u3001\u89E3\u5256\u751F\u7406\u3001\u533B\u5B66\u5BF9\u6BD4\u3001\u60A3\u8005\u6559\u80B2\uFF09").alias("\u533B\u5B66\u56FE\u793A").option("size", "-s  \u51FA\u56FE\u5C3A\u5BF8\uFF0C\u53EF\u9009\u503C\uFF1A" + ALLOWED_SIZES.join(" / ")).option("timeout", "-t  \u5355\u6B21\u8BF7\u6C42\u8D85\u65F6\u79D2\u6570\uFF0C\u9ED8\u8BA4 300").option("max-attempts", "-m  \u603B\u5C1D\u8BD5\u6B21\u6570\uFF08\u542B\u9996\u6B21\uFF09\uFF0C\u9ED8\u8BA4 3").option("no-retry-on-timeout", "   \u8BFB\u8D85\u65F6\u540E\u4E0D\u91CD\u8BD5\uFF0C\u907F\u514D\u91CD\u590D\u751F\u6210\u4E0E\u91CD\u590D\u8BA1\u8D39").action(async ({ options }, request) => {
      const outcome = await generate(request, {
        size: options?.size,
        timeoutSeconds: options?.timeout ? Number(options.timeout) : void 0,
        maxAttempts: options?.["max-attempts"] ? Number(options["max-attempts"]) : void 0,
        retryOnTimeout: options?.["no-retry-on-timeout"] ? false : void 0
      });
      const lines = [
        `\u56FE\u793A\u7C7B\u578B\uFF1A${outcome.illustrationType ?? "\u672A\u77E5"}`,
        outcome.message
      ];
      if (outcome.ok && outcome.imageUrl) lines.push(`\u56FE\u7247\u94FE\u63A5\uFF1A${outcome.imageUrl}`);
      if (outcome.optimizedPrompt) lines.push(`\u4F18\u5316\u540E Prompt\uFF1A${outcome.optimizedPrompt}`);
      return lines.join("\n");
    });
    ctx.command("medical-diagram.prompt <request>", "\u4EC5\u751F\u6210\u533B\u5B66\u56FE\u793A Prompt\uFF0C\u4E0D\u8C03\u7528\u751F\u56FE\u63A5\u53E3").action((_arg, request) => {
      const built = buildMedicalPrompt(request);
      return [`\u56FE\u793A\u7C7B\u578B\uFF1A${built.illustrationType}`, `Prompt\uFF1A${built.optimizedPrompt}`].join("\n");
    });
    ctx.tool?.register?.({
      name: "medical_diagram",
      description: "\u751F\u6210\u533B\u5B66\u4E13\u4E1A\u56FE\u793A\uFF1A\u628A\u533B\u5B66\u56FE\u793A\u9700\u6C42\u4F18\u5316\u4E3A\u4E13\u4E1A Prompt \u5E76\u8C03\u7528\u767E\u901A\u751F\u56FE\u670D\u52A1\u3002\u9002\u7528\u4E8E\u836F\u7269\u4F5C\u7528\u673A\u5236\u3001\u75BE\u75C5\u673A\u5236\u3001\u8BCA\u7597\u6D41\u7A0B\u3001\u89E3\u5256\u751F\u7406\u3001\u533B\u5B66\u5BF9\u6BD4\u4E0E\u60A3\u8005\u6559\u80B2\u56FE\u3002\u4E0D\u66FF\u4EE3\u533B\u5B66\u4E8B\u5B9E\u6838\u9A8C\u3002",
      params: {
        request: "string\uFF0C\u533B\u5B66\u56FE\u793A\u9700\u6C42\u63CF\u8FF0\uFF0C\u5982\u300C\u751F\u6210\u4E00\u5F20\u53F8\u7F8E\u683C\u9C81\u80BD\u964D\u7CD6\u673A\u5236\u56FE\u300D",
        size: `string\uFF0C\u53EF\u9009\u5C3A\u5BF8\uFF1A${ALLOWED_SIZES.join(" / ")}`
      },
      run: async ({ request, size }) => {
        const outcome = await generate(request, { size });
        return outcome.ok ? {
          ok: true,
          message: outcome.message,
          imageUrl: outcome.imageUrl,
          illustrationType: outcome.illustrationType,
          optimizedPrompt: outcome.optimizedPrompt
        } : {
          ok: false,
          message: outcome.message,
          illustrationType: outcome.illustrationType,
          optimizedPrompt: outcome.optimizedPrompt
        };
      }
    });
    const disposeRoutes = ctx.webServer.register((router) => {
      router.get(`${ROUTE_PREFIX}/health`, async () => ({
        status: "ok",
        plugin: ctx.name,
        uptime: process.uptime(),
        configured: settings.snapshot().hasCredentials
      }));
      router.get(`${ROUTE_PREFIX}/config`, async () => settings.snapshot());
      router.post(`${ROUTE_PREFIX}/config`, async (request) => {
        const body = await request.json?.() ?? {};
        const changed = settings.patch(body);
        ctx.logger.info("[bt-medical-diagram] config updated:", changed.join(", ") || "\u65E0\u53D8\u66F4");
        return { ok: true, changed, settings: settings.snapshot() };
      });
      router.post(`${ROUTE_PREFIX}/prompt`, async (request) => {
        const body = await request.json?.() ?? {};
        try {
          const built = buildMedicalPrompt(String(body.request ?? ""));
          return { ok: true, ...built };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      });
      router.post(`${ROUTE_PREFIX}/generate`, async (request) => {
        const body = await request.json?.() ?? {};
        try {
          const outcome = await generate(String(body.request ?? ""), {
            size: body.size,
            n: body.n,
            timeoutSeconds: body.timeoutSeconds ? Number(body.timeoutSeconds) : void 0,
            maxAttempts: body.maxAttempts ? Number(body.maxAttempts) : void 0,
            retryOnTimeout: typeof body.retryOnTimeout === "boolean" ? body.retryOnTimeout : void 0
          });
          ctx.logger.info("[bt-medical-diagram] generate:", outcome.ok ? "ok" : outcome.message);
          return outcome;
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      });
    });
    return () => {
      disposeRoutes?.();
    };
  });
}
export {
  apply,
  inject
};
//# sourceMappingURL=index.js.map
