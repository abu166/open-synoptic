import { apiLanguage, setLanguage } from "./i18n/locale";
import { DataServiceError } from "./api/openMeteoClient";
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./cinematic.css";
import "maplibre-gl/dist/maplibre-gl.css";
setLanguage(apiLanguage());
const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        count < 1 &&
        !(error instanceof DataServiceError && error.status === 429),
      refetchOnWindowFocus: false,
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // Offline shell is optional; provider caches and saved plans still work.
      });
  });
}
