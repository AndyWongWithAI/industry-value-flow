import type { Category } from "../types/api";

/**
 * GB/T 4754 大类配色(20 大类,每类 1 色,明色系企业风)
 *
 * 设计原则(spec §8.2):
 * - 饱和度适中(50-65%),亮度 50-60%
 * - 20 色相 HSL 等距分布,辨识度高
 * - 失败节点用 #DC2626(spec §4.4),失败边用 #DC2626 虚线
 * - 关系类型颜色在 GraphEdge.tsx 内独立定义(避免与节点色撞)
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  A: "#5C9E5C",  // 农、林、牧、渔业 — 草绿
  B: "#8B6F47",  // 采矿业 — 棕色
  C: "#4A6FA5",  // 制造业 — 企业蓝
  D: "#D97757",  // 电力热力 — 紫红/橘红
  E: "#9B6B9E",  // 建筑业 — 紫色
  F: "#C49A4A",  // 批发零售 — 金色
  G: "#5B8A8A",  // 交通运输 — 青绿
  H: "#B85C5C",  // 住宿餐饮 — 红
  I: "#3D5A80",  // 信息传输 — 深蓝
  J: "#2D6E4E",  // 金融业 — 深绿
  K: "#A8765C",  // 房地产 — 棕褐
  L: "#7A8B99",  // 租赁商务 — 灰蓝
  M: "#6B7F3F",  // 科研技术 — 橄榄
  N: "#4F9B8E",  // 水利环境 — 蓝绿
  O: "#A85C8B",  // 居民服务 — 紫红
  P: "#5C7FB8",  // 教育 — 蓝紫
  Q: "#C75A5A",  // 卫生 — 红
  R: "#9C5BC9",  // 文化体育 — 紫
  S: "#6B6B6B",  // 公共管理 — 灰
  T: "#4A4A4A",  // 国际组织 — 深灰
};

const FALLBACK_COLOR = "#999999";

/**
 * 获取某 GB/T 4754 大类对应的配色。
 * 未知 category 返回灰色 fallback(用于运行时防御,不应当作合法输入)。
 */
export function getCategoryColor(category: Category): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}
