# frontend/Dockerfile — industry-value-flow Vite/React 前端(多阶段)
#
# Stage 1 (builder):用 node:22-alpine 构建 → 产出 dist/
# Stage 2 (runtime):用 nginx:alpine serve dist,同时反代 /api/ 到 backend 容器
#
# 构建上下文:项目根 . (因为 package.json 在根目录 — monorepo 结构)
# dockerfile 路径:frontend/Dockerfile
# 部署位置:#1 /opt/services/industry-value-flow/ 下 docker compose build

# ===== Stage 1: build =====
FROM node:22-alpine AS builder

WORKDIR /build

# 根目录的 package.json + lockfile(利用 layer cache)
COPY package.json package-lock.json* ./
RUN npm ci

# 拷 frontend 源码 + 配置
COPY frontend/ ./frontend/

WORKDIR /build/frontend

# VITE_API_BASE 留空表示默认 /api(由 nginx 反代到 backend:8000)
RUN npm run build

# ===== Stage 2: nginx runtime =====
FROM nginx:alpine

# 删除默认 nginx 静态资源
RUN rm -rf /usr/share/nginx/html/*

# 拷构建产物
COPY --from=builder /build/frontend/dist /usr/share/nginx/html

# 拷自定义 nginx 配置(SPA fallback + /api 反代)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# nginx:alpine 镜像自带 HEALTHCHECK 不一定合适,这里用 curl / 兜底
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

# nginx 前台运行(官方镜像默认 CMD 已含,显式写明)
CMD ["nginx", "-g", "daemon off;"]
