import React from 'react'
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

export const inject = ['slots']

const API = '/api/bt-medical-diagram'
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
  const [appKey, setAppKey] = React.useState('')
  const [appSecret, setAppSecret] = React.useState('')
  const [masked, setMasked] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    fetch(`${API}/config`)
      .then((res) => res.json())
      .then((cfg: any) => {
        if (!alive) return
        setAppKey(cfg?.appKey ?? '')
        setMasked(cfg?.appSecretMasked ?? '')
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const save = async () => {
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch(`${API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey, appSecret }),
      })
      const data = await res.json()
      if (data?.ok) {
        setStatus('已保存')
        setMasked(data?.settings?.appSecretMasked ?? '')
        setAppSecret('')
      } else {
        setStatus('保存失败')
      }
    } catch (error) {
      setStatus('保存失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, node: any, hint?: string) =>
    React.createElement(
      'div',
      { style: { marginBottom: 14 } },
      React.createElement('div', { style: { fontSize: 12, color: '#334155', marginBottom: 6 } }, label),
      node,
      hint ? React.createElement('div', { style: { fontSize: 11, color: '#94a3b8', marginTop: 4 } }, hint) : null,
    )

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 } },
    React.createElement(
      'div',
      { style: { fontSize: 13, color: '#0f172a', marginBottom: 10, fontWeight: 600 } },
      '百通凭据',
    ),
    field(
      'AppKey',
      React.createElement('input', {
        value: appKey,
        onChange: (event: any) => setAppKey(event.target.value),
        placeholder: '百通开放平台 AppKey',
        style: { width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 },
      }),
    ),
    field(
      'AppSecret',
      React.createElement('input', {
        type: 'password',
        value: appSecret,
        onChange: (event: any) => setAppSecret(event.target.value),
        placeholder: masked ? `已保存 ${masked}，留空则不修改` : '百通开放平台 AppSecret',
        style: { width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 },
      }),
      '只保存在本机，不会上传到任何第三方。',
    ),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 } },
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: save,
          disabled: saving,
          style: {
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: saving ? '#94a3b8' : '#0ea5e9', color: '#fff',
            fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
          },
        },
        saving ? '保存中…' : '保存',
      ),
      status
        ? React.createElement('span', { style: { fontSize: 12, color: status.startsWith('已保存') ? '#0f766e' : '#b91c1c' } }, status)
        : null,
    ),
    React.createElement(
      'div',
      { style: { fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.7 } },
      '接口地址、渠道、技能编码已内置，无需填写。',
    ),
  )
}

const overlayListeners = new Set<(open: boolean) => void>()
let overlayOpen = false
function setOverlay(open: boolean) {
  overlayOpen = open
  for (const listener of overlayListeners) listener(open)
}

function OverlayHost({ ctx }: { ctx: any }) {
  const [open, setOpen] = React.useState(overlayOpen)
  React.useEffect(() => {
    overlayListeners.add(setOpen)
    return () => { overlayListeners.delete(setOpen) }
  }, [])
  if (!open) return null
  return React.createElement(
    'div',
    {
      style: {
        position: 'fixed', inset: 0, zIndex: 2147483000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      },
      onClick: (event: any) => { if (event.target === event.currentTarget) setOverlay(false) },
    },
    React.createElement(
      'div',
      {
        style: {
          width: 'min(880px, 100%)', maxHeight: '86vh', overflow: 'auto',
          background: '#ffffff', borderRadius: 14, padding: 20,
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.28)',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
        React.createElement('strong', { style: { fontSize: 15 } }, '医学专业图示生成'),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => setOverlay(false),
            style: { border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
          },
          '关闭',
        ),
      ),
      React.createElement(WorkspaceComponent, { ctx }),
    ),
  )
}

// 兜底：万一侧栏「插件」行找不到，就退回侧栏底部按钮
function FallbackEntry({ ctx }: { ctx: any }) {
  return React.createElement(
    'button',
    {
      type: 'button',
      onClick: () => setOverlay(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1',
        background: '#f8fafc', color: '#0f172a', fontSize: 12, cursor: 'pointer',
      },
    },
    '🩺 医学图示',
  )
}

// 入口按钮：插到左侧栏「插件」那一行正下方（复用它的样式类；React 重渲染后自动补回）
function mountNavEntry() {
  if (typeof document === 'undefined') return () => {}
  const ID = 'bt-medical-diagram-nav-entry'
  const attempt = () => {
    if (document.getElementById(ID)) return
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLElement[]
    const ref =
      buttons.find((el) => el.getAttribute('aria-label') === '插件') ||
      buttons.find((el) => (el.getAttribute('aria-label') || '').indexOf('插件') >= 0) ||
      buttons.find((el) => (el.textContent || '').trim() === '插件')
    if (!ref || !ref.parentElement) return
    const button = document.createElement('button')
    button.id = ID
    button.type = 'button'
    button.setAttribute('aria-label', '医学图示')
    if (ref.className) button.className = ref.className
    button.style.display = 'flex'
    button.style.alignItems = 'center'
    button.style.gap = '10px'
    button.style.width = '100%'
    button.style.background = 'transparent'
    button.style.border = 'none'
    button.style.padding = '8px 10px'
    button.style.borderRadius = '10px'
    button.style.cursor = 'pointer'
    button.style.color = 'inherit'
    button.style.fontSize = 'inherit'
    const glyph = document.createElement('span')
    glyph.textContent = '🩺'
    glyph.style.fontSize = '16px'
    glyph.style.lineHeight = '1'
    const text = document.createElement('span')
    text.textContent = '医学图示'
    text.style.whiteSpace = 'nowrap'
    button.append(glyph, text)
    button.addEventListener('click', () => {
      console.info('[bt-medical-diagram] nav entry click -> open overlay')
      setOverlay(true)
    })
    ref.insertAdjacentElement('afterend', button)
  }
  attempt()
  const observer = new MutationObserver(() => attempt())
  observer.observe(document.body, { childList: true, subtree: true })
  const timer = window.setInterval(attempt, 1500)
  return () => {
    observer.disconnect()
    window.clearInterval(timer)
    const node = document.getElementById(ID)
    if (node) node.remove()
  }
}

export function apply(ctx: any) {
  const log = (...args: any[]) => console.info('[bt-medical-diagram]', ...args)
  const fail = (...args: any[]) => console.error('[bt-medical-diagram]', ...args)
  const wrap = (Component: any) => () => React.createElement(Component, { ctx })
  const TAB_KIND = 'bt-medical-diagram'

  log('apply() start', { hasSlots: !!ctx.slots, hasGet: typeof ctx.get === 'function' })

  // A) 入口按钮：插到左侧栏「插件」行下方
  ctx.effect(() => {
    let fallback: any = null
    let timer: any = null
    let disposeNav: any = () => {}
    try {
      disposeNav = mountNavEntry()
      log('nav entry mounted')
      timer = window.setTimeout(() => {
        if (document.getElementById('bt-medical-diagram-nav-entry')) return
        console.warn('[bt-medical-diagram] 侧栏「插件」行没找到，退回侧栏底部按钮')
        try {
          fallback = ctx.slots.inject('sidebar.footer.action', () =>
            ctx.slots.register(
              { name: 'sidebar.footer.action', id: 'bt-medical-diagram', key: 'bt-medical-diagram', order: 9, label: () => '医学图示' },
              wrap(FallbackEntry),
            ))
        } catch (error) {
          fail('fallback footer action failed', error)
        }
      }, 3000)
    } catch (error) {
      fail('nav entry failed', error)
    }
    return () => {
      if (timer) window.clearTimeout(timer)
      if (typeof fallback === 'function') { try { fallback() } catch {} }
      try { disposeNav() } catch {}
    }
  }, 'bt-medical-diagram: sidebar nav entry')

  // A2) 浮层宿主（点击侧栏按钮后显示工作台）
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          { name: 'shell.overlay', id: 'bt-medical-diagram-overlay', label: () => '医学图示' },
          wrap(OverlayHost),
        ),
      )
      log('registered shell.overlay', typeof dispose)
      return dispose
    } catch (error) {
      fail('shell.overlay failed', error)
      return () => {}
    }
  }, 'bt-medical-diagram: overlay host')

  // B) 插件配置卡片
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register(
          { name: 'plugins.bundle.config', key: 'bt-medical-diagram', inject: () => ({}) },
          wrap(SettingsComponent),
        ),
      )
      log('registered plugins.bundle.config', typeof dispose)
      return dispose
    } catch (error) {
      fail('plugins.bundle.config failed', error)
      return () => {}
    }
  }, 'bt-medical-diagram: config card')

  // C) 设置页分区
  ctx.effect(() => {
    try {
      const dispose = ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          { name: 'settings.section', id: 'bt-medical-diagram', order: 12, label: () => '医学图示', inject: () => ({}) },
          wrap(WorkspaceComponent),
        ),
      )
      log('registered settings.section', typeof dispose)
      return dispose
    } catch (error) {
      fail('settings.section failed', error)
      return () => {}
    }
  }, 'bt-medical-diagram: settings section')

  // D) 右侧栏标签页
  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      const tabs = typeof ctx.get === 'function' ? ctx.get('sidebarRightTabs') : undefined
      log('sidebarRightTabs =', !!tabs)
      const disposeType = tabs?.register?.({ id: TAB_KIND, kind: TAB_KIND, title: () => '医学图示' })
      if (typeof disposeType === 'function') disposers.push(disposeType)
      disposers.push(
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_KIND }, wrap(WorkspaceComponent)),
        ),
      )
      disposers.push(
        ctx.slots.inject('sidebar.right.pane.tab.title', () =>
          ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TAB_KIND }, () => '医学图示'),
        ),
      )
      log('registered right pane seats', disposers.length)
    } catch (error) {
      fail('right pane tab failed', error)
    }
    return () => {
      for (const dispose of disposers.reverse()) { try { dispose() } catch {} }
    }
  }, 'bt-medical-diagram: right pane tab')
}
