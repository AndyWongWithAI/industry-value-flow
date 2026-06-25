import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow";
import type { NodeStatus, RelationType } from "../types/api";

/** 自定义 react-flow 边数据 */
export interface GraphEdgeData extends Record<string, unknown> {
  relation_type: RelationType;
  weight: number;
  explanation: string;
  status: NodeStatus;
  failed_reason?: string | null;
  // v5:缩放自适应(由 GraphView 通过 data 注入)
  zoom?: number;
  zoomLineMin?: number;
  zoomDetailMin?: number;
}

/** v2 收敛(2026-06-25):关系类型简化为单向 supports,使用单一企业蓝。 */
const RELATION_COLOR = "#1A4D8F";   // 支撑 — 企业蓝(主)

/** v2:唯一关系类型 supports 的中文标签 */
const RELATION_LABEL = "支撑";

/** 失败边颜色(spec §4.4.4) */
const FAILED_EDGE_COLOR = "#DC2626";

/** 默认阈值(GraphView 注入失败时兜底) */
const DEFAULT_LINE_MIN = 0.5;
const DEFAULT_DETAIL_MIN = 1.0;

/**
 * 自定义 react-flow 边组件(v5 缩放自适应 + 方向箭头 + hover tooltip):
 * - 按 relation_type 颜色 + 关系中文标签
 * - strokeWidth = weight(1-5px)
 * - 失败边用红色 + 虚线(5,5)
 * - v5 缩放分级:
 *   zoom < lineMin   → 不渲染(线透明)
 *   lineMin <= zoom < detailMin → 显示线 + 箭头,无 label
 *   zoom >= detailMin → 显示线 + label + 箭头 + hover tooltip 显示 explanation
 * - hover 时显示 explanation tooltip(白底圆角,贴近鼠标位置)
 */
export function GraphEdge(props: EdgeProps<GraphEdgeData>) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isFailed = data?.status === "failed";
  const color = RELATION_COLOR;

  const zoom = typeof data?.zoom === "number" ? data.zoom : 1;
  const lineMin = typeof data?.zoomLineMin === "number" ? data.zoomLineMin : DEFAULT_LINE_MIN;
  const detailMin = typeof data?.zoomDetailMin === "number" ? data.zoomDetailMin : DEFAULT_DETAIL_MIN;

  const showLine = zoom >= lineMin;
  const showDetail = zoom >= detailMin;

  const [hovered, setHovered] = useState(false);

  // 缩远到一定程度:完全不渲染(连 path 都不画,省 GPU)
  if (!showLine) {
    return null;
  }

  const tooltipText = isFailed
    ? `生成失败: ${data?.failed_reason ?? "未知原因"}`
    : data?.explanation ?? "";

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={showDetail ? markerEnd : undefined}
        style={{
          stroke: isFailed ? FAILED_EDGE_COLOR : color,
          strokeWidth: data?.weight ?? 1,
          strokeDasharray: isFailed ? "5,5" : "none",
          opacity: 0.8,
          cursor: showDetail ? "pointer" : "default",
        }}
      />
      {/* 透明热区:放大且 hover 时,捕获鼠标以显示 tooltip */}
      {showDetail && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(12, (data?.weight ?? 1) + 8)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ pointerEvents: "stroke" }}
        />
      )}
      {showDetail && (
        <EdgeLabelRenderer>
          <div
            data-testid={`edge-label-${data?.relation_type ?? "edge"}`}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#FFFFFF",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              color: isFailed ? FAILED_EDGE_COLOR : color,
              border: `1px solid ${isFailed ? FAILED_EDGE_COLOR : color}`,
              pointerEvents: "all",
            }}
            title={tooltipText}
          >
            {RELATION_LABEL}
          </div>
          {hovered && tooltipText && (
            <div
              data-testid="edge-tooltip"
              style={{
                position: "absolute",
                transform: `translate(-50%, calc(-100% - 16px)) translate(${labelX}px, ${labelY}px)`,
                background: "#1A1A1A",
                color: "#FFFFFF",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.4,
                maxWidth: 280,
                pointerEvents: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 1000,
                whiteSpace: "normal",
              }}
            >
              {tooltipText}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}