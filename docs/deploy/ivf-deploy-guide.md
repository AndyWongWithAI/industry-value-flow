# industry-value-flow 部署指南

> 部署目标:**https://industry.intelab.cn/**
> 部署方式:GitHub Actions → SSH → Docker Compose
> 部署服务器:**#1 华为云 ECS** `124.71.219.208`
> 参考模式:`arch.intelab.cn`(`/opt/services/arch-platform/`)

## 1. 一次性准备(⚠️ 必须用户手动操作)

> 全部操作只在首次部署时需要,日常 `git push` 即可触发自动部署。

### 1.1 ⚠️ 阿里云 DNS 加 A 记录

| 主机记录 | 记录类型 | 记录值 |
|---|---|---|
| `industry` | A | `124.71.219.208` |
| `www.industry`(可选) | A | `124.71.219.208` |

- 域名服务商:阿里云(用户已知)
- 生效时间:5-30 分钟
- 验证:`dig industry.intelab.cn` 应返回 `124.71.219.208`

### 1.2 ⚠️ GitHub Actions Secrets 配置

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 加 2 个 secret:

| Name | Value | 说明 |
|---|---|---|
| `DEPLOY_HOST` | `root@124.71.219.208` | 部署目标,字面值 |
| `DEPLOY_SSH_KEY` | (私钥内容) | `#1` 上 `github-actions-deploy-arch-platform` 对应私钥 |

- 私钥获取:用户已有此密钥(用于 arch-platform 部署),复用同一把即可
- 路径参考:`~/.claude/memory/server-1.md` — "GH Actions deploy key"

### 1.3 ⚠️ 在 #1 服务器初始化部署目录

SSH 到 `#1` 执行一次:

```bash
ssh root@124.71.219.208
mkdir -p /opt/services/industry-value-flow
cd /opt/services/industry-value-flow

# 首次 clone(之后 GH Actions 用 git pull 同步)
git clone https://github.com/AndyWongWithAI/industry-value-flow.git .

# 创建 bind mount 数据目录(SQLite + settings.json)
mkdir -p data/db data/config

# 准备空 settings.json(用户后续在前端 /settings 页填 API Key)
# 格式参考 backend/config.py default_settings():
#   active_provider="claude", providers={}, daily_token_budget=100000
cat > data/config/settings.json <<'EOF'
{
  "active_provider": "claude",
  "providers": {},
  "daily_token_budget": 100000
}
EOF
chmod 600 data/config/settings.json

# 验证
ls -la
git log --oneline -3
```

### 1.4 ⚠️ 在 #1 配置 nginx 公网反代 + 签 SSL

#### 1.4.1 准备 nginx 配置

把以下内容保存到 `/opt/services/industry-value-flow/deploy/nginx-industry-intelab.conf`:

```nginx
# nginx-industry-intelab.conf — industry.intelab.cn 公网 HTTPS 反代
# 部署位置:/etc/nginx/sites-available/industry.intelab.cn
# SSL 由 certbot 申请并自动管理(Let's Encrypt)

# 1. HTTP → HTTPS + acme-challenge
server {
    listen 80;
    listen [::]:80;
    server_name industry.intelab.cn www.industry.intelab.cn;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS → frontend 容器(:8081,见 docker-compose.yml)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name industry.intelab.cn www.industry.intelab.cn;

    # SSL 由 certbot 自动注入(下面 placeholder,申请后会自动改)
    # ssl_certificate /etc/letsencrypt/live/industry.intelab.cn/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/industry.intelab.cn/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/industry-intelab.access.log;
    error_log  /var/log/nginx/industry-intelab.error.log warn;

    # 上传大小
    client_max_body_size 10M;

    # 反代 frontend 容器(127.0.0.1:8081,见 docker-compose.yml)
    location / {
        proxy_pass http://127.0.0.1:8081;

        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        proxy_connect_timeout 10s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # 健康检查 fast-path
    location = /health {
        proxy_pass http://127.0.0.1:8081/api/settings/llm;
        access_log off;
    }
}
```

#### 1.4.2 启用配置 + 签证书

参考 `arch.intelab.cn` 的 `install-public-nginx.sh` 脚本模式:

```bash
ssh root@124.71.219.208

# 1. 复制 + 启用
cp /opt/services/industry-value-flow/deploy/nginx-industry-intelab.conf /etc/nginx/sites-available/industry.intelab.cn
ln -sf /etc/nginx/sites-available/industry.intelab.cn /etc/nginx/sites-enabled/industry.intelab.cn

# 2. 准备 webroot(acme-challenge)
mkdir -p /var/www/letsencrypt

# 3. 用 dummy SSL 占位(让 nginx -t 通过)
DUMMY_DIR=/etc/nginx/ssl-dummy
mkdir -p "$DUMMY_DIR"
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$DUMMY_DIR/dummy.key" \
    -out "$DUMMY_DIR/dummy.crt" \
    -subj "/CN=industry.intelab.cn" 2>/dev/null

sed -i \
    -e "s|# ssl_certificate /etc/letsencrypt/live/industry.intelab.cn/fullchain.pem;|ssl_certificate $DUMMY_DIR/dummy.crt;|" \
    -e "s|# ssl_certificate_key /etc/letsencrypt/live/industry.intelab.cn/privkey.pem;|ssl_certificate_key $DUMMY_DIR/dummy.key;|" \
    /etc/nginx/sites-available/industry.intelab.cn

nginx -t
nginx -s reload || systemctl reload nginx

# 4. 验证 DNS 已生效(否则 certbot 会失败)
RESOLVED=$(dig +short industry.intelab.cn | head -1)
if [ "$RESOLVED" != "124.71.219.208" ]; then
    echo "ERROR: DNS 未生效,请先在阿里云加 A 记录"
    exit 1
fi

# 5. 签 SSL 证书
certbot certonly \
    --webroot \
    -w /var/www/letsencrypt \
    --non-interactive \
    --agree-tos \
    --email admin@intelab.cn \
    -d industry.intelab.cn \
    -d www.industry.intelab.cn

# 6. 切回真实证书
sed -i \
    -e "s|ssl_certificate $DUMMY_DIR/dummy.crt;|ssl_certificate /etc/letsencrypt/live/industry.intelab.cn/fullchain.pem;|" \
    -e "s|ssl_certificate_key $DUMMY_DIR/dummy.key;|ssl_certificate_key /etc/letsencrypt/live/industry.intelab.cn/privkey.pem;|" \
    -e 's|^    # include /etc/letsencrypt/options-ssl-nginx.conf;|    include /etc/letsencrypt/options-ssl-nginx.conf;|' \
    -e 's|^    # ssl_dhparam |    ssl_dhparam |' \
    /etc/nginx/sites-available/industry.intelab.cn

nginx -t
nginx -s reload || systemctl reload nginx

# 7. 验证
curl -fsS https://industry.intelab.cn/api/settings/llm
echo ""
echo "✅ 公网 HTTPS 已就绪"
```

### 1.5 配置 LLM API Key(首次部署后)

打开 `https://industry.intelab.cn/settings`,选 provider + 填 API Key + 保存。

后端会把 settings 写到 `data/config/settings.json`(容器 bind mount → `#1 /opt/services/industry-value-flow/data/config/settings.json`)。

---

## 2. 日常部署

```bash
# 本地开发 → 测试 → 提交 → 推送
git push origin master

# GitHub Actions 流程:
#   1. ci.yml: backend pytest + frontend vitest + e2e(全部 respx mock,无密钥)
#   2. 全部绿 → deploy.yml workflow_run 触发
#   3. SSH 到 #1 → git pull → docker compose up -d --build → 健康检查
#   4. 容器异常 → deploy job 失败 + Slack/邮件通知
```

无需任何手动操作。

---

## 3. 手动触发(workflow_dispatch)

```bash
# GitHub repo → Actions → Deploy → Run workflow → Run
# 或 gh CLI:
gh workflow run deploy.yml --ref master
```

---

## 4. 回滚

```bash
ssh root@124.71.219.208
cd /opt/services/industry-value-flow

# 查看历史
git log --oneline -10

# 回滚到指定 commit
git checkout <commit-sha>
docker compose up -d --build

# 或回到 master 最新
git checkout master
git pull origin master
docker compose up -d --build
```

> 注意:`git reset --hard` 会丢弃工作树未提交改动。回滚后如需保留 LLM 配置,确认 `data/config/settings.json` 未受影响(bind mount 不在 git 内,安全)。

---

## 5. 故障排查

### 5.1 容器起不来

```bash
ssh root@124.71.219.208
cd /opt/services/industry-value-flow

# 看实时日志
docker compose logs -f backend
docker compose logs -f frontend

# 看资源占用
docker stats

# 重启单个服务
docker compose restart backend
docker compose restart frontend
```

### 5.2 健康检查失败

```bash
# 在 #1 上手动 curl 验证
curl -fsS http://127.0.0.1:8081/api/settings/llm    # 走 frontend 容器
curl -fsS http://127.0.0.1:8081/health              # frontend 静态资源

# 检查容器内
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read())"
docker compose exec backend ls -la /app/data/config /app/data/db
docker compose exec backend cat /app/data/config/settings.json
```

### 5.3 端口冲突

```bash
# #1 nginx 已用 80 / 443,frontend 容器不能用 80
# 我们的方案:frontend 绑 127.0.0.1:8081,#1 nginx 反代到此端口
ss -tlnp | grep -E ':(80|443|8081|8088) '
```

### 5.4 DNS 未生效

```bash
dig industry.intelab.cn +short
# 应返回 124.71.219.208
# 否则:阿里云 DNS 控制台 → A 记录 → 等 5-30 分钟
```

### 5.5 SSL 证书过期

```bash
# certbot 自动续期(certbot.timer 已启用,通常无需手动)
certbot renew --dry-run

# 手动续期
certbot renew
nginx -s reload
```

### 5.6 完整重建

```bash
ssh root@124.71.219.208
cd /opt/services/industry-value-flow

# 停所有 + 删镜像(保留 data/ bind mount)
docker compose down
docker image prune -af

# 重新拉代码 + 构建
git pull origin master
docker compose up -d --build

# 验证
docker compose ps
curl -fsS http://127.0.0.1:8081/api/settings/llm
```

---

## 6. 关键端口约定

| 端口 | 用途 | 监听者 |
|---|---|---|
| `#1 :80` | 公网 HTTP(→ 301 HTTPS) | `#1 nginx` |
| `#1 :443` | 公网 HTTPS | `#1 nginx` |
| `127.0.0.1:8081` | frontend 容器反代入口 | frontend 容器(nginx:alpine) |
| `backend:8000`(容器内) | FastAPI backend | backend 容器(uvicorn) |

> **不要让 frontend 容器直接绑 `0.0.0.0:80`**,那会和 `#1 nginx` 抢端口。

---

## 7. 与 arch-platform 部署模式的差异

| 维度 | arch-platform | industry-value-flow |
|---|---|---|
| 端口 | `127.0.0.1:8088` | `127.0.0.1:8081` |
| 服务数 | 1(单体) | 2(backend + frontend) |
| 反代路径 | `/` → backend | `/api/` → backend(SPA 走 frontend) |
| 数据持久化 | `./data` + `./backups` | `./data/db` + `./data/config` |
| systemd 服务 | `arch-platform.service`(已注册) | **暂未注册**(compose 跑就行,见后续 TODO) |

> **TODO**(后续优化):写 `industry-value-flow.service` 跟 arch-platform 一致;当前 `restart: unless-stopped` 已能保证容器异常自启,只是不跟 server reboot 联动。

---

## 8. 文件清单(本次交付)

| 文件 | 作用 |
|---|---|
| `backend/Dockerfile` | FastAPI 镜像(python:3.12-slim + pip install -e .) |
| `frontend/Dockerfile` | 多阶段(node:22-alpine build → nginx:alpine serve) |
| `frontend/nginx.conf` | SPA fallback + `/api/` → backend 反代 |
| `docker-compose.yml` | 编排:backend(不暴露端口)+ frontend(:8081) |
| `.dockerignore` | 排除 .git / node_modules / tests / docs |
| `.github/workflows/deploy.yml` | GH Actions 自动部署(workflow_run + SSH) |
| `docs/deploy/ivf-deploy-guide.md` | 本文档 |
| `docs/deploy/arch-feedback.md` | 给架构平台登记的反馈 |
