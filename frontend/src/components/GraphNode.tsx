import { Handle, Position, type NodeProps } from "reactflow";
import { getCategoryColor } from "../lib/gbt4754-colors";
import type { Category, NodeStatus } from "../types/api";

/** 自定义 react-flow 节点数据 */
export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  category: Category;
  description: string;
  status: NodeStatus;
  failed_reason?: string | null;
  // v5:缩放自适应(由 GraphView 通过 data 注入)
  zoom?: number;
  zoomLabelMin?: number;
  zoomFullMin?: number;
}

/** 失败节点边框色(spec §4.4.4) */
const FAILED_BORDER_COLOR = "#DC2626";

/** 默认阈值(GraphView 注入失败时兜底) */
const DEFAULT_LABEL_MIN = 0.4;
const DEFAULT_FULL_MIN = 0.8;

/**
 * 自定义 react-flow 节点组件(v5 缩放自适应):
 * - 白底 + 大类配色边框
 * - 显示 label + category 单字母
 * - 失败节点红色边框 + hover tooltip 显示 failed_reason
 * - v5 缩放分级:
 *   zoom < labelMin   → 只显示 8px 色点(无文字、无 border)
 *   labelMin <= zoom < fullMin → 显示 label + category,无 boxShadow
 *   zoom >= fullMin    → 完整:label + category + 失败红框 + boxShadow
 */
export function GraphNode({ data }: NodeProps<GraphNodeData>) {
  const color = getCategoryColor(data.category);
  const isFailed = data.status === "failed";

  const zoom = typeof data.zoom === "number" ? data.zoom : 1;
  const labelMin = typeof data.zoomLabelMin === "number" ? data.zoomLabelMin : DEFAULT_LABEL_MIN;
  const fullMin = typeof data.zoomFullMin === "number" ? data.zoomFullMin : DEFAULT_FULL_MIN;

  // 缩远:只显示色点
  if (zoom < labelMin) {
    return (
      <div
        data-testid={`graph-node-${data.label}`}
        data-zoom-level="dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isFailed ? FAILED_BORDER_COLOR : color,
          // 失败状态在极缩放下不加边框,只用颜色区分(spec §4.4.4 视觉保留)
        }}
        title={
          isFailed
            ? `生成失败: ${data.failed_reason ?? "未知原因"}\n\n${data.description}`
            : data.description
        }
      >
        <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
      </div>
    );
  }

  // 中缩放:显示 label,弱化 border
  if (zoom < fullMin) {
    return (
      <div
        data-testid={`graph-node-${data.label}`}
        data-zoom-level="label"
        style={{
          background: "#FFFFFF",
          border: `1px solid ${isFailed ? FAILED_BORDER_COLOR : color}`,
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "#1A1A1A",
          minWidth: 80,
          boxShadow: "none",
        }}
        title={
          isFailed
            ? `生成失败: ${data.failed_reason ?? "未知原因"}\n\n${data.description}`
            : data.description
        }
      >
        <Handle type="target" position={Position.Left} style={{ background: "#999" }} />
        <div style={{ fontWeight: 600 }}>{data.label}</div>
        <Handle type="source" position={Position.Right} style={{ background: "#999" }} />
      </div>
    );
  }

  // 全缩放:完整显示
  return (
    <div
      data-testid={`graph-node-${data.label}`}
      data-zoom-level="full"
      style={{
        background: "#FFFFFF",
        border: `2px solid ${isFailed ? FAILED_BORDER_COLOR : color}`,
        borderRadius: 8,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: "#1A1A1A",
        minWidth: 120,
        boxShadow: isFailed
          ? "0 0 0 1px #DC2626"
          : "0 1px 3px rgba(0,0,0,0.08)",
      }}
      title={
        isFailed
          ? `生成失败: ${data.failed_reason ?? "未知原因"}\n\n${data.description}`
          : data.description
      }
    >
      <Handle type="target" position={Position.Left} style={{ background: "#999" }} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{data.category}</div>
      <Handle type="source" position={Position.Right} style={{ background: "#999" }} />
    </div>
  );
}