# backend/Dockerfile — industry-value-flow FastAPI 后端
# 构建上下文:项目根(因为 pyproject.toml 在根)
# 部署位置:#1 /opt/services/industry-value-flow/ 下 docker compose build
#
# 镜像:python:3.12-slim(匹配 #1 Python 3.12)
# 入口:uvicorn main:app --host 0.0.0.0 --port 8000(在 /app/backend 下)
# 配置目录:由 IVF_CONFIG_DIR 环境变量注入(默认 /app/data/config)
#
# 模块路径说明:
#   - pyproject.toml 只打包 domain/(where=["backend"], include=["domain*"])
#   - main.py / routes/ / config.py / schema/ 不被打包
#   - 因此容器内 PYTHONPATH 必须包含 /app/backend,uvicorn 入口是 main:app
#   - 与本地开发一致(README: PYTHONPATH=. uvicorn main:app)

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 先拷 manifest 装依赖,利用层缓存
COPY pyproject.toml ./
COPY backend ./backend

# pip install -e .(只装 domain/ 等运行时包;pytest/respx 等 dev 依赖不进镜像)
RUN pip install --upgrade pip && \
    pip install -e .

# 把 backend/ 放入 PYTHONPATH(让 main.py 的 `from routes.xxx import` 工作)
ENV PYTHONPATH=/app/backend

# IVF_CONFIG_DIR 默认值(由 docker-compose 注入实际值)
ENV IVF_CONFIG_DIR=/app/data/config

EXPOSE 8000

# 健康检查:容器内 curl 自身 /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()" || exit 1

# 工作目录切到 /app/backend,这样 main:app 直接对应 main.py
WORKDIR /app/backend

# 入口:uvicorn 绑定 0.0.0.0(容器外可达),端口 8000
ENTRYPOINT ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
