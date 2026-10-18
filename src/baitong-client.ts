/**
 * 百通生图客户端（由原 Skill 的 scripts/baitong_client.py 移植）
 *
 * 关键约束（来自 references/baitong-open-api.md）：
 * - 路径前缀 `/baitong_ai` 必带，最终 URL 恒为 {host}/baitong_ai/api/skill/generateImage
 * - `channel` 与 `skillCode` 必须追加在 URL query，不能放进 JSON body
 * - 签名头：X-App-Key / X-Timestamp(ms) / X-Sign=MD5(appKey+timestamp+appSecret)
 * - 生图为长耗时生成类接口：默认 300 秒超时、3 次尝试、指数退避
 */

import { createHash } from 'node:crypto'

import type { MedicalDiagramSettings } from './settings.js'

const IMAGE_PATH = '/baitong_ai/api/skill/generateImage'
const API_PATH_PREFIX = '/baitong_ai'

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRYABLE_BUSINESS_CODES = new Set([503])
const RATE_LIMIT_HINTS = [
  '频繁',
  '限流',
  '请稍后再试',
  'too many',
  'rate limit',
  'timeout',
  '超时',
  'busy',
]
const NON_RETRYABLE_HINTS = ['参数', '不能为空', '长度', '校验', '非法', 'invalid', 'must be', 'required']

const RETRY_BASE_SECONDS = 2
const RETRY_MAX_SECONDS = 30
const RETRY_JITTER = 0.2

export class BaitongRequestError extends Error {
  readonly retries: string[]

  constructor(message: string, retries: string[] = []) {
    super(retries.length ? `${message} (已重试 ${retries.length} 次)` : message)
    this.name = 'BaitongRequestError'
    this.retries = retries
  }
}

export interface GenerateImageResult {
  code: number | string | null
  msg: string
  data: {
    images?: Array<{ url?: string; b64Json?: string; revisedPrompt?: string }>
    [key: string]: unknown
  } | null
  illustrationType?: string
  optimizedPrompt?: string
  retries?: number
  retryReasons?: string[]
}

type AttemptOutcome = {
  body: Record<string, unknown> | null
  error: string | null
  retryable: boolean
  reason: string
}

function md5Hex(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex')
}

/**
 * 归一化 base_url：平台注入的形态可能是 {host}、{host}/api、{host}/baitong_ai
 * 或 {host}/baitong_ai/api。统一剥到 {host}，再由路径常量提供完整路由。
 */
export function normalizeBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  const marker = base.indexOf(API_PATH_PREFIX)
  if (marker !== -1) {
    base = base.slice(0, marker)
  } else if (base.endsWith('/api')) {
    base = base.slice(0, -'/api'.length)
  }
  return base.replace(/\/+$/, '')
}

export function buildImageUrl(baseUrl: string, channel: string, skillCode: string): string {
  const base = normalizeBaseUrl(baseUrl)
  const query = new URLSearchParams({ channel, skillCode }).toString()
  return `${base}${IMAGE_PATH}?${query}`
}

function isSuccess(body: Record<string, unknown> | null): boolean {
  if (!body) return false
  const code = String(body.code)
  return code === '200' || code === '0'
}

function backoffSeconds(failedAttempt: number): number {
  const base = Math.min(RETRY_BASE_SECONDS * 2 ** Math.max(0, failedAttempt - 1), RETRY_MAX_SECONDS)
  const jittered = base * (1 + (Math.random() * 2 - 1) * RETRY_JITTER)
  return Math.max(0, jittered)
}

function classifyBusinessFailure(
  status: number,
  body: Record<string, unknown>,
): { retryable: boolean; description: string } {
  const rawCode = body.code
  const msg = String(body.msg ?? '')
  const description = `HTTP ${status} / code ${rawCode}: ${msg}`
  const numericCode = Number(rawCode)

  // 参数校验类失败优先判定为不可重试——重试无意义且可能二次扣费。
  if (NON_RETRYABLE_HINTS.some((hint) => msg.toLowerCase().includes(hint.toLowerCase()))) {
    return { retryable: false, description }
  }
  if (Number.isFinite(numericCode) && RETRYABLE_BUSINESS_CODES.has(numericCode)) {
    return { retryable: true, description }
  }
  if (
    Number.isFinite(numericCode) &&
    numericCode >= 500 &&
    RATE_LIMIT_HINTS.some((hint) => msg.toLowerCase().includes(hint))
  ) {
    return { retryable: true, description }
  }
  if (RETRYABLE_HTTP_STATUSES.has(status) && !Number.isFinite(numericCode)) {
    return { retryable: true, description }
  }
  return { retryable: false, description }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class BaitongImageClient {
  constructor(private readonly settings: MedicalDiagramSettings) {}

  private headers(): Record<string, string> {
    const { appKey, appSecret } = this.settings
    if (!appKey || !appSecret) {
      throw new BaitongRequestError('百通 AppKey / AppSecret 未配置，请先在插件设置面板填写凭据。')
    }
    // 每次尝试都重新生成签名：时间戳仅 60 秒有效，退避等待不会导致签名过期。
    const timestamp = String(Date.now())
    return {
      'Content-Type': 'application/json',
      'X-App-Key': appKey,
      'X-Timestamp': timestamp,
      'X-Sign': md5Hex(`${appKey}${timestamp}${appSecret}`),
    }
  }

  private async attempt(url: string, payload: Record<string, unknown>): Promise<AttemptOutcome> {
    const timeoutMs = this.settings.timeoutSeconds * 1000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = controller.signal.aborted
      const detail = error instanceof Error ? error.message : String(error)
      if (aborted) {
        return {
          body: null,
          error: `百通请求在 ${this.settings.timeoutSeconds} 秒后超时：${detail}`,
          retryable: this.settings.retryOnTimeout,
          reason: `timeout after ${this.settings.timeoutSeconds}s`,
        }
      }
      return {
        body: null,
        error: `百通网络错误：${detail}`,
        retryable: true,
        reason: `network error: ${detail}`,
      }
    } finally {
      clearTimeout(timer)
    }

    const status = response.status
    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return {
        body: null,
        error: `百通返回非 JSON 响应 HTTP ${status}：${text.slice(0, 500)}`,
        retryable: RETRYABLE_HTTP_STATUSES.has(status),
        reason: `non-JSON HTTP ${status}`,
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { body: null, error: '百通返回的 JSON 不是对象。', retryable: false, reason: 'non-object JSON' }
    }

    const record = body as Record<string, unknown>
    if (isSuccess(record)) {
      return { body: record, error: null, retryable: false, reason: '' }
    }
    const { retryable, description } = classifyBusinessFailure(status, record)
    return { body: record, error: description, retryable, reason: description }
  }

  async generateImage(prompt: string, options: { size?: string; n?: number } = {}): Promise<GenerateImageResult> {
    const { baseUrl, channel, skillCode } = this.settings
    if (!baseUrl) {
      throw new BaitongRequestError('百通服务地址未配置，请先在插件设置面板填写 Base URL。')
    }

    const payload: Record<string, unknown> = {
      prompt,
      n: options.n ?? 1,
      responseFormat: 'url',
    }
    if (options.size) payload.size = options.size

    const url = buildImageUrl(baseUrl, channel, skillCode)
    const attempts = Math.max(1, Math.floor(this.settings.maxAttempts))
    const retryReasons: string[] = []
    let last: AttemptOutcome | null = null

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      last = await this.attempt(url, payload)

      if (isSuccess(last.body)) {
        const body = last.body as Record<string, unknown>
        const result: GenerateImageResult = {
          code: body.code ?? 200,
          msg: String(body.msg ?? 'ok'),
          data: (body.data ?? null) as GenerateImageResult['data'],
        }
        if (retryReasons.length) {
          result.retries = retryReasons.length
          result.retryReasons = retryReasons
        }
        return result
      }

      if (!last.retryable || attempt >= attempts) break
      retryReasons.push(`第 ${attempt} 次尝试：${last.reason}`)
      await sleep(backoffSeconds(attempt) * 1000)
    }

    if (last?.body) {
      // 业务级失败：原样交付平台 code/msg，不伪造成功、不编造图片链接。
      const result: GenerateImageResult = {
        code: (last.body.code ?? null) as number | string | null,
        msg: String(last.body.msg ?? last.error ?? '百通返回未知失败'),
        data: (last.body.data ?? null) as GenerateImageResult['data'],
      }
      if (retryReasons.length) {
        result.retries = retryReasons.length
        result.retryReasons = retryReasons
      }
      return result
    }

    // 传输级失败：抛出真实异常文本，由上层如实呈现。
    throw new BaitongRequestError(last?.error ?? '百通请求失败。', retryReasons)
  }
}

/** 从统一响应中取出首张图片的 URL 或 Base64。 */
export function extractImage(result: GenerateImageResult): { url?: string; b64Json?: string } | null {
  const image = result.data?.images?.[0]
  if (!image) return null
  return { url: image.url, b64Json: image.b64Json }
}