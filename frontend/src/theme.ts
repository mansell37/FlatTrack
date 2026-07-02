export type Theme = "dark" | "light";

const BG = { dark: "#0f1115", light: "#f4f6f9" };

export function getTheme(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme) || "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BG[t]);
  try {
    localStorage.setItem("theme", t);
  } catch {
    /* ignore */
  }
}
