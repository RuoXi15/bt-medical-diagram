/**
 * 一致性门禁：在安装/发布前拦截合同级错误。
 * 与 <skill>/scripts/verify_plugin.py 互为补充，覆盖同样的铁律。
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const failures = []
const passes = []

function check(name, fn) {
  // 允许同步与异步两种检查项
  return Promise.resolve()
    .then(() => fn())
    .then(
      () => passes.push(name),
      (error) => failures.push(`${name} — ${error.message}`),
    )
}

const read = (p) => readFile(resolve(root, p), 'utf8')

const pkg = JSON.parse(await read('package.json'))
const NAME = pkg.name

await check('包名为小写连字符', () => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(NAME)) throw new Error(`非法包名 ${NAME}`)
})

await check('type=module 且 main 指向 lib/index.js', () => {
  if (pkg.type !== 'module') throw new Error('type 应为 module')
  if (pkg.main !== 'lib/index.js') throw new Error('main 应为 lib/index.js')
})

await check('exports 必备项齐全', () => {
  const e = pkg.exports ?? {}
  if (e['.'] !== './lib/index.js') throw new Error('exports["."] 应为 ./lib/index.js')
  if (e['./cordis.patch.yml'] !== './cordis.patch.yml') throw new Error('exports["./cordis.patch.yml"] 缺失')
  if (e['./client'] !== './lib/client.js') throw new Error('exports["./client"] 应为 ./lib/client.js')
  if (!e['./package.json']) throw new Error('exports["./package.json"] 缺失')
})

await check('dsh.bundle.patch 与 dsh.client.platform 正确', () => {
  if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('dsh.bundle.patch 应为 ./cordis.patch.yml')
  if (pkg.dsh?.client?.platform !== 'web') throw new Error('dsh.client.platform 应为 web')
})

await check('@deepseek-ai/* 依赖声明合规', () => {
  // 官方合同：需要与宿主共享实例的 DSH 包必须在 peerDependencies 与 devDependencies 双声明，
  // 但绝不能进 dependencies（否则会打入第二份 cordis 实例）。
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (dep.startsWith('@deepseek-ai/')) {
      throw new Error(`dependencies 不应声明 ${dep}（会打入第二份实例，应放 peerDependencies）`)
    }
  }
  const peers = Object.keys(pkg.peerDependencies ?? {})
  const devs = Object.keys(pkg.devDependencies ?? {})
  for (const peer of peers) {
    if (!devs.includes(peer)) {
      throw new Error(`${peer} 同时声明在 devDependencies（官方要求双声明）`)
    }
  }
})

await check('cordis.patch.yml insert id/name 等于包名', async () => {
  const patch = await read('cordis.patch.yml')
  if (!patch.includes('- insert:')) throw new Error('缺少 - insert:')
  if (!patch.includes(`id: ${NAME}`) || !patch.includes(`name: ${NAME}`)) {
    throw new Error(`insert id/name 与包名 ${NAME} 不一致`)
  }
})

await check('lib/index.js 已构建', async () => {
  const code = await read('lib/index.js')
  if (!code.includes('inject')) throw new Error('lib/index.js 未包含 inject 导出')
})

await check('lib/client.js ModuleLoader id 等于包名', async () => {
  const code = await read('lib/client.js')
  const expected = `window.__ModuleLoader__.load({ id: "${NAME}"`
  if (!code.includes(expected)) throw new Error(`client 未以 ${expected} 注册`)
})

await check('client bundle 未内联 React', async () => {
  const code = await read('lib/client.js')
  // 第二份 React 的典型特征：宿主已提供 React，bundle 里就不该出现其实现代码
  const inlinedSignatures = [
    'ReactCurrentDispatcher',
    'react_jsx_runtime_development',
    '__SECRET_INTERNALS_DO_NOT_USE',
    'ReactCurrentOwner',
  ]
  const hit = inlinedSignatures.find((sig) => code.includes(sig))
  if (hit) throw new Error(`检测到 React 实现被内联（${hit}），会导致 hooks 崩溃`)
  // react 必须以 require 形式留给宿主解析
  if (!/require\(["']react["']\)/.test(code)) {
    throw new Error('client 未通过 require("react") 引用宿主 React')
  }
})

await check('build.mjs client external 含全部 React 包', async () => {
  const script = await read('scripts/build.mjs')
  for (const dep of ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']) {
    if (!script.includes(dep)) throw new Error(`external 缺少 ${dep}`)
  }
})

await check('inject 覆盖 ctx.* 服务调用', async () => {
  const src = await read('src/index.ts')
  const match = src.match(/export const inject\s*=\s*\[([^\]]*)\]/)
  if (!match) throw new Error('未找到 export const inject')
  const declared = new Set(match[1].match(/['"]([a-zA-Z][\w]*)['"]/g)?.map((s) => s.slice(1, -1)) ?? [])
  const builtins = new Set([
    'effect', 'on', 'off', 'emit', 'provide', 'inject', 'logger', 'command',
    'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout', 'start', 'stop',
    'model', 'name', 'config', 'tool', 'commands', 'tools',
  ])
  const used = [...src.matchAll(/ctx\.([a-zA-Z]\w*)\s*\(/g)].map((m) => m[1])
  const missing = [...new Set(used)].filter((n) => !declared.has(n) && !builtins.has(n))
  if (missing.length) throw new Error(`未声明的服务：${missing.join(', ')}`)
})

await check('注册均在 ctx.effect() 内', async () => {
  const src = await read('src/index.ts')
  const effectStart = src.indexOf('ctx.effect(')
  if (effectStart === -1) throw new Error('未找到 ctx.effect(')
  for (const marker of ['ctx.commands.register(', 'ctx.tools.register(', 'ctx.webServer.register(']) {
    if (src.indexOf(marker) < effectStart) throw new Error(`${marker} 未在 ctx.effect() 内`)
  }
})

await check('files 覆盖发布产物', () => {
  const files = pkg.files ?? []
  for (const f of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'README.md']) {
    if (!files.includes(f)) throw new Error(`files 缺少 ${f}`)
  }
})

await check('INSTALL.md 与构建产物齐备', async () => {
  await read('INSTALL.md')
  // git 源安装不跑构建，lib/ 必须入库，否则加载失败
  for (const f of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml']) {
    await read(f)
  }
})

for (const p of passes) console.log(`  [PASS] ${p}`)
for (const f of failures) console.error(`  [FAIL] ${f}`)

if (failures.length) {
  console.error(`\n[gates] FAILED: ${failures.length}/${passes.length + failures.length} 项未通过`)
  process.exit(1)
}
console.log(`\n[gates] PASS: 全部 ${passes.length} 项通过`)