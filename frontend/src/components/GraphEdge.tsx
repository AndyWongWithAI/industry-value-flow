import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow";
import type { NodeStatus, RelationType } from "../types/api";

/** 自定义 react-flow 边数据 */
export interface GraphEdgeData extends Record<string, unknown> {
  relation_type: RelationType;
  weight: number;
  explanation: string;
  status: NodeStatus;
  failed_reason?: string | null;
}

/** v2 收敛(2026-06-25):关系类型简化为单向 supports,使用单一企业蓝。 */
const RELATION_COLOR = "#1A4D8F";   // 支撑 — 企业蓝(主)

/** v2:唯一关系类型 supports 的中文标签 */
const RELATION_LABEL = "支撑";

/** 失败边颜色(spec §4.4.4) */
const FAILED_EDGE_COLOR = "#DC2626";

/**
 * 自定义 react-flow 边组件:
 * - 按 relation_type 颜色 + 关系中文标签
 * - strokeWidth = weight(1-5px)
 * - 失败边用红色 + 虚线(5,5)
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
  const label = RELATION_LABEL;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isFailed ? FAILED_EDGE_COLOR : color,
          strokeWidth: data?.weight ?? 1,
          strokeDasharray: isFailed ? "5,5" : "none",
          opacity: 0.8,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
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
            title={
              isFailed
                ? `生成失败: ${data?.failed_reason ?? "未知原因"}`
                : data?.explanation
            }
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
