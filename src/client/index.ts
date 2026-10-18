/**
 * bt-medical-diagram — client half
 *
 * 两个插槽：
 * - workspace：医学图示生成工作区（输入需求 → 预览优化 Prompt → 生图 → 展示图片）
 * - settings：百通凭据与策略配置面板
 *
 * UI 规范：全中文、白色清爽、玻璃拟态卡片、渐变 CTA、内联样式、零外部资源。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'

export const inject = ['slots', 'ui']

const API = '/bt-medical-diagram'
const SIZES = ['1024x1024', '1024x1536', '1536x1024', '1792x1024', '1024x1792']
const CHANNELS = ['workbuddy', 'qwenwork']

// ---------------------------------------------------------------- 样式常量

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(15,118,110,0.14)',
  borderRadius: 16,
  boxShadow: '0 8px 28px rgba(15,118,110,0.08)',
  padding: 20,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  fontSize: 13,
  color: '#0f172a',
  background: '#ffffff',
  border: '1px solid #d7e3e1',
  borderRadius: 10,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 600,
  color: '#0f766e',
}

const fieldWrap: React.CSSProperties = { marginBottom: 14 }

const btnPrimary: React.CSSProperties = {
  padding: '10px 22px',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 55%, #115e59 100%)',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(13,148,136,0.28)',
}

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: '#ffffff',
  color: '#0f766e',
  border: '1px solid #99d5cf',
  boxShadow: 'none',
}

const btnDisabled: React.CSSProperties = { ...btnPrimary, opacity: 0.55, cursor: 'not-allowed' }

const hintStyle: React.CSSProperties = { fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.6 }

// ---------------------------------------------------------------- 工具函数

async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`请求失败：HTTP ${res.status}`)
  return (await res.json()) as T
}

interface GenerateOutcome {
  ok: boolean
  message: string
  illustrationType?: string
  optimizedPrompt?: string
  imageUrl?: string
  b64Json?: string
  code?: number | string | null
  retryReasons?: string[]
}

interface ConfigSnapshot {
  baseUrl: string
  appKey: string
  appSecretMasked: string
  hasAppSecret: boolean
  hasCredentials: boolean
  channel: string
  skillCode: string
  timeoutSeconds: number
  maxAttempts: number
  retryOnTimeout: boolean
  defaultSize: string
}

// ---------------------------------------------------------------- 工作区

function WorkspaceComponent({ ctx }: { ctx: any }) {
  const [request, setRequest] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<'idle' | 'prompt' | 'generating'>('idle')
  const [preview, setPreview] = useState<{ type: string; prompt: string } | null>(null)
  const [result, setResult] = useState<GenerateOutcome | null>(null)
  const [config, setConfig] = useState<ConfigSnapshot | null>(null)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    callApi<ConfigSnapshot>('/config')
      .then(setConfig)
      .catch((error) => setBootError(error instanceof Error ? error.message : String(error)))
  }, [])

  const previewPrompt = useCallback(async () => {
    if (!request.trim() || busy) return
    setBusy(true)
    setResult(null)
    setStage('prompt')
    try {
      const res = await callApi<{ ok: boolean; illustrationType?: string; optimizedPrompt?: string; message?: string }>(
        '/prompt',
        { request },
      )
      if (res.ok && res.optimizedPrompt) {
        setPreview({ type: res.illustrationType ?? '未知', prompt: res.optimizedPrompt })
      } else {
        setResult({ ok: false, message: res.message ?? 'Prompt 优化失败。' })
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }, [request, busy])

  const run = useCallback(async () => {
    if (!request.trim() || busy) return
    setBusy(true)
    setStage('generating')
    setResult(null)
    try {
      const res = await callApi<GenerateOutcome>('/generate', { request, size })
      setResult(res)
      if (res.ok && res.optimizedPrompt) {
        setPreview({ type: res.illustrationType ?? '未知', prompt: res.optimizedPrompt })
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
      setStage('idle')
    }
  }, [request, size, busy])

  const imageSrc = useMemo(() => {
    if (!result?.ok) return ''
    if (result.imageUrl) return result.imageUrl
    return result.b64Json ? `data:image/png;base64,${result.b64Json}` : ''
  }, [result])

  return (
    <div style={{ ...card, maxWidth: 880, margin: '0 auto', fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 19 }}>🩺</span>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>医学专业图示生成</h2>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#64748b' }}>
        输入医学图示需求，自动优化为专业 Prompt 后调用百通生图服务。
      </p>

      {config && !config.hasCredentials && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            fontSize: 12,
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
          }}
        >
          ⚠️ 尚未配置百通凭据，请先在「插件设置 → bt-medical-diagram」中填写服务地址、AppKey 与 AppSecret。
        </div>
      )}

      <div style={fieldWrap}>
        <label style={labelStyle}>图示需求</label>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="例如：生成一张司美格鲁肽降糖机制图"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
        />
        <div style={hintStyle}>
          支持：药物作用机制 / 疾病机制 / 诊疗流程 / 解剖生理 / 医学对比 / 患者教育。仅组织你提供的医学对象，不补造剂量与疗效结论。
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ width: 180 }}>
          <label style={labelStyle}>出图尺寸</label>
          <select value={size} onChange={(e) => setSize(e.target.value)} style={inputStyle}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={previewPrompt} disabled={busy || !request.trim()} style={btnGhost}>
            仅预览 Prompt
          </button>
          <button onClick={run} disabled={busy || !request.trim()} style={busy ? btnDisabled : btnPrimary}>
            {busy ? (stage === 'prompt' ? '优化中…' : '生成中，请稍候…') : '生成医学图示'}
          </button>
        </div>
      </div>

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f766e', marginBottom: 6 }}>
            优化后 Prompt · 类型：{preview.type}
          </div>
          <div
            style={{
              padding: 12,
              fontSize: 12,
              lineHeight: 1.8,
              color: '#334155',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              wordBreak: 'break-word',
            }}
          >
            {preview.prompt}
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
            color: '#991b1b',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            whiteSpace: 'pre-wrap',
          }}
        >
          {result.message}
          {result.retryReasons?.length ? (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {result.retryReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {imageSrc && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f766e', marginBottom: 8 }}>生成结果</div>
          <img
            src={imageSrc}
            alt={result?.illustrationType ?? '医学图示'}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          />
          {result?.imageUrl && (
            <a
              href={result.imageUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#0d9488' }}
            >
              在新窗口打开原图 ↗
            </a>
          )}
        </div>
      )}

      {bootError && (
        <div style={{ marginTop: 14, fontSize: 12, color: '#b91c1c' }}>配置读取失败：{bootError}</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 设置面板

function SettingsComponent({ ctx }: { ctx: any }) {
  const [form, setForm] = useState({
    baseUrl: '',
    appKey: '',
    appSecret: '',
    channel: 'workbuddy',
    skillCode: 'BT_08DA7C1A',
    timeoutSeconds: 300,
    maxAttempts: 3,
    retryOnTimeout: true,
    defaultSize: '1024x1024',
  })
  const [secretTip, setSecretTip] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    callApi<ConfigSnapshot>('/config')
      .then((cfg) => {
        setForm({
          baseUrl: cfg.baseUrl ?? '',
          appKey: cfg.appKey ?? '',
          appSecret: '',
          channel: cfg.channel ?? 'workbuddy',
          skillCode: cfg.skillCode ?? 'BT_08DA7C1A',
          timeoutSeconds: cfg.timeoutSeconds ?? 300,
          maxAttempts: cfg.maxAttempts ?? 3,
          retryOnTimeout: cfg.retryOnTimeout ?? true,
          defaultSize: cfg.defaultSize ?? '1024x1024',
        })
        setSecretTip(cfg.hasAppSecret ? `已配置（${cfg.appSecretMasked}），留空则保持不变` : '尚未配置')
      })
      .catch(() => setSecretTip('读取配置失败'))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setStatus('保存中…')
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!form.appSecret) delete payload.appSecret // 留空表示不修改已保存的密钥
      const res = await callApi<{ ok: boolean; changed: string[] }>('/config', payload)
      setStatus(`已保存${res.changed?.length ? `（更新：${res.changed.join('、')}）` : '（无变更）'}`)
      if (form.appSecret) setSecretTip('已更新')
      setForm((f) => ({ ...f, appSecret: '' }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }, [form])

  return (
    <div style={{ ...card, fontFamily: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>百通生图服务配置</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#64748b' }}>
        凭据仅保存在本机插件配置中，不会写入日志或随包分发。环境变量优先级更高。
      </p>

      <div style={fieldWrap}>
        <label style={labelStyle}>服务地址 Base URL</label>
        <input
          value={form.baseUrl}
          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          placeholder="https://your-host"
          style={inputStyle}
        />
        <div style={hintStyle}>可填 {`{host}`}、{`{host}/api`} 或 {`{host}/baitong_ai/api`}，插件会自动归一化到 {`{host}/baitong_ai/api/skill/generateImage`}。</div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', ...fieldWrap }}>
          <label style={labelStyle}>AppKey</label>
          <input value={form.appKey} onChange={(e) => setForm({ ...form, appKey: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 220px', ...fieldWrap }}>
          <label style={labelStyle}>AppSecret</label>
          <input
            type="password"
            value={form.appSecret}
            onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
            placeholder={secretTip}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px', ...fieldWrap }}>
          <label style={labelStyle}>接入方 channel</label>
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} style={inputStyle}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 150px', ...fieldWrap }}>
          <label style={labelStyle}>技能编码 skillCode</label>
          <input value={form.skillCode} onChange={(e) => setForm({ ...form, skillCode: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 120px', ...fieldWrap }}>
          <label style={labelStyle}>超时（秒）</label>
          <input
            type="number"
            min={10}
            value={form.timeoutSeconds}
            onChange={(e) => setForm({ ...form, timeoutSeconds: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '1 1 120px', ...fieldWrap }}>
          <label style={labelStyle}>尝试次数</label>
          <input
            type="number"
            min={1}
            max={6}
            value={form.maxAttempts}
            onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '1 1 150px', ...fieldWrap }}>
          <label style={labelStyle}>默认尺寸</label>
          <select value={form.defaultSize} onChange={(e) => setForm({ ...form, defaultSize: e.target.value })} style={inputStyle}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, color: '#334155' }}>
        <input
          type="checkbox"
          checked={form.retryOnTimeout}
          onChange={(e) => setForm({ ...form, retryOnTimeout: e.target.checked })}
        />
        读超时后自动重试
        <span style={hintStyle}>⚠️ 生成类接口按积分计费，关闭可避免重复生成与重复扣费。</span>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={save} disabled={saving} style={saving ? btnDisabled : btnPrimary}>
          {saving ? '保存中…' : '保存配置'}
        </button>
        {status && <span style={{ fontSize: 12, color: status.startsWith('已保存') ? '#0f766e' : '#b91c1c' }}>{status}</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 注册

export function apply(ctx: any) {
  const wrap = (Component: any) => () => React.createElement(Component, { ctx })

  ctx.slots.register({ name: 'workspace', component: wrap(WorkspaceComponent) })
  ctx.slots.register({ name: 'settings', component: wrap(SettingsComponent) })
}