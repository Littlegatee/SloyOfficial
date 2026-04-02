import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { I18nProvider } from "./i18n/I18nContext";
import { setupGlobalErrorHandlers } from "./lib/monitoring";
import { runLocalStorageCacheMaintenance } from "./lib/localStorageCache";

setupGlobalErrorHandlers();
runLocalStorageCacheMaintenance();

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("SW registration failed:", error);
    });
  });
}
