import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/tokens.css";
import "./index.css";
import { initAnalytics } from "./lib/analytics.ts";
import { registerServiceWorker } from "./lib/registerServiceWorker.ts";

initAnalytics();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
