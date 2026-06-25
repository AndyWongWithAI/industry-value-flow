// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { CATEGORY_COLORS, getCategoryColor } from "../lib/gbt4754-colors";
import type { Category } from "../types/api";

describe("gbt4754-colors", () => {
  it("getCategoryColor('A') returns green hex", () => {
    const color = getCategoryColor("A");
    // 农业大类应为绿色
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // 绿色调:R > G > B(简化判断)
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    expect(g).toBeGreaterThan(b);
  });

  it("all 20 categories return non-empty colors", () => {
    // GB/T 4754 大类 A-T 共 20 个
    const allCategories: Category[] = [
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
      "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    ];
    for (const cat of allCategories) {
      const color = getCategoryColor(cat);
      expect(color, `Category ${cat} should have a color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color).not.toBe("#000000");
      expect(color).not.toBe("#FFFFFF");
    }
  });

  it("CATEGORY_COLORS contains 20 entries", () => {
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(20);
  });

  it("returns a fallback color for unknown category", () => {
    // 即使传入 unknown 类型(TS 会拦截,但运行时仍可能触发)
    const color = getCategoryColor("X" as unknown as Category);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("all colors are unique (no duplicates across categories)", () => {
    const colors = Object.values(CATEGORY_COLORS);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});
