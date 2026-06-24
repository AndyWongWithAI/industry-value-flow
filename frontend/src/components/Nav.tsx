import { Link, useLocation } from "react-router-dom";

export function Nav() {
  const { pathname } = useLocation();
  const linkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? "#4a90e2" : "#666",
    textDecoration: "none",
    fontWeight: active ? "bold" : "normal",
    marginRight: 16,
  });
  return (
    <nav
      style={{
        padding: "12px 24px",
        borderBottom: "1px solid #e0e0e0",
        background: "#fafafa",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Link to="/" style={linkStyle(pathname === "/")}>
        首页
      </Link>
      <Link to="/settings" style={linkStyle(pathname === "/settings")}>
        ⚙️ LLM 设置
      </Link>
      {pathname.startsWith("/industry/") && (
        <Link to="/" style={linkStyle(false)}>
          ← 返回行业列表
        </Link>
      )}
    </nav>
  );
}
