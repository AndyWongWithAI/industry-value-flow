# frontend/Dockerfile — industry-value-flow Vite/React 前端(多阶段)
#
# Stage 1 (builder):用 node:22-alpine 构建 → 产出 frontend/dist/
# Stage 2 (runtime):用 nginx:alpine serve dist,同时反代 /api/ 到 backend 容器
#
# 构建上下文:frontend/(只 frontend/ 下的文件需要)
# 部署位置:#1 /opt/services/industry-value-flow/ 下 docker compose build

# ===== Stage 1: build =====
FROM node:22-alpine AS builder

WORKDIR /app

# 先拷 manifest,利用 npm ci 层缓存
COPY package.json package-lock.json* ./

# npm ci(lockfile 必须存在;若 lockfile 缺失回退到 npm install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 拷源码 + 构建
COPY . .

# VITE_API_BASE 留空表示默认 /api(由 nginx 反代到 backend:8000)
# 生产构建不需要 .env(若需要运行时变量,前端需在构建期 bake-in)
RUN npm run build

# ===== Stage 2: nginx runtime =====
FROM nginx:alpine

# 删除默认 nginx 静态资源
RUN rm -rf /usr/share/nginx/html/*

# 拷构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 拷自定义 nginx 配置(SPA fallback + /api 反代)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# nginx:alpine 镜像自带 HEALTHCHECK 不一定合适,这里用 curl / 兜底
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

# nginx 前台运行(官方镜像默认 CMD 已含,显式写明)
CMD ["nginx", "-g", "daemon off;"]
