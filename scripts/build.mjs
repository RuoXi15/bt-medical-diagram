/**
 * 构建脚本：产出 lib/index.js（Node half, ESM）与 lib/client.js（浏览器 CJS + ModuleLoader）
 *
 * React 相关包必须 external，否则 hooks 会崩（Cannot read properties of null）。
 */

import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(
  await import('node:fs/promises').then((fs) => fs.readFile(resolve(root, 'package.json'), 'utf8')),
)

const REACT_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

await mkdir(resolve(root, 'lib'), { recursive: true })

// ---- Node half ----
await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  // 源码不 import 任何 cordis 裸名（走 inject + apply(ctx) 约定），
  // 保留 external 以防后续引入 DSH 包时误打入第二份实例。
  external: ['@deepseek-ai/*'],
  logLevel: 'info',
})

// ---- Client half ----
const clientResult = await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  jsx: 'transform',
  // 客户端入口固定为 src/client/index.ts（合同要求的路径），
  // 显式声明 loader 让 esbuild 以 tsx 解析其中的 JSX。
  loader: { '.ts': 'tsx' },
  external: REACT_EXTERNALS,
  logLevel: 'info',
})

const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`
const footer = `\nreturn module.exports;\n} });\n`

const code = [banner, 'var module = { exports: {} };', 'var exports = module.exports;', clientResult.outputFiles[0].text, footer].join('\n')

await import('node:fs/promises').then((fs) => fs.writeFile(resolve(root, 'lib/client.js'), code, 'utf8'))

console.log(`[build] lib/index.js 与 lib/client.js 已生成（client ModuleLoader id = ${pkg.name}）`)