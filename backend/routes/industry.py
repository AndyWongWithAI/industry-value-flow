"""T1 后 /api/industry/{id} 端点已废弃.

业务接口将由 T4 的 /api/node/{id} + /api/edge/... 取代.
此处保留空 router 占位,避免 main.py import 失败.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["industry"])