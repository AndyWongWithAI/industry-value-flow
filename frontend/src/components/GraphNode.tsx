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
}

/** 失败节点边框色(spec §4.4.4) */
const FAILED_BORDER_COLOR = "#DC2626";

/**
 * 自定义 react-flow 节点组件:
 * - 白底 + 大类配色边框
 * - 显示 label + category 单字母
 * - 失败节点红色边框 + hover tooltip 显示 failed_reason
 */
export function GraphNode({ data }: NodeProps<GraphNodeData>) {
  const color = getCategoryColor(data.category);
  const isFailed = data.status === "failed";

  return (
    <div
      data-testid={`graph-node-${data.label}`}
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
