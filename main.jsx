import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BSPoker from "./BSPoker.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BSPoker />
  </StrictMode>
);
