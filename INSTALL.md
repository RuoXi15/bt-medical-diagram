# 安装指南

本插件是 **bundle 插件**（`bundle-client` 形态）。安装命令会被 DSH 原样转发给 pnpm，装进指定 profile。

## 前置条件

| 依赖 | 要求 | 检查 |
|---|---|---|
| Node.js | `^22.19.0` 或 `>=24.0.0` | `node -v` |
| pnpm | 任意近期版本 | `pnpm -v` |
| DSH | 任意近期版本 | `dsh -V` |

> ⚠️ `dsh plugin` 只是把参数转发给 pnpm，所以**即使 `npx @deepseek-ai/dsh` 能启动，没有 pnpm 也装不了插件**。

本机若还没有 DSH：

```bash
npm install -g @deepseek-ai/dsh
# 或用官方 zero-install 入口（不装全局）
npx @deepseek-ai/dsh web
```

---

## 方式一：本地目录（开发推荐）

源码 checkout 已包含构建产物 `lib/`，可直接链接安装：

```bash
dsh plugin --profile web add link:/path/to/bt-medical-diagram
dsh web
```

**必须重启 `dsh web`**——bundle 的成员集合在启动时固定，增删 bundle 属于启动边界，不会热更。

> `link:` 前缀不能省。DSH 只接受 pnpm 能识别的源（`link:`、纯 git 源等）。
> 相对路径基于**执行命令时所在目录**解析，建议直接写绝对路径。

验证是否真的挂上了：

```bash
dsh web --dump-config | grep bt-medical-diagram
```

---

## 方式二：tarball（分发给他人）

```bash
cd bt-medical-diagram
pnpm run bundle      # 确保 lib/ 是最新的
pnpm pack            # 生成 bt-medical-diagram-0.1.0.tgz
```

对方执行：

```bash
dsh plugin --profile web add ./bt-medical-diagram-0.1.0.tgz
dsh web
```

tarball 内是**已构建好的代码**，安装时不需要授权任何构建脚本，也就不需要 `allowBuilds`。

---

## 方式三：git 源

```bash
# 在插件目录
git init
git add -A && git commit -m "feat: 医学专业图示生成 DSH 插件"
git remote add origin <your-repo-url>
git push -u origin main
```

构建产物 `lib/` **必须提交**——git 安装默认不跑构建脚本。

对方执行：

```bash
dsh plugin --profile web add "github:<owner>/<repo>#main"
```

> 建议锁定 SHA（`#<sha>`）而非跟随分支，保证可复现。

如果 pnpm 提示需要授权构建（`allowBuilds`），在 **profile 的** `pnpm-workspace.yaml` 里加：

```yaml
allowBuilds:
  bt-medical-diagram: true
```

然后重试。⚠️ `allowBuilds` 意味着允许该包代码在安装时于你机器上执行，**且不在 agent 的沙箱内**——只对自己审阅过的源码授权。

---

## Profile 选择

| Profile | 适用 |
|---|---|
| `web` | ✅ 本插件。含浏览器工作区与设置面板 |
| `headless` | ❌ 无浏览器界面，只有命令可用 |

**不同 profile 的依赖与 bundle 组合是各自独立的**，装到 `web` 不会让 `headless` 拥有它。

首次使用某个不存在的 profile 时，CLI 会自动初始化（官方 web/headless 用内置模板，其它从 base bundle 起）。

---

## 安装后：填写凭据

插件装上后**默认没有凭据**，生图会如实报错。配置入口二选一：

### 方式 A：网页设置面板（推荐）

打开 DSH Web → 设置 → `bt-medical-diagram` 面板，填写：

| 字段 | 说明 |
|---|---|
| Base URL | `https://{host}`、`{host}/api`、`{host}/baitong_ai/api` 均可，插件自动归一化 |
| AppKey / AppSecret | 百通开放平台凭据，仅存本机，AppSecret 读取时脱敏显示 |
| channel | `workbuddy` / `qwenwork` |
| skillCode | 已开通的技能编码，默认 `BT_08DA7C1A` |
| 超时 / 尝试次数 | 默认 300 秒 / 3 次 |
| 读超时后重试 | 默认开；⚠️ 关掉可避免重复生成与重复扣费 |

AppSecret 留空表示不修改已保存的值。

### 方式 B：环境变量（优先级更高）

```bash
export BAITONG_API_BASE_URL="https://your-host"
export BAITONG_APP_KEY="..."
export BAITONG_APP_SECRET="..."
export BAITONG_SKILL_CODE="BT_08DA7C1A"
export BAITONG_CHANNEL="workbuddy"

dsh web
```

可用键：`BAITONG_API_BASE_URL`/`BAITONG_BASE_URL`、`BAITONG_APP_KEY`、`BAITONG_APP_SECRET`、`BAITONG_CHANNEL`/`CHANNEL`、`BAITONG_SKILL_CODE`/`SKILL_CODE`、`BAITONG_TIMEOUT_SECONDS`、`BAITONG_MAX_ATTEMPTS`、`BAITONG_RETRY_ON_TIMEOUT`。

---

## 安装后验证清单

```bash
# 1. 确认 bundle 已进入组合树
dsh web --dump-config | grep bt-medical-diagram

# 2. 启动（必须重启）
dsh web
```

浏览器里逐项确认：

- [ ] 启动日志无 `plugin tree failed to load`
- [ ] 控制台无 `slot entry crashed`、无重复 React / `useState` null 报错
- [ ] 设置面板可见，能保存
- [ ] 工作区可见，能点「仅预览 Prompt」不报错
- [ ] 命令 `/medical-diagram.prompt 生成一张COPD流程图` 有返回（不消耗积分）
- [ ] 填好凭据后 `/medical-diagram 生成一张测试机制图` 能出图

**冒烟小技巧**：先跑 `/medical-diagram.prompt`——它只优化 Prompt 不调接口，能验证命令注册、Prompt 逻辑、参数传递是否正常，且**零成本**。

---

## 更新与卸载

```bash
dsh plugin --profile web update bt-medical-diagram
dsh plugin --profile web why bt-medical-diagram      # 看依赖来源
dsh plugin --profile web remove bt-medical-diagram   # 卸载
```

⚠️ **卸载有个坑**：`remove` 只删依赖，**不会回写 patch 层**。需手动打开
`$DSH_HOME/profiles/web/cordis.patch.yml`，删掉对应的 `- insert:` 行：

```yaml
- insert:
    - id: bt-medical-diagram
      name: bt-medical-diagram
```

（`$DSH_HOME` 默认 `~/.dsh`。）

---

## 故障排查

| 症状 | 原因 | 修复 |
|---|---|---|
| `pnpm is not recognized` | 没装 pnpm | 装 pnpm 后重试 |
| 装完插件没生效 | 没重启 | 重启 `dsh web`（增删 bundle 跨启动边界） |
| web 里有、headless 里没有 | profile 相互独立 | 分别安装 |
| git 源安装卡在 allowBuilds | pnpm 10+ 拦截构建 | 审核源码后按提示加 `allowBuilds` |
| TS 源码包加载失败、缺 `lib/` | git 安装不跑 build | 提交 `lib/` 或加 `prepare` 脚本 |
| 命令没注册 | 命令名冲突或未加载 | `dsh web --dump-config` 确认 bundle 在树内 |
| 报「凭据未配置」 | 正常，这是设计 | 去设置面板填 AppKey/AppSecret |
| 生图超时 | 平台排队 | 提高超时秒数，或关闭超时重试避免二次扣费 |

配置层排查权威工具是 `--dump-config`，它会打印完整组合树并标注每层来源。

---

## 深入

- profile 目录：`$DSH_HOME/profiles/<name>/`（默认 `~/.dsh/profiles/`）
- 查看完整组合：`dsh web --dump-config`
- 仅看 bundle 层：`dsh web --dump-default-config`
- 本插件 README：`README.md`