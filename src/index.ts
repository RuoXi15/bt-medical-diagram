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
export const inject = ['webServer']

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
    // ---- 命令 ----
    ctx.command('medical-diagram <request>', '生成医学专业图示（药物/疾病机制、诊疗流程、解剖生理、医学对比、患者教育）')
      .alias('医学图示')
      .option('size', '-s  出图尺寸，可选值：' + ALLOWED_SIZES.join(' / '))
      .option('timeout', '-t  单次请求超时秒数，默认 300')
      .option('max-attempts', '-m  总尝试次数（含首次），默认 3')
      .option('no-retry-on-timeout', '   读超时后不重试，避免重复生成与重复计费')
      .action(async ({ options }: any, request: string) => {
        const outcome = await generate(request, {
          size: options?.size,
          timeoutSeconds: options?.timeout ? Number(options.timeout) : undefined,
          maxAttempts: options?.['max-attempts'] ? Number(options['max-attempts']) : undefined,
          retryOnTimeout: options?.['no-retry-on-timeout'] ? false : undefined,
        })
        const lines = [
          `图示类型：${outcome.illustrationType ?? '未知'}`,
          outcome.message,
        ]
        if (outcome.ok && outcome.imageUrl) lines.push(`图片链接：${outcome.imageUrl}`)
        if (outcome.optimizedPrompt) lines.push(`优化后 Prompt：${outcome.optimizedPrompt}`)
        return lines.join('\n')
      })

    // 仅优化 Prompt，不调用生图接口（不产生费用）
    ctx.command('medical-diagram.prompt <request>', '仅生成医学图示 Prompt，不调用生图接口')
      .action((_arg: any, request: string) => {
        const built = buildMedicalPrompt(request)
        return [`图示类型：${built.illustrationType}`, `Prompt：${built.optimizedPrompt}`].join('\n')
      })

    // 供模型调用的工具
    ctx.tool?.register?.({
      name: 'medical_diagram',
      description:
        '生成医学专业图示：把医学图示需求优化为专业 Prompt 并调用百通生图服务。适用于药物作用机制、疾病机制、诊疗流程、解剖生理、医学对比与患者教育图。不替代医学事实核验。',
      params: {
        request: 'string，医学图示需求描述，如「生成一张司美格鲁肽降糖机制图」',
        size: `string，可选尺寸：${ALLOWED_SIZES.join(' / ')}`,
      },
      run: async ({ request, size }: { request: string; size?: string }) => {
        const outcome = await generate(request, { size })
        return outcome.ok
          ? {
              ok: true,
              message: outcome.message,
              imageUrl: outcome.imageUrl,
              illustrationType: outcome.illustrationType,
              optimizedPrompt: outcome.optimizedPrompt,
            }
          : {
              ok: false,
              message: outcome.message,
              illustrationType: outcome.illustrationType,
              optimizedPrompt: outcome.optimizedPrompt,
            }
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