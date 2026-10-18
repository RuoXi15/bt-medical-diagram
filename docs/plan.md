# bt-medical-diagram 插件计划

> 由 DSH 插件开发助手（dsh-plugin-studio）生成，源为百通 Skill `BT_08DA7C1A` 医学专业图示生成。

## 阶段 ①：需求捕获

- [x] 插件名：`bt-medical-diagram`
- [x] 一句话目标：把医学图示需求优化为专业 Prompt 并调用百通生图服务，交付可直接用于医学会议/培训/药企 PPT 的图示
- [x] 能力面清单：
  - 命令/工具：`/medical-diagram`、`/medical-diagram.prompt`、tool `medical_diagram`
  - HTTP 接口：`/health`、`/config`、`/prompt`、`/generate`
  - 对外服务：`medicalDiagram`（其它插件可注入）
  - 设置面板：百通凭据与重试策略（凭据由用户手动输入）
  - 工作区：生图工作区（输入需求 → 预览 Prompt → 生图 → 展示）
- [x] 目标 profile：web

## 阶段 ②：形态与分发决策

- [x] 形态：`bundle-client`（需要网页工作区与设置面板）
- [x] 分发方式：本地目录起步，后续可切 git 源（构建产物 `lib/` 须入库）
- [x] 包管理器：pnpm

## 阶段 ③：配方装配

- [x] `src/index.ts` 已生成（command-tool + http-api + service-provider 合并）
- [x] `src/client/index.ts` 已生成（settings-panel + dashboard-workspace 合并）
- [x] `src/prompt-builder.ts`、`src/baitong-client.ts`、`src/settings.ts` 为原 Python 逻辑的 TS 移植
- [x] `inject` 覆盖所有服务（node: `['webServer']`；client: `['slots','ui']`）
- [x] 冒烟功能就绪：`/medical-diagram`、`GET /bt-medical-diagram/health`、工作区 UI 标记
- [x] 未手改 `lib/`

## 阶段 ④：本地验证

- [x] `pnpm install` 通过
- [x] `pnpm run bundle` 通过
- [x] `pnpm run gates` 通过（14 项）
- [x] `verify_plugin.py` 通过 10/11（唯一失败项为已知的规则冲突，见下方「规范冲突」）
- [x] `npm pack --dry-run` 通过

### 规范冲突：`@deepseek-ai/*` 依赖声明

`dsh-plugin-studio/scripts/verify_plugin.py` 的「禁止声明 @deepseek-ai/* 依赖」一项，与 DSH 官方
文档《打包与安装插件》冲突：

- **skill 校验器**：禁止在 `dependencies` / `peerDependencies` / `optionalDependencies` 声明 `@deepseek-ai/*`。
- **官方文档**：需要与宿主共享实例的 DSH 包，**必须同时声明在 `peerDependencies` 与 `devDependencies`**。
  `peerDependencies` 决定运行时用宿主已加载的共享实例，`devDependencies` 供类型检查与独立测试。

**决策：以官方文档为准**，保留 `@deepseek-ai/cordis` 的双声明。理由：

1. 官方文档描述的是实际运行时解析行为，是权威来源；skill 校验器是启发式静态检查。
2. 真实社区插件（如 `@deepseek-ai/dsh-headless` 的 package.json）就是这么声明的。
3. 漏声明的风险是运行时解析到第二份 cordis 实例，导致 `ctx` 隔离——比校验器误报严重得多。

本仓库 `scripts/gates/run.mjs` 已把该检查项改为官方语义：`dependencies` 禁止 `@deepseek-ai/*`，
`peerDependencies` 必须与 `devDependencies` 成对出现。

## 阶段 ⑤：安装与浏览器冒烟

详见 [INSTALL.md](../INSTALL.md)。本机未安装 DSH CLI，以下待用户在有 DSH 的环境执行。

- [ ] 安装成功：`dsh plugin --profile web add link:<插件目录>`
- [ ] `dsh web --dump-config | grep bt-medical-diagram` 能在组合树中看到
- [ ] 启动日志无 `plugin tree failed to load`
- [ ] 浏览器无 `slot entry crashed`
- [ ] 零成本自检：`/medical-diagram.prompt 生成一张COPD流程图` 有返回
- [ ] 设置面板可见可保存；工作区可生图

## 阶段 ⑥：发布

- [ ] git 仓库与 remote 就绪
- [ ] README 使用真实安装 ref
- [ ] `lib/` 构建产物已入库
- [ ] 从目标 ref 重装验证通过

## 备注

- **Python → TypeScript 迁移要点**
  - `httpx` → 原生 `fetch` + `AbortController`（超时语义等价）
  - `hashlib.md5` → `node:crypto` 的 `createHash('md5')`
  - `from_platform_auth()` 移除：DSH 无百通鉴权壳注入层，改为设置面板手动输入凭据 + 环境变量覆盖
  - prompt_builder 的类型判定顺序做了调整：机制类关键词前置，避免「作用机制…器官」被解剖类误捕获
- 决策变更记录：原定 `bundle`（纯后端），因用户需要网页界面与凭据配置，在阶段 ② 决策为 `bundle-client`。