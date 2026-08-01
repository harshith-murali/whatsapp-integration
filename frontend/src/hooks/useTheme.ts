import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "color-theme";

const getPreferredTheme = (): Theme => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return getPreferredTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return {
    isDark: theme === "dark",
    theme,
    toggleTheme,
  };
};
