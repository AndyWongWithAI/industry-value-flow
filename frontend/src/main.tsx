import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { IndustryDetail } from "./pages/IndustryDetail";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/industry/:id" element={<IndustryDetail />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  );
}