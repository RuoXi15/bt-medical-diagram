/**
 * bt-medical-diagram — Node half
 *
 * 能力面：
 * - 命令/工具：/medical-diagram <需求>、/medical-diagram.prompt（仅优化 Prompt 不生图）
 * - HTTP 接口：/bt-medical-diagram/health、/config（GET/POST）、/generate、/prompt
 * - 对外服务：medicalDiagram.generate() / buildPrompt()，供其它插件注入调用
 */

import { BaitongImageClient, extractImage } from './baitong-client.js'
import { ALLOWED_SIZES, buildMedicalPrompt, normalizeSize } from './prompt-builder.js'
import { SettingsStore } from './settings.js'

/** 使用 webServer 服务（HTTP 路由），必须声明注入。 */
export const inject = ['webServer', 'commands', 'tools']

const ROUTE_PREFIX = '/bt-medical-diagram'

export interface GenerateOptions {
  size?: string
  n?: number
  timeoutSeconds?: number
  maxAttempts?: number
  retryOnTimeout?: boolean
}

export interface GenerateOutcome {
  ok: boolean
  message: string
  illustrationType?: string
  optimizedPrompt?: string
  imageUrl?: string
  b64Json?: string
  code?: number | string | null
  retries?: number
  retryReasons?: string[]
}

function formatFailure(result: { code: number | string | null; msg: string; retries?: number; retryReasons?: string[] }): string {
  const lines = [`生成失败：code=${result.code}，msg=${result.msg}`]
  if (result.retries && result.retryReasons?.length) {
    lines.push(`已重试 ${result.retries} 次：`)
    for (const reason of result.retryReasons) lines.push(`  - ${reason}`)
  }
  return lines.join('\n')
}

export function apply(ctx: any) {
  const settings = new SettingsStore()

  async function generate(request: string, options: GenerateOptions = {}): Promise<GenerateOutcome> {
    const built = buildMedicalPrompt(request)
    const base = settings.effective()
    const client = new BaitongImageClient({
      ...base,
      timeoutSeconds: options.timeoutSeconds ?? base.timeoutSeconds,
      maxAttempts: options.maxAttempts ?? base.maxAttempts,
      retryOnTimeout: options.retryOnTimeout ?? base.retryOnTimeout,
    })

    try {
      const result = await client.generateImage(built.optimizedPrompt, {
        size: normalizeSize(options.size ?? base.defaultSize),
        n: options.n ?? 1,
      })

      if (String(result.code) !== '200' && String(result.code) !== '0') {
        // 平台业务失败：原样交付 code/msg，不编造图片链接。
        return {
          ok: false,
          message: formatFailure(result),
          illustrationType: built.illustrationType,
          optimizedPrompt: built.optimizedPrompt,
          code: result.code,
          retries: result.retries,
          retryReasons: result.retryReasons,
        }
      }

      const image = extractImage(result)
      if (!image?.url && !image?.b64Json) {
        return {
          ok: false,
          message: '平台返回成功但未包含图片数据（data.images 为空），请稍后重试。',
          illustrationType: built.illustrationType,
          optimizedPrompt: built.optimizedPrompt,
          code: result.code,
        }
      }

      return {
        ok: true,
        message: image.url ? '医学图示生成成功。' : '医学图示生成成功（平台返回 Base64）。',
        illustrationType: built.illustrationType,
        optimizedPrompt: built.optimizedPrompt,
        imageUrl: image.url,
        b64Json: image.b64Json,
        code: result.code,
        retries: result.retries,
        retryReasons: result.retryReasons,
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      // 仅超时才提示排队；凭据/配置类错误不应误导用户
      const isTimeout = /超时|timeout/i.test(detail)
      return {
        ok: false,
        message: isTimeout
          ? `${detail}。平台生成队列可能较重，建议稍后重试。`
          : detail,
        illustrationType: built.illustrationType,
        optimizedPrompt: built.optimizedPrompt,
      }
    }
  }

  // 对外服务：其它插件 inject: ['medicalDiagram'] 后即可调用。provide 必须在 apply 顶层同步注册。
  ctx.provide('medicalDiagram', {
    buildPrompt: (request: string) => buildMedicalPrompt(request),
    generate: (request: string, options?: GenerateOptions) => generate(request, options),
    getSettings: () => settings.snapshot(),
    supportedSizes: () => [...ALLOWED_SIZES],
  })

  ctx.effect(() => {
    // ---- 命令（DSH 真 API：ctx.commands.register；命令名只允许 [a-z][a-z0-9_-]*）----
    const parseArgs = (raw: string) => {
      const tokens = String(raw ?? '').trim().split(/\s+/).filter(Boolean)
      const rest: string[] = []
      const flags: Record<string, string | boolean> = {}
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i]
        if (token === '--size' || token === '-s') flags.size = tokens[(i += 1)] ?? ''
        else if (token === '--timeout' || token === '-t') flags.timeout = tokens[(i += 1)] ?? ''
        else if (token === '--max-attempts' || token === '-m') flags['max-attempts'] = tokens[(i += 1)] ?? ''
        else if (token === '--no-retry-on-timeout') flags['no-retry-on-timeout'] = true
        else rest.push(token)
      }
      return {
        request: rest.join(' '),
        size: typeof flags.size === 'string' && flags.size ? flags.size : undefined,
        timeoutSeconds: typeof flags.timeout === 'string' && flags.timeout ? Number(flags.timeout) : undefined,
        maxAttempts: typeof flags['max-attempts'] === 'string' && flags['max-attempts'] ? Number(flags['max-attempts']) : undefined,
        retryOnTimeout: flags['no-retry-on-timeout'] === true ? false : undefined,
      }
    }

    ctx.commands.register({
      definitionId: 'bt-medical-diagram',
      name: 'medical-diagram',
      description: '生成医学专业图示（药物/疾病机制、诊疗流程、解剖生理、医学对比、患者教育）',
      input: { hint: '<需求> [--size 1024x1024] [--timeout 300] [--max-attempts 3] [--no-retry-on-timeout]' },
      handler: async (invocation: any) => {
        const args = parseArgs(invocation?.rawInput ?? '')
        if (!args.request) {
          return { kind: 'error', text: '请提供医学图示需求，例如：/medical-diagram 生成一张司美格鲁肽降糖机制图' }
        }
        const outcome = await generate(args.request, {
          size: args.size,
          timeoutSeconds: args.timeoutSeconds,
          maxAttempts: args.maxAttempts,
          retryOnTimeout: args.retryOnTimeout,
        })
        const lines = [`图示类型：${outcome.illustrationType ?? '未知'}`, outcome.message]
        if (outcome.ok && outcome.imageUrl) lines.push(`图片链接：${outcome.imageUrl}`)
        if (outcome.optimizedPrompt) lines.push(`优化后 Prompt：${outcome.optimizedPrompt}`)
        return { kind: 'success', text: lines.join('\n') }
      },
    })

    ctx.commands.register({
      definitionId: 'bt-medical-diagram-prompt',
      name: 'medical-diagram-prompt',
      description: '仅生成医学图示 Prompt，不调用生图接口、不产生费用',
      input: { hint: '<需求>' },
      handler: (invocation: any) => {
        const args = parseArgs(invocation?.rawInput ?? '')
        if (!args.request) return { kind: 'error', text: '请提供医学图示需求' }
        const built = buildMedicalPrompt(args.request)
        return {
          kind: 'success',
          text: [`图示类型：${built.illustrationType}`, `Prompt：${built.optimizedPrompt}`].join('\n'),
        }
      },
    })

    // ---- 工具（DSH 真 API：ctx.tools.register(defineTool(...))）----
    ctx.tools.register({
      name: 'medical_diagram',
      description:
        '生成医学专业图示：把医学图示需求优化为专业 Prompt 并调用百通生图服务。适用于药物作用机制、疾病机制、诊疗流程、解剖生理、医学对比与患者教育图。不替代医学事实核验。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['request'],
        properties: {
          request: { type: 'string', description: '医学图示需求描述，如「生成一张司美格鲁肽降糖机制图」' },
          size: { type: 'string', description: '可选尺寸：' + ALLOWED_SIZES.join(' / ') },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'message'],
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
            imageUrl: { type: 'string' },
            illustrationType: { type: 'string' },
            optimizedPrompt: { type: 'string' },
          },
        },
        render: (_args: any, value: any) => [
          {
            type: 'text',
            text: value.ok
              ? '医学图示已生成：' + (value.imageUrl ?? '（平台返回 Base64）')
              : '医学图示生成失败：' + value.message,
          },
        ],
      },
      execute: async (args: { request: string; size?: string }) => {
        const outcome = await generate(args.request, { size: args.size })
        const payload: Record<string, unknown> = { ok: outcome.ok, message: outcome.message }
        if (outcome.imageUrl) payload.imageUrl = outcome.imageUrl
        if (outcome.illustrationType) payload.illustrationType = outcome.illustrationType
        if (outcome.optimizedPrompt) payload.optimizedPrompt = outcome.optimizedPrompt
        return payload
      },
    })


    // ---- HTTP ----
    const disposeRoutes = ctx.webServer.register((router: any) => {
      // 冒烟路由
      router.get(`${ROUTE_PREFIX}/health`, async () => ({
        status: 'ok',
        plugin: ctx.name,
        uptime: process.uptime(),
        configured: settings.snapshot().hasCredentials,
      }))

      router.get(`${ROUTE_PREFIX}/config`, async () => settings.snapshot())

      router.post(`${ROUTE_PREFIX}/config`, async (request: any) => {
        const body = (await request.json?.()) ?? {}
        const changed = settings.patch(body as Record<string, unknown>)
        ctx.logger.info('[bt-medical-diagram] config updated:', changed.join(', ') || '无变更')
        return { ok: true, changed, settings: settings.snapshot() }
      })

      // 仅优化 Prompt（不生图、不计费）
      router.post(`${ROUTE_PREFIX}/prompt`, async (request: any) => {
        const body = (await request.json?.()) ?? {}
        try {
          const built = buildMedicalPrompt(String(body.request ?? ''))
          return { ok: true, ...built }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) }
        }
      })

      // 真正生图（长耗时，最长可达 timeoutSeconds）
      router.post(`${ROUTE_PREFIX}/generate`, async (request: any) => {
        const body = (await request.json?.()) ?? {}
        try {
          const outcome = await generate(String(body.request ?? ''), {
            size: body.size,
            n: body.n,
            timeoutSeconds: body.timeoutSeconds ? Number(body.timeoutSeconds) : undefined,
            maxAttempts: body.maxAttempts ? Number(body.maxAttempts) : undefined,
            retryOnTimeout: typeof body.retryOnTimeout === 'boolean' ? body.retryOnTimeout : undefined,
          })
          ctx.logger.info('[bt-medical-diagram] generate:', outcome.ok ? 'ok' : outcome.message)
          return outcome
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) }
        }
      })
    })

    return () => {
      disposeRoutes?.()
    }
  })
}