import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextProps {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "climatify-theme";

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

/**
 * قراءة آمنة من localStorage.
 * الوصول إلى localStorage يرمي استثناءً (SecurityError) في وضع Safari الخاص
 * وعند حجب الكوكيز/التخزين، وكان ذلك يُسقط التطبيق كله لشاشة بيضاء لأن
 * القراءة كانت تحدث داخل مُهيّئ useState في مرحلة الرسم.
 */
const readStoredTheme = (): Theme | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

/** لون شريط المتصفح على الجوال — القيم مطابقة لـ --bg في variables.css. */
const THEME_COLORS: Record<Theme, string> = {
  light: "#F7FAFC",
  dark: "#0A1018",
};

const readSystemTheme = (): Theme => {
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch {
    /* matchMedia غير متاح — نرجع للافتراضي */
  }
  return "light";
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // هل اختار المستخدم مظهراً بنفسه؟ لو لا، نتابع تفضيل النظام.
  const [hasExplicitChoice, setHasExplicitChoice] = useState<boolean>(() => readStoredTheme() !== null);

  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? readSystemTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // يساعد المتصفح على تلوين عناصر واجهته الأصلية (شرائط التمرير، الحقول)
    root.style.colorScheme = theme;

    // نتابع المظهر المختار فعلاً، لا تفضيل النظام فقط.
    const meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", THEME_COLORS[theme]);

    try {
      if (hasExplicitChoice) {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      /* الكتابة محجوبة — المظهر يعمل لهذه الجلسة فقط */
    }
  }, [theme, hasExplicitChoice]);

  // نتابع تفضيل نظام التشغيل ما لم يكن المستخدم قد اختار صراحةً.
  useEffect(() => {
    if (hasExplicitChoice) return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [hasExplicitChoice]);

  const setTheme = useCallback((next: Theme) => {
    setHasExplicitChoice(true);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setHasExplicitChoice(true);
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo<ThemeContextProps>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
