<div align="center">

# Product Manual Automation

面向微信小程序与 PC 网页的产品操作手册自动化 Plugin

从源码发现、运行验证、数据库只读取证，到截图脱敏、标注审阅和 Markdown 发布，形成一条可追溯、可增量更新的手册生产流程。

![Version](https://img.shields.io/badge/version-0.1.0-2563EB)
![Node](https://img.shields.io/badge/Node.js-%3E%3D22.5-339933?logo=nodedotjs&logoColor=white)
![Output](https://img.shields.io/badge/output-Markdown-111827?logo=markdown)
![Platforms](https://img.shields.io/badge/platforms-WeChat%20%7C%20Web-07C160)

</div>

> 当前版本是面向 Codex 本地环境的兼容实现，支持原生微信小程序、uni-app 微信小程序编译产物和 PC 网页；暂不支持原生 PC 客户端，也不负责导入已有手册。

## 目录

- [它能做什么](#它能做什么)
- [核心设计](#核心设计)
- [工作原理](#工作原理)
- [系统要求](#系统要求)
- [安装](#安装)
- [快速开始](#快速开始)
- [配置](#配置)
- [使用方式](#使用方式)
- [数据库 MCP](#数据库-mcp)
- [截图脱敏、标注与审阅](#截图脱敏标注与审阅)
- [产物说明](#产物说明)
- [常用命令](#常用命令)
- [注意事项](#注意事项)
- [测试与验证](#测试与验证)
- [分发状态与规划](#分发状态与规划)
- [贡献与许可证](#贡献与许可证)

## 它能做什么

Product Manual Automation 不是简单地从源码生成说明文字。它会把源码识别出的功能当作“候选地图”，再结合实际界面运行、用户确认和可选的数据库只读证据，整理出可复现的产品操作路径。

| 能力 | 说明 |
| --- | --- |
| 多平台手册 | 支持微信小程序与 PC 网页，可单独启用，也可同时生成两套平台手册和一个公共索引 |
| 微信小程序适配 | 支持原生微信小程序，以及 uni-app 生成的最新、可运行的 mp-weixin 编译产物 |
| PC 网页适配 | 支持 React、Vue、Angular 及通用 Web 项目；可使用已有登录态或隔离浏览器环境 |
| 源码发现 | 扫描路由、页面、菜单、按钮、表单、接口调用、后端校验、异常信息和状态流转候选 |
| 运行验证 | 将每个操作拆分为连续的界面状态变化，并记录操作前、操作后和结果状态 |
| 数据库只读取证 | 通过 MCP 读取 MySQL、PostgreSQL 和 SQLite，辅助确认字段、状态与业务关系 |
| 隐私保护 | 支持自定义脱敏分类、规则、作用范围和处理方式，原始截图保持不可变 |
| 自动标注 | 支持编号、箭头和目标框；优先使用 DOM、Playwright 或微信选择器的确定性坐标 |
| 可视化审阅 | 默认所有发布截图均需审核，可局部修正单个箭头、目标框或脱敏区域 |
| 自定义模板 | 默认生成功能型 Markdown 手册，可配置标题、栏目名称、排序、图片宽度和业务节点 |
| 增量更新 | 使用稳定 ID 和依赖关系识别影响范围，避免重复生成未变化的模块 |
| 严格发布校验 | 发布前检查操作覆盖、入口路径、截图序列、隐私确认、审阅状态和四道门禁 |

Plugin 内置 5 个相互协作的 Skills：

| Skill | 职责 |
| --- | --- |
| product-manual-automation | 总流程编排、范围确认、证据管理、增量更新和发布校验 |
| product-manual-wechat | 微信源码扫描、编译产物检查、开发者工具运行验证与截图 |
| product-manual-web | Web 源码扫描、浏览器选择、运行验证与截图 |
| product-manual-template | Markdown 模板配置、渲染规则和发布结构校验 |
| product-manual-review | 截图脱敏、标注、对象级审阅和局部失效控制 |

本 Plugin 独立运行，不会修改、覆盖或依赖原有的 generate-miniprogram-user-manual Skill 工作目录。

## 核心设计

### 功能优先，而不是角色优先

默认手册按“功能模块 → 业务节点 → 用户操作”组织。角色、权限、证据类型、执行状态和审核信息只保存在内部工作区，不作为固定章节污染最终手册。

### 统一能力模型

Plugin 使用一套跨平台的数据模型组织手册：

```text
Module
└── BusinessNode
    └── Operation
        ├── WeChat PlatformVariant
        │   └── Transition: fromState → target → toState
        └── Web PlatformVariant
            └── Transition: fromState → target → toState
```

其中：

- Capability 表示扫描得到的用户功能候选；
- Operation 表示与平台无关的用户目标；
- PlatformVariant 表示同一功能在微信或 Web 端的实现；
- Transition 表示一次可观察、可截图的界面状态变化；
- Evidence 表示源码、运行时、数据库、用户确认或推断证据。

### 四道确认门禁

| 门禁 | 确认内容 |
| --- | --- |
| Gate 1 | 平台范围、功能模块、可见入口和明确排除项 |
| Gate 2 | 业务节点、主流程、派生操作、自包含入口和执行等级 |
| Gate 3 | 账号、数据、隐私、数据库范围，以及提交、审批、删除等写操作授权 |
| Gate 4 | 截图审阅、隐私版本、内部缺口、废弃资源和最终发布状态 |

### A / B / C / D 执行等级

| 等级 | 含义 |
| --- | --- |
| A | 在明确授权后完成终态操作 |
| B | 验证到确认边界或安全终点，不执行高影响写入 |
| C | 只验证导航、查询、筛选、详情和可见状态 |
| D | 仅依据源码、用户说明或数据库证据整理，不进行运行操作 |

## 工作原理

```text
项目识别与环境检查
        ↓
微信 / Web / 后端源码扫描
        ↓
Capability Graph 与 Operation 规划
        ↓
四道门禁确认 + A/B/C/D 执行等级
        ↓
微信开发者工具或浏览器运行验证
        ↓
原图 → 脱敏图 → 标注图 → 操作序列图
        ↓
可视化审阅与局部修正
        ↓
平台手册渲染 + 覆盖率报告 + 严格发布校验
```

源码扫描只负责发现候选，不会把按钮名、接口名或处理函数直接当成已确认的业务流程。最终发布的操作必须具备自包含入口、适用场景、可见结果和连续的截图证据。

## 系统要求

### 基础环境

| 项目 | 要求 |
| --- | --- |
| Node.js | 22.5 或更高版本 |
| npm | 与 Node.js 配套的可用版本 |
| Codex | 用于加载 Plugin、调用 Skills 和本地 MCP |
| 操作系统 | 当前主要面向可运行 Codex、浏览器及微信开发者工具的本地环境 |

检查本机版本：

```bash
node --version
npm --version
codex --version
```

### 微信小程序环境

微信运行验证还需要：

- 微信开发者工具；
- 已安装且可用的 wechatide-skill；
- 原生微信小程序工程，或 uni-app 最新生成的 mp-weixin 编译产物；
- 能够进入目标功能的测试账号和测试数据。

uni-app 必须提供最新编译产物，是因为微信开发者工具实际运行的是 mp-weixin 输出，而不是 Vue 源码本身。旧产物或缺失产物会让截图、页面结构和当前源码不一致，因此 Plugin 会在产物缺失或落后于源码时阻止运行验证。

### PC 网页环境

Web 运行验证可选择：

- ego-browser：适合复用用户现有登录态、Cookie 和浏览器上下文；
- Playwright：适合测试账号、隔离运行、可重复执行、CI 或远程执行。

二者至少具备一种即可。若操作路径已经依赖某一种浏览器上下文，运行过程中不应无记录地切换执行器。

### 数据库环境（可选）

数据库能力不是生成手册的必选项。启用后可连接：

- MySQL；
- PostgreSQL；
- SQLite。

建议使用专门的只读账号，并同时在数据库权限层和 Plugin 查询层限制写入。

## 安装

### 1. 获取源码并安装依赖

```bash
git clone <repository-url>
cd product-manual-automation
npm install
```

### 2. 作为本地 Codex Plugin 安装

当前仓库是独立 Plugin 源码包。可将它放入个人或团队 Marketplace 的 plugins 目录：

```text
<marketplace-root>/
├── marketplace.json
└── plugins/
    └── product-manual-automation/
        ├── .codex-plugin/plugin.json
        ├── .mcp.json
        ├── skills/
        └── ...
```

Marketplace 配置示例：

```json
{
  "name": "product-manual-local",
  "interface": {
    "displayName": "Product Manual Local"
  },
  "plugins": [
    {
      "name": "product-manual-automation",
      "source": {
        "source": "local",
        "path": "./plugins/product-manual-automation"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

注册 Marketplace 并安装 Plugin：

```bash
codex plugin marketplace add /absolute/path/to/<marketplace-root>
codex plugin add product-manual-automation@product-manual-local
```

检查安装结果：

```bash
codex plugin list --available
```

> Plugin 的本地 MCP 使用 Node.js 进程启动，因此发布或复制 Plugin 后仍需确保依赖已经安装。

## 快速开始

以下命令均在 Plugin 根目录执行。

### 1. 初始化目标产品项目

同时启用微信和 Web：

```bash
node scripts/init-workspace.mjs \
  --project /absolute/path/to/product-project \
  --platforms wechat,web
```

仅启用微信：

```bash
node scripts/init-workspace.mjs \
  --project /absolute/path/to/product-project \
  --platforms wechat
```

仅启用 PC 网页：

```bash
node scripts/init-workspace.mjs \
  --project /absolute/path/to/product-project \
  --platforms web
```

### 2. 检查环境

```bash
node scripts/preflight.mjs \
  --project /absolute/path/to/product-project \
  --platforms wechat,web
```

### 3. 在 Codex 中发起任务

推荐通过自然语言让主 Skill 编排完整流程，例如：

```text
请为 /absolute/path/to/product-project 生成一份功能型产品操作手册。
平台包含微信小程序和 PC 网页，默认所有发布截图均需审阅。
先完成项目识别和功能范围确认，再开始运行验证。
```

增量更新示例：

```text
请审计并增量更新 /absolute/path/to/product-project 的现有产品手册。
只重新验证受到本次代码变更影响的功能，不要重复生成未变化模块。
```

只处理截图审阅示例：

```text
请打开 /absolute/path/to/product-project 的截图审阅队列，
逐项处理待审核的标注和脱敏区域，并重新生成受影响的图片。
```

## 配置

初始化后，目标产品项目会生成以下配置：

```text
<product-project>/.product-manual/config/
├── project.json
├── template.json
├── privacy-policy.json
├── visual-policy.json
└── database-profiles.json
```

### 项目配置

项目配置保存启用平台、源码根目录、后端目录、输出目录、默认语言和模块排序等信息。

```json
{
  "schemaVersion": 1,
  "projectName": "example-product",
  "platforms": ["wechat", "web"],
  "repositoryRoot": "/absolute/path/to/product-project",
  "sourceRoots": {},
  "backendRoot": null,
  "outputRoot": "docs/product-manual",
  "defaultLanguage": "zh-CN",
  "moduleOrder": [],
  "scopeRevision": 1
}
```

### Markdown 模板配置

默认模板为功能型结构，可调整标题、栏目名称、业务节点显示、异常说明和图片宽度，但不能删除适用场景、可见结果、自包含入口、隐私合规截图链和证据关联等发布必需项。

```json
{
  "schemaVersion": 1,
  "profile": "function-first",
  "title": "产品操作手册",
  "includeBusinessNodes": true,
  "includeBusinessErrors": true,
  "headings": {
    "scenario": "适用场景",
    "result": "操作结果",
    "screenshots": "操作步骤截图",
    "errors": "异常说明"
  },
  "imageWidth": 760,
  "platformLabels": {
    "wechat": "微信小程序",
    "web": "PC 网页"
  }
}
```

### 隐私与脱敏配置

默认隐私策略处于待确认状态。在确认隐私策略前，Plugin 不允许注册可发布截图。

隐私策略模型允许声明以下脱敏动作：

```text
solid-mask
partial-mask
blur
pixelate
replace-text
exclude-capture
```

当前 0.1.0 图像渲染器原生执行实体遮罩、模糊和像素化。部分遮罩与文本替换会安全降级为实体遮罩；整张截图排除需要由 Agent 同步更新 Operation 的发布状态，尚不是单独依靠图像渲染器即可完成的动作。

策略示例：

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "status": "pending",
  "defaultAction": "solid-mask",
  "preserveFunctionalControls": true,
  "categories": [
    {
      "id": "phone",
      "label": "电话",
      "enabled": true,
      "action": "partial-mask"
    },
    {
      "id": "financial",
      "label": "财务与账户信息",
      "enabled": true,
      "action": "solid-mask"
    }
  ],
  "rules": [],
  "protectedElements": [
    "action-target",
    "page-title",
    "field-label",
    "status-label",
    "button-text",
    "confirmation-message",
    "success-message"
  ]
}
```

编辑策略副本后，通过命令应用并确认：

```bash
node scripts/configure-privacy.mjs \
  --project /absolute/path/to/product-project \
  --policy /absolute/path/to/updated-policy.json \
  --confirm
```

可记录确认人：

```bash
node scripts/configure-privacy.mjs \
  --project /absolute/path/to/product-project \
  --policy /absolute/path/to/updated-policy.json \
  --confirm \
  --confirmed-by reviewer-name
```

隐私规则只应保存分类、匹配规则和处理动作，不得保存命中的真实敏感值。

### 视觉标注与审阅配置

默认开启编号箭头标注，并要求标注和脱敏对象全部审核：

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "annotationEnabled": true,
  "style": "number-arrow",
  "color": "#ff1f0f",
  "lineWidth": 5,
  "numberRadius": 18,
  "reviewMode": "all",
  "requireAnnotationReview": true,
  "requireRedactionReview": true,
  "confidenceThreshold": 0.9,
  "longSequenceColumns": 3,
  "longSequenceThreshold": 4
}
```

切换审阅模式：

```bash
node scripts/configure-review.mjs \
  --project /absolute/path/to/product-project \
  --mode all
```

可选模式：

| 模式 | 行为 |
| --- | --- |
| all | 默认值；每张发布截图及其当前标注、脱敏对象都必须审核 |
| risky | 只审核低置信度、视觉推断、冲突项或隐私敏感项 |
| none | 跳过人工审阅，并在发布状态中记录该决定 |

## 使用方式

### 推荐：由 Plugin 自动编排

日常使用不需要手工串联全部脚本。安装 Plugin 后，在 Codex 中说明目标项目、平台范围、手册类型和审阅要求，主 Skill 会按需调用平台 Skill、MCP 和脚本。

典型流程包括：

1. 识别项目类型与平台；
2. 初始化独立工作区；
3. 扫描前端、后端和可选数据库；
4. 与用户确认四道门禁；
5. 为每个 Operation 分配执行等级；
6. 使用微信开发者工具或浏览器验证连续操作路径；
7. 生成、脱敏和标注截图；
8. 完成可视化审阅；
9. 渲染平台手册和公共索引；
10. 执行严格发布校验。

### 手工执行源码扫描

项目识别：

```bash
node scripts/detect-project.mjs \
  --project /absolute/path/to/product-project
```

扫描微信源码：

```bash
node scripts/scan-wechat.mjs \
  --project /absolute/path/to/product-project \
  --source-root /absolute/path/to/wechat-source \
  --wechat-project /absolute/path/to/mp-weixin
```

扫描 Web 源码：

```bash
node scripts/scan-web.mjs \
  --project /absolute/path/to/product-project
```

扫描后端源码：

```bash
node scripts/scan-backend.mjs \
  --project /absolute/path/to/product-project \
  --backend /absolute/path/to/backend-project
```

> 扫描结果是候选清单，不等于已经验证完成的业务流程。运行验证和用户确认仍然是正式发布的必要环节。

## 数据库 MCP

本 Plugin 内置本地 stdio MCP Server，用于提供数据库只读取证和截图审阅状态操作。

数据库工具：

```text
database_list_profiles
database_test_connection
database_inspect_schema
database_execute_readonly_query
database_record_evidence
```

审阅工具：

```text
review_get_queue
review_update_object
review_approve_capture
review_set_mode
```

### 数据库配置

将以下内容写入目标产品项目的配置文件：

```text
<product-project>/.product-manual/config/database-profiles.json
```

示例：

```json
{
  "profiles": [
    {
      "id": "development-mysql",
      "engine": "mysql",
      "host": "127.0.0.1",
      "port": 3306,
      "database": "app_development",
      "user": "manual_reader",
      "environment": "development",
      "productionLike": false,
      "passwordEnv": "PRODUCT_MANUAL_MYSQL_PASSWORD",
      "maxRows": 100,
      "timeoutMs": 10000,
      "sensitiveColumns": ["customer_name"]
    },
    {
      "id": "local-sqlite",
      "engine": "sqlite",
      "filename": "/absolute/path/to/app.sqlite",
      "maxRows": 100
    }
  ]
}
```

数据库密码只能由 passwordEnv 指向环境变量，禁止把密码、Token、连接串或其他凭据写入配置文件：

```bash
export PRODUCT_MANUAL_MYSQL_PASSWORD='<database-password>'
```

数据库安全边界：

- 只允许 SELECT、WITH、SHOW、DESCRIBE、EXPLAIN 和 PRAGMA 等只读语句；
- 拒绝多语句、写操作、管理操作和文件访问类 SQL；
- 默认限制返回行数和执行时间；
- 常见姓名、电话、邮箱、地址、证件、账户等敏感列自动脱敏；
- 识别为生产型的配置必须在用户明确授权后传入 productionReadApproved；
- 数据库结果用于辅助确认业务事实，不单独证明用户操作顺序。

## 截图脱敏、标注与审阅

### 图片处理链

```text
不可变原始 PNG
    ↓
脱敏图
    ↓
编号箭头与目标框标注图
    ↓
多步骤操作序列图
    ↓
Markdown 手册引用
```

原始截图一旦以相同 ID 注册，不允许被不同内容覆盖。脱敏、标注和序列图均由原图和 JSON sidecar 重新生成，便于审计和局部更新。

### 标注定位优先级

```text
Web DOM / ARIA / Playwright 几何信息
→ 微信选择器与元素几何信息
→ PaddleOCR 文本框候选
→ OmniParser 或其他 UI 元素解析候选
→ 人工矩形
```

PaddleOCR、OmniParser 和视觉模型当前通过统一候选接口接入，不随 Plugin 内置完整模型运行环境。OCR 或视觉模型输出只作为候选，不能直接视为发布真值。

### 可视化审阅页

启动本地审阅页：

```bash
node scripts/serve-review.mjs \
  --project /absolute/path/to/product-project
```

默认地址：

```text
http://127.0.0.1:4319
```

如需指定端口：

```bash
node scripts/serve-review.mjs \
  --project /absolute/path/to/product-project \
  --port 4320
```

审阅页支持：

- 查看原图、脱敏图和最终标注图；
- 按状态筛选截图；
- 拖动单个箭头编号、目标框或脱敏区域；
- 精确修改坐标、宽度和高度；
- 单独通过或退回一个对象；
- 一次通过整张截图及其当前对象；
- 切换 all、risky、none 审阅模式。

局部修改只会使当前对象、所属截图及其依赖的衍生图片失效，不会清除同一截图中无关对象的已批准状态。

## 产物说明

Plugin 会在目标产品项目中创建独立工作区，不会写入原有 generate-miniprogram-user-manual 的目录。

```text
<product-project>/
├── .product-manual/
│   ├── config/
│   ├── history/
│   ├── automation/
│   ├── images/
│   │   ├── raw/
│   │   ├── redacted/
│   │   ├── redactions/
│   │   ├── annotations/
│   │   ├── annotated/
│   │   └── sequences/
│   ├── project-inventory.json
│   ├── capability-graph.json
│   ├── coverage.json
│   ├── capture-manifest.json
│   ├── review-state.json
│   ├── run-state.json
│   ├── evidence-log.jsonl
│   ├── test-data.json
│   └── database-evidence.json
├── .product-manual-plan/
│   ├── modules/
│   ├── business-nodes/
│   ├── operations/
│   ├── platform-variants/
│   ├── coverage.md
│   └── review-decisions.md
└── docs/product-manual/
    ├── index.md
    ├── wechat/
    │   ├── user-manual.md
    │   └── images/sequences/
    └── web/
        ├── user-manual.md
        └── images/sequences/
```

### .product-manual

内部运行状态与证据工作区，包括：

- 项目、模板、隐私、视觉和数据库配置；
- 源码扫描结果和 Capability Graph；
- 截图原图、脱敏图、标注图和对象 sidecar；
- 审阅状态、证据日志、数据库证据和历史记录。

该目录可能包含未发布证据和原始截图，不应直接作为公开文档目录提交。

### .product-manual-plan

结构化规划与审阅记录，包括：

- 功能模块和业务节点；
- Operation 与平台 Variant；
- 能力覆盖率；
- 范围、合并、排除和缺口处理记录。

### docs/product-manual

最终可发布的 Markdown 手册：

- index.md：平台公共索引；
- wechat/user-manual.md：微信小程序操作手册；
- web/user-manual.md：PC 网页操作手册；
- images/sequences：经过脱敏、标注和审阅的操作序列 PNG。

未启用的平台不会生成对应手册。

## 常用命令

生成或刷新覆盖率：

```bash
node scripts/render-coverage.mjs \
  --project /absolute/path/to/product-project
```

渲染 Markdown 手册：

```bash
node scripts/render-manual.mjs \
  --project /absolute/path/to/product-project
```

指定输出目录：

```bash
node scripts/render-manual.mjs \
  --project /absolute/path/to/product-project \
  --output /absolute/path/to/manual-output
```

执行严格发布校验：

```bash
node scripts/validate-publication.mjs \
  --project /absolute/path/to/product-project \
  --strict
```

运行自动化测试：

```bash
npm test
```

运行端到端自检：

```bash
npm run self-test
```

校验 Plugin 结构：

```bash
python3 /absolute/path/to/plugin-creator/scripts/validate_plugin.py \
  /absolute/path/to/product-manual-automation
```

## 注意事项

1. **源码不是业务流程证明。** 源码扫描只能发现候选入口、控件、接口和异常信息，最终手册应以已确认的业务含义和运行证据为准。

2. **数据库始终只读。** 即使 Plugin 拦截写 SQL，也应给数据库账号配置真实的只读权限。生产型数据库必须取得明确的二次授权。

3. **高影响操作默认停在安全边界。** 审批、支付、删除、撤销、提交、通知、上传等操作，除非用户明确授权，否则只验证到确认页或安全终点。

4. **不会自动发布微信代码。** Plugin 不会自行上传小程序、发布体验版、部署云函数或写入云数据库；这些动作必须作为独立任务明确授权。

5. **uni-app 编译产物必须可用且最新。** 运行时验证依赖微信开发者工具实际加载的 mp-weixin 目录。源码更新后应先重新编译。

6. **原始截图不可覆盖。** 修改标注或脱敏规则时，应重建衍生图片，不要直接编辑原图。

7. **凭据不得进入工作区。** Cookie、Token、Authorization Header、数据库密码、连接串和原始个人数据不得写入配置、日志或操作手册。

8. **审阅关闭会被记录。** 将模式设为 none 可以跳过人工审核，但这不等于截图天然准确或隐私安全。

9. **OCR 和视觉识别只是候选来源。** PaddleOCR、OmniParser 或视觉模型的定位结果必须结合置信度、确定性几何信息和审阅决策使用。

10. **远程 Agent 存在本地资源边界。** 远程 ChatGPT 或 Agent 无法天然访问本机微信开发者工具、浏览器登录态和内网数据库，需要本地或自托管执行节点。

11. **内部工作区不等于发布产物。** 对外发布通常只需要 docs/product-manual；是否提交 .product-manual 和 .product-manual-plan 应根据隐私与审计要求决定。

12. **部分隐私动作仍采用安全降级。** 当前版本对部分遮罩和文本替换使用实体遮罩兜底，整图排除需要同时更新发布规划；使用自定义动作后应在审阅页确认最终效果。

13. **当前版本不处理原生 PC 客户端和已有手册导入。** 如需支持，需要新增平台适配器或导入转换层。

## 测试与验证

当前版本已完成以下验证：

- 自动化测试全部通过；
- 端到端 self-test 通过严格发布校验；
- 5 个 Skills 通过结构校验；
- Plugin manifest 通过结构校验；
- npm 生产依赖审计无已知漏洞；
- 可视化审阅页完成交互验证；
- 局部标注更新不会使无关的已批准脱敏对象失效。

建议在提交代码前执行：

```bash
npm test
npm run self-test
npm audit --omit=dev
```

## 分发状态与规划

### 当前形态

当前目录采用 Codex 兼容布局：

```text
.codex-plugin/plugin.json
.mcp.json
skills/
```

内置 MCP Server 通过本地 stdio 启动，适合 Codex 本地开发、个人使用和团队内自托管分发。

### 发布到公共 Plugin 目录前

若未来要同时面向 Codex、ChatGPT、远程 Agent 或团队市场公开分发，还需要：

1. 将 MCP Server 部署为经过身份认证的 HTTPS streamable-http 服务；
2. 按 Agent Plugins 规范提供可移植的根目录 plugin.json 和 mcp.json；
3. 将本机数据库、文件系统和内网访问改造为明确的自托管连接模式；
4. 将本地截图审阅页升级为可远程使用的 MCP Apps UI 资源；
5. 补充公开的隐私政策、服务条款、支持渠道和发布者信息；
6. 完成安全、隐私和市场提交流程审核。

Web Playwright 可以迁移到远程执行器，但复用用户登录态的 ego-browser、本机微信开发者工具和内网数据库仍需要本地或自托管执行节点。

## 贡献与许可证

欢迎通过 Issue 或 Pull Request 提交改进建议，尤其包括：

- 新的平台适配器；
- 更可靠的标注候选来源；
- 新的 Markdown 模板；
- 数据库安全策略；
- 审阅体验和增量更新能力。

提交代码前请至少运行：

```bash
npm test
npm run self-test
```

当前仓库尚未包含 LICENSE 文件。正式开源前请根据预期使用方式选择并添加许可证；在许可证明确之前，默认版权规则仍然适用。
