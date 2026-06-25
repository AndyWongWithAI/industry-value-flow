# 架构平台反馈:industry-value-flow 部署模板

> 用户后续手动登记到 https://arch.intelab.cn 的内容(架构平台登记项)。
> 登记位置:组件 → feedback → 新建 feedback。
> 涉及资产:`arch-platform-deploy-template`(sibling 模板,见 §5)

---

## 1. 资产定位

**名称**:`industry-value-flow-deploy-template`
**类型**:部署模板(Deployment Template)
**定位**:单 FastAPI 后端 + Vite/React 前端 + SQLite/JSON config 状态 + HTTPS 域名 的全栈部署方案
**所属层级**:Infrastructure(部署层资产,与 `arch-platform-deploy-template` 同级)

---

## 2. 适用场景

满足以下 **全部** 条件的项目可复用本模板:

- 后端:Python + FastAPI(或类似 ASGI 框架)+ SQLite + LLM(可选)
- 前端:Node + Vite + React(SPA,带 client-side routing)
- 状态:单实例 + 文件状态(SQLite / JSON 配置)
- 网络:需要公网 HTTPS 域名(Let's Encrypt)
- 部署规模:轻量(< 1G 内存,单机单实例)

**不适用**:

- 多实例 + 共享存储(需要外接 DB / Redis)
- SSR / Next.js(部署模型不同)
- 非 HTTPS(本模板假设有域名 + certbot)

---

## 3. 关键参数(可复用变量)

| 参数 | 默认值 | 说明 |
|---|---|---|
| `domain` | `industry.intelab.cn` | 公网域名 |
| `deploy_path` | `/opt/services/industry-value-flow` | 服务器部署目录 |
| `frontend_proxy_port` | `8081` | frontend 容器绑定的 `#1` 端口(避免与 nginx :80 冲突) |
| `backend_internal_port` | `8000` | backend 容器内部端口(不暴露,只 frontend 反代) |
| `data_subdirs` | `["data/db", "data/config"]` | bind mount 子目录(SQLite + settings.json) |
| `config_dir_env` | `IVF_CONFIG_DIR=/app/data/config` | 后端读取配置的环境变量约定 |
| `spa_fallback` | `true` | nginx 必须配置 SPA fallback(`try_files $uri /index.html`) |
| `api_proxy_path` | `/api/` | frontend nginx 反代后端的路径前缀 |

---

## 4. 部署目录布局(参考)

```
/opt/services/industry-value-flow/
├── docker-compose.yml          # 2 服务:backend + frontend
├── backend/
│   └── Dockerfile              # python:3.12-slim + pip install -e .
├── frontend/
│   ├── Dockerfile              # 多阶段:node:22-alpine → nginx:alpine
│   └── nginx.conf              # SPA fallback + /api/ 反代
├── deploy/
│   └── nginx-industry-intelab.conf  # #1 公网反代配置
├── data/                       # bind mount(.gitignore,不入 git)
│   ├── db/cache.db
│   └── config/settings.json
└── .git/                       # GH Actions git pull 用的本地仓库
```

---

## 5. 与 arch-platform-deploy-template 的关系

| 维度 | arch-platform-deploy-template | industry-value-flow-deploy-template |
|---|---|---|
| 服务数 | 1(单体) | 2(backend + frontend) |
| 公网端口 | `8088` | `8081` |
| 反代路径 | `/` → backend | `/api/` → backend(SPA 由 frontend 提供) |
| 数据持久化 | `./data` + `./backups` | `./data/db` + `./data/config` |
| systemd | 已注册 | TODO(当前用 compose restart policy) |
| SSL | certbot webroot | certbot webroot(同模式) |
| GH Actions | reusable workflow | 直接 workflow_run 触发 |

**结论**:`industry-value-flow-deploy-template` 是 `arch-platform-deploy-template` 的 **多服务扩展版**,核心资产(Nginx 反代 / certbot 流程 / SSH 部署脚本 / systemd 模式)可下沉到 `deploy-template-base`(待立项)。

---

## 6. 复用建议

1. **新项目是单 FastAPI + Vite + SQLite**:直接复用本模板,改 `domain` / `deploy_path` / `frontend_proxy_port`
2. **新项目是单 FastAPI + Vite + 外接 DB**:复用本模板结构,把 bind mount 换成 DB connection string(env_file)
3. **新项目是 SSR / Next.js**:不复用,等 `nextjs-deploy-template`(暂不存在)
4. **新项目是多服务微服务**:不复用,等 `microservice-deploy-template`(用 traefik + docker network)

---

## 7. 已知问题 / 后续 TODO

- [ ] TODO:写 `industry-value-flow.service` 跟 arch-platform 一致(当前只靠 compose `restart: unless-stopped`)
- [ ] TODO:加 systemd timer 做每日 SQLite `.backup`(参考 `arch-platform/backup.sh`)
- [ ] TODO:加 Prometheus metrics endpoint(`/metrics`)+ #1 Prometheus 抓取
- [ ] 已知:frontend 容器强依赖 backend 健康(`depends_on: condition: service_healthy`),如 backend 配置错误启动失败,frontend 也起不来;这是设计,避免给用户展示空容器但 API 502

---

## 8. 反馈登记(用户手动)

登记到 https://arch.intelab.cn 的具体命令(用户后续执行):

```bash
# 用 arch CLI 登记(参考 arch-platform/usage.md)
arch feedback new \
  --component industry-value-flow-deploy-template \
  --type deployment-template \
  --related arch-platform-deploy-template \
  --severity info \
  --summary "新增 industry-value-flow 部署模板:FastAPI + Vite 多服务版" \
  --content "$(cat docs/deploy/arch-feedback.md)"
```
