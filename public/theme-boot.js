// Applies the stored theme before first paint. Mirrors src/themes/apply.ts.
(() => {
  var preference = "light";
  try {
    preference = localStorage.getItem("geodex.theme") || preference;
  } catch {}
  // 1.0 had three named themes; they map onto the two modes.
  var legacy = { atlas: "dark", minimal: "light", playful: "light" };
  if (legacy[preference]) preference = legacy[preference];
  if (["light", "dark", "auto"].indexOf(preference) < 0) preference = "light";
  var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = preference === "auto" ? (dark ? "dark" : "light") : preference;
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", theme === "dark" ? "#0c1316" : "#f7fbfc");
})();
