import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GraphPage } from "./pages/GraphPage";
import { Settings } from "./pages/Settings";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GraphPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  );
}