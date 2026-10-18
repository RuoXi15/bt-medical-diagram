# bt-medical-diagram

> 医学专业图示生成 —— DSH 插件版
> 把医学图示需求优化为专业 Prompt，再调用百通 `POST /baitong_ai/api/skill/generateImage` 出图。

由百通 Skill `BT_08DA7C1A`（原 Python 技能包）迁移而来，能力等价并新增网页工作区与凭据配置面板。

## 能力

| 能力面 | 入口 |
|---|---|
| 命令 | `/medical-diagram <需求>` 生成图示（别名 `/医学图示`） |
| 命令 | `/medical-diagram.prompt <需求>` 仅优化 Prompt，不调用接口、不计费 |
| 工具 | `medical_diagram`（供模型调用） |
| HTTP | `GET /bt-medical-diagram/health` 冒烟路由 |
| HTTP | `GET / POST /bt-medical-diagram/config` 读取/更新配置 |
| HTTP | `POST /bt-medical-diagram/prompt` 仅优化 Prompt |
| HTTP | `POST /bt-medical-diagram/generate` 生图 |
| 服务 | 其它插件 `inject: ['medicalDiagram']` 后调用 `ctx.medicalDiagram.generate()` |
| 网页 | 工作区插槽：生图工作区；设置插槽：凭据与策略配置 |

支持的图示类型：药物作用机制、疾病机制、诊疗流程、解剖生理、医学对比、患者教育。

## 安装

完整步骤见 **[INSTALL.md](INSTALL.md)**（含前置条件、三种分发方式、profile 选择、凭据配置、验证清单与故障排查）。

最快路径：

```bash
dsh plugin --profile web add link:/path/to/bt-medical-diagram
dsh web
```

首次安装后必须重启 web（bundle 成员在启动时固定，不热更）。

> 装完是**没有凭据**的，生图会如实报错。请到设置面板填写，或用 `BAITONG_APP_KEY` 等环境变量。
> 零成本自检：`/medical-diagram.prompt 生成一张COPD流程图` —— 只优化 Prompt，不调接口。

## 配置凭据

打开 DSH Web 的插件设置 → `bt-medical-diagram`，填写：

| 字段 | 说明 |
|---|---|
| Base URL | `https://{host}`、`{host}/api`、`{host}/baitong_ai/api` 均可，插件自动归一化到 `{host}/baitong_ai/api/skill/generateImage` |
| AppKey / AppSecret | 百通开放平台凭据，仅存本机，AppSecret 读取时脱敏 |
| channel | `workbuddy` / `qwenwork` |
| skillCode | 已开通的技能编码，默认 `BT_08DA7C1A` |
| 超时 / 尝试次数 | 默认 300 秒 / 3 次 |
| 读超时后重试 | 默认开启；⚠️ 关闭可避免重复生成与重复扣费 |

也可用环境变量覆盖（优先级高于面板）：

```bash
BAITONG_API_BASE_URL   BAITONG_APP_KEY   BAITONG_APP_SECRET
BAITONG_CHANNEL        BAITONG_SKILL_CODE
BAITONG_TIMEOUT_SECONDS  BAITONG_MAX_ATTEMPTS  BAITONG_RETRY_ON_TIMEOUT
```

## 使用示例

```bash
/medical-diagram 生成一张司美格鲁肽降糖机制图
/medical-diagram 生成一张 COPD 诊疗流程图 --size 1024x1536
/medical-diagram 生成一张他汀与贝特类对比图 --no-retry-on-timeout
```

```bash
curl -X POST http://localhost:<port>/bt-medical-diagram/generate \
  -H 'Content-Type: application/json' \
  -d '{"request":"生成一张司美格鲁肽降糖机制图","size":"1024x1024"}'
```

成功返回 `ok: true` 与 `imageUrl`；失败时原样返回平台 `code` / `msg`，不编造图片链接。

## 边界与失败语义

- 仅组织用户提供的医学对象与关系，**不补造**剂量、疗效、发生率、临床结论或指南建议。
- Prompt 超 4000 字符直接报错，提示缩小范围。
- 平台 `code != 200`：原样交付 `code`/`msg`，附带 `retries` 与 `retryReasons`。
- 网络/超时：抛出真实异常文本，绝不伪造 `code=200`。
- 本插件不替代医学事实核验、诊断或治疗决策。

## 开发

```bash
pnpm install
pnpm run bundle     # 生成 lib/index.js 与 lib/client.js
pnpm run gates      # 合同一致性门禁
pnpm run pack:check # 包内容预检
```

## License

MIT