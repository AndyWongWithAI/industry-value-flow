"""LLM 配置 + 生成 endpoint.

T1: 旧 /api/llm/generate 痛点生成端点已废弃(pain point + AI help 概念废除).
    T6 会替换为新的知识图谱相关 endpoint. 此处保留空 router 占位 + LLM provider
    配置(/api/llm/* 中的设置类)暂时仅暴露注册但不挂业务路由 — 等 T6 重写.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/llm", tags=["llm"])