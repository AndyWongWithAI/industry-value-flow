import type { SankeyData } from "../types/api";

interface FooterProps {
  data: SankeyData;
  testId?: string;
}

/**
 * 数据来源 footer:展示 source / year / unit + 可点击 source_url 链接。
 * 主桑基图 + 详情页共用,统一管控避免重复代码。
 */
export function Footer({ data, testId = "data-footer" }: FooterProps) {
  return (
    <footer
      data-testid={testId}
      style={{ marginTop: 16, fontSize: 12, color: "#666" }}
    >
      数据来源:{data.source ?? "占位数据"} · 年度:{data.year ?? "—"} · 单位:
      {data.unit ?? "亿元"}
      {data.source_url && (
        <>
          {" · "}
          <a
            href={data.source_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="source-url-link"
          >
            查看原始数据 →
          </a>
        </>
      )}
    </footer>
  );
}