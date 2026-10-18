/**
 * 插件配置（凭据由用户在设置面板手动输入）
 *
 * 优先级：运行时覆盖参数 > 环境变量 > 设置面板持久化值 > 内置默认值。
 * 环境变量沿用原 Skill 的键名，便于从百通平台迁移过来。
 */

import { DEFAULT_SIZE } from './prompt-builder.js'

export interface MedicalDiagramSettings {
  /** 百通服务地址，形如 https://{host} 或 https://{host}/baitong_ai/api，内部会归一化 */
  baseUrl: string
  appKey: string
  appSecret: string
  /** 接入方：workbuddy / qwenwork */
  channel: string
  /** 已开通的技能编码 */
  skillCode: string
  /** 单次请求超时（秒）。生图为长耗时生成类接口，默认 300。 */
  timeoutSeconds: number
  /** 总尝试次数（含首次） */
  maxAttempts: number
  /** 读超时后是否重试。⚠️ 关闭可避免重复计费。 */
  retryOnTimeout: boolean
  /** 默认出图尺寸 */
  defaultSize: string
}

/** 已写死的接口与渠道：用户不需要知道，也不允许在界面里改。 */
export const BAKED_BASE_URL = 'https://s.1100111.cn/baitong_ai'
export const BAKED_CHANNEL = 'workbuddy'
export const BAKED_SKILL_CODE = 'BT_08DA7C1A'

export const DEFAULT_SETTINGS: MedicalDiagramSettings = {
  baseUrl: BAKED_BASE_URL,
  appKey: '',
  appSecret: '',
  channel: BAKED_CHANNEL,
  skillCode: BAKED_SKILL_CODE,
  timeoutSeconds: 300,
  maxAttempts: 3,
  retryOnTimeout: true,
  defaultSize: DEFAULT_SIZE,
}

/** 允许前端提交的字段白名单，避免任意键写入配置。 */
const WRITABLE_KEYS = [
  'baseUrl',
  'appKey',
  'appSecret',
  'channel',
  'skillCode',
  'timeoutSeconds',
  'maxAttempts',
  'retryOnTimeout',
  'defaultSize',
] as const

type WritableKey = (typeof WRITABLE_KEYS)[number]

const ENV_KEYS: Record<WritableKey, readonly string[]> = {
  baseUrl: ['BAITONG_API_BASE_URL', 'BAITONG_BASE_URL'],
  appKey: ['BAITONG_APP_KEY'],
  appSecret: ['BAITONG_APP_SECRET'],
  channel: ['BAITONG_CHANNEL', 'CHANNEL'],
  skillCode: ['BAITONG_SKILL_CODE', 'SKILL_CODE'],
  timeoutSeconds: ['BAITONG_TIMEOUT_SECONDS', 'BAITONG_TIMEOUT'],
  maxAttempts: ['BAITONG_MAX_ATTEMPTS', 'BAITONG_RETRY_ATTEMPTS'],
  retryOnTimeout: ['BAITONG_RETRY_ON_TIMEOUT'],
  defaultSize: ['BAITONG_DEFAULT_SIZE'],
}

const NUMERIC_KEYS = new Set<WritableKey>(['timeoutSeconds', 'maxAttempts'])

function envFirst(keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env?.[key]?.trim()
    if (value) return value
  }
  return ''
}

function coerce(key: WritableKey, raw: unknown): unknown {
  if (key === 'retryOnTimeout') {
    if (typeof raw === 'boolean') return raw
    const text = String(raw).trim().toLowerCase()
    if (['1', 'true', 'yes', 'on', 'y'].includes(text)) return true
    if (['0', 'false', 'no', 'off', 'n'].includes(text)) return false
    return undefined
  }
  if (NUMERIC_KEYS.has(key)) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }
  const text = String(raw ?? '').trim()
  return text || undefined
}

export class SettingsStore {
  private persisted: MedicalDiagramSettings = { ...DEFAULT_SETTINGS }

  constructor(initial?: Partial<MedicalDiagramSettings>) {
    if (initial) this.persisted = { ...this.persisted, ...initial }
  }

  /** 合并设置面板提交的部分字段，返回被实际改动的键。 */
  patch(input: Record<string, unknown>): string[] {
    const changed: string[] = []
    for (const key of WRITABLE_KEYS) {
      if (!(key in input)) continue
      const value = coerce(key, input[key])
      if (value === undefined) continue
      if (this.persisted[key] !== value) {
        ;(this.persisted as Record<WritableKey, unknown>)[key] = value
        changed.push(key)
      }
    }
    return changed
  }

  /** 生效配置：接口/渠道/技能固定为内置值，环境变量可覆盖（仅用于自测）。 */
  effective(): MedicalDiagramSettings {
    const resolved = { ...this.persisted, baseUrl: BAKED_BASE_URL, channel: BAKED_CHANNEL, skillCode: BAKED_SKILL_CODE }
    for (const key of WRITABLE_KEYS) {
      const raw = envFirst(ENV_KEYS[key])
      if (!raw) continue
      const value = coerce(key, raw)
      if (value !== undefined) {
        ;(resolved as Record<WritableKey, unknown>)[key] = value
      }
    }
    return resolved
  }

  /** 对外暴露的快照：AppSecret 脱敏，只回传是否已配置与末 4 位。 */
  snapshot() {
    const settings = this.effective()
    const secret = settings.appSecret
    return {
      ...settings,
      appSecret: '',
      appSecretMasked: secret ? `****${secret.slice(-4)}` : '',
      hasAppSecret: Boolean(secret),
      hasCredentials: Boolean(settings.appKey && secret),
    }
  }
}