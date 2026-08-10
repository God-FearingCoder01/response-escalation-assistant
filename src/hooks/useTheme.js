import { useState, useEffect } from "react";
import { THEME_KEY } from "../services/api";

export const THEMES = {
  night: {
    label: "Night mode",
    overlay:
      "radial-gradient(circle at top, rgba(76,211,76,0.12), transparent 40%),radial-gradient(circle at bottom right, rgba(15,155,0,0.12), transparent 35%),linear-gradient(180deg, #091009 0%, #040804 100%)",
    rootStyle: {
      "--app-bg": "#081008",
      "--app-text": "#f4f7f4",
      "--text-muted": "#c9c9d8",
      "--panel-bg": "rgba(11,19,11,0.85)",
      "--panel-border": "#32324a",
      "--panel-border-strong": "#4cd34c",
      "--field-bg": "#10111a",
      "--field-border": "#32324a",
      "--field-placeholder": "#7d7d93",
      "--neutral-bg": "#11111e",
      "--neutral-text": "#e1e1ee",
      "--badge-bg": "#11111e",
      "--badge-border": "#4a4a63",
      "--badge-text": "#c3c3d9",
      "--status-bg": "#141422",
      "--status-border": "#3a3a54",
      "--error-bg": "#231f16",
      "--error-border": "#6f5b2b",
      "--error-text": "#f2e8cf",
      "--panel-shadow": "0 12px 40px rgba(0,0,0,0.35)",
      "--header-border": "#2f2f46",
      "--header-bg": "rgba(11,19,11,0.85)",
      "--header-text": "#f3fff3",
      "--header-muted": "#c3d1c3",
      "--sidebar-bg": "rgba(8,16,8,0.95)",
    },
  },
  day: {
    label: "Day mode",
    overlay:
      "radial-gradient(circle at top, rgba(15,155,0,0.07), transparent 40%),radial-gradient(circle at bottom right, rgba(76,211,76,0.06), transparent 35%),linear-gradient(180deg, #f7f3ea 0%, #efeadf 100%)",
    rootStyle: {
      "--app-bg": "#f7f3ea",
      "--app-text": "#132013",
      "--text-muted": "#556255",
      "--panel-bg": "rgba(255,251,243,0.9)",
      "--panel-border": "#d7d0c3",
      "--panel-border-strong": "#0f9b00",
      "--field-bg": "#fffdf8",
      "--field-border": "#d7d0c3",
      "--field-placeholder": "#7c8377",
      "--neutral-bg": "#f4efe5",
      "--neutral-text": "#243024",
      "--badge-bg": "#f3ede1",
      "--badge-border": "#d2cabd",
      "--badge-text": "#3f493f",
      "--status-bg": "#f2f0e7",
      "--status-border": "#d2d2c5",
      "--error-bg": "#fff5df",
      "--error-border": "#d4be82",
      "--error-text": "#785d18",
      "--panel-shadow": "0 12px 40px rgba(0,0,0,0.08)",
      "--header-border": "#d7d0c3",
      "--header-bg": "rgba(255,251,243,0.9)",
      "--header-text": "#132013",
      "--header-muted": "#556255",
      "--sidebar-bg": "rgba(247,243,234,0.95)",
    },
  },
};

export function useTheme() {
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "night";
    return window.localStorage.getItem(THEME_KEY) || "night";
  });

  const themeConfig = THEMES[themeMode] || THEMES.night;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      Object.entries(themeConfig.rootStyle).forEach(([key, val]) => {
        root.style.setProperty(key, val);
      });
    }
  }, [themeConfig]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "night" ? "day" : "night"));
  };

  return {
    themeMode,
    setThemeMode,
    themeConfig,
    toggleTheme,
  };
}
