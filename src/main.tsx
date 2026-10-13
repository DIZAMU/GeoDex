import "./app/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { db } from "./db/db";
import { ensureDeviceSettings, ensureSettings, requestPersistentStorage } from "./db/settings";
import { initI18n, initialLocale } from "./i18n";

const locale = initialLocale();
initI18n(locale);
void ensureDeviceSettings(db);
void ensureSettings(db, locale);
void requestPersistentStorage(db);

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
