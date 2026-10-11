import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { setScrollLocked } from "../layout/scrollController";
import {
  Search,
  Home,
  Info,
  Calendar,
  BookOpen,
  Briefcase,
  Globe,
  Moon,
  Sun,
  ArrowRight,
  ShieldCheck,
  Newspaper,
  Mail,
  LayoutGrid,
  Gamepad2,
  X,
} from "lucide-react";
import "./QuickCommandPalette.css";

interface PaletteItem {
  id: string;
  titleEn: string;
  titleAr: string;
  keywords: string;
  icon: React.ReactNode;
  action: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const QuickCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const listId = `palette-list-${baseId}`;
  const titleId = `palette-title-${baseId}`;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const isAr = language === "ar";

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // اختصار الكيبورد (Ctrl+K / Cmd+K) — الغلق بالاختصار بيمر على close() نفسها
  // عشان البحث والمؤشر يترجّعوا لحالتهم الابتدائية في الفتح الجاي.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) close();
        else setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // قفل تمرير الصفحة + حفظ واسترجاع الفوكس
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Lenis بيقدّم موضع التمرير بنفسه، فـ body overflow لوحده مش كفاية —
    // من غير lenis.stop() الصفحة بتفضل بتتمرر خلف الطبقة الشفافة.
    setScrollLocked(true);
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      setScrollLocked(false);
      const target = previouslyFocused.current;
      if (target && typeof target.focus === "function" && document.contains(target)) {
        target.focus();
      }
    };
  }, [isOpen]);

  const items: PaletteItem[] = useMemo(
    () => [
      {
        id: "home",
        titleEn: "Home Page",
        titleAr: "الرئيسية",
        keywords: "home start index رئيسية",
        icon: <Home size={18} />,
        action: () => navigate("/"),
      },
      {
        id: "about",
        titleEn: "About Climatify & Team",
        titleAr: "من نحن والأعضاء المؤسسين",
        keywords: "about team founders من نحن الفريق",
        icon: <Info size={18} />,
        action: () => navigate("/about"),
      },
      {
        id: "programs",
        titleEn: "Programs & Services",
        titleAr: "البرامج والخدمات البيئية",
        keywords: "programs services برامج خدمات",
        icon: <Briefcase size={18} />,
        action: () => navigate("/programs"),
      },
      {
        id: "events",
        titleEn: "Climate Events & Hackathons",
        titleAr: "الفعاليات والهاكاثون المناخي",
        keywords: "events hackathon workshops فعاليات ورش",
        icon: <Calendar size={18} />,
        action: () => navigate("/events"),
      },
      {
        id: "learning",
        titleEn: "Learning Hub Academy",
        titleAr: "أكاديمية المساقات المناخية",
        keywords: "learning academy courses أكاديمية مساقات تعلم",
        icon: <BookOpen size={18} />,
        action: () => navigate("/learning-hub"),
      },
      {
        id: "media",
        titleEn: "Media Center & Blog",
        titleAr: "المركز الإعلامي والمدونة",
        keywords: "media blog news مدونة أخبار إعلام",
        icon: <Newspaper size={18} />,
        action: () => navigate("/media"),
      },
      {
        id: "games",
        titleEn: "Carbon Calculator & Games Hub",
        titleAr: "محاكي البصمة الكربونية والألعاب",
        keywords: "games carbon calculator ألعاب بصمة كربونية",
        icon: <Gamepad2 size={18} />,
        action: () => navigate("/games"),
      },
      {
        id: "opportunities",
        titleEn: "Careers & Volunteering",
        titleAr: "الفرص الوظيفية والتطوع",
        keywords: "careers jobs volunteering وظائف فرص تطوع",
        icon: <Briefcase size={18} />,
        action: () => navigate("/opportunities"),
      },
      {
        id: "partners",
        titleEn: "Our Partners",
        titleAr: "شركاؤنا",
        keywords: "partners partnership portals شركاء شراكة بوابات",
        icon: <LayoutGrid size={18} />,
        action: () => navigate("/partners"),
      },
      {
        id: "dashboard",
        titleEn: "My Dashboard",
        titleAr: "لوحتي الشخصية",
        keywords: "dashboard profile progress لوحة تقدم حسابي",
        icon: <LayoutGrid size={18} />,
        action: () => navigate("/dashboard"),
      },
      {
        id: "contact",
        titleEn: "Contact Us",
        titleAr: "تواصل معنا",
        keywords: "contact support email تواصل دعم",
        icon: <Mail size={18} />,
        action: () => navigate("/contact"),
      },
      {
        id: "admin",
        titleEn: "Admin CMS Portal",
        titleAr: "لوحة تحكم الأدمن",
        keywords: "admin cms panel أدمن تحكم",
        icon: <ShieldCheck size={18} />,
        action: () => navigate("/admin"),
      },
      {
        id: "theme",
        titleEn: theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode",
        titleAr: theme === "light" ? "التغيير للوضع الداكن" : "التغيير للوضع المضيء",
        keywords: "theme dark light mode وضع داكن مضيء ثيم",
        icon: theme === "light" ? <Moon size={18} /> : <Sun size={18} />,
        action: () => toggleTheme(),
      },
      {
        id: "lang",
        titleEn: isAr ? "Switch to English" : "Switch to Arabic",
        titleAr: isAr ? "التغيير للغة الإنجليزية" : "التغيير للغة العربية",
        keywords: "language english arabic لغة عربي انجليزي",
        icon: <Globe size={18} />,
        action: () => setLanguage(isAr ? "en" : "ar"),
      },
    ],
    [navigate, theme, toggleTheme, isAr, setLanguage]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.titleEn} ${item.titleAr} ${item.keywords}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  // أي تغيير في البحث بيرجّع المؤشر لأول نتيجة
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // خلي العنصر النشط ظاهر داخل القائمة
  useEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>('[data-active="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, filteredItems.length]);

  const runItem = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      item.action();
      close();
    },
    [close]
  );

  const trapTab = (e: React.KeyboardEvent) => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (filteredItems.length > 0) {
          setActiveIndex((prev) => (prev + 1) % filteredItems.length);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filteredItems.length > 0) {
          setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        }
        break;
      case "Home":
        if (filteredItems.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (filteredItems.length > 0) {
          e.preventDefault();
          setActiveIndex(filteredItems.length - 1);
        }
        break;
      case "Enter":
        // زرار العنصر نفسه بيتعامل مع Enter لوحده
        if (document.activeElement === inputRef.current) {
          e.preventDefault();
          runItem(filteredItems[activeIndex]);
        }
        break;
      case "Tab":
        trapTab(e);
        break;
      default:
        break;
    }
  };

  const activeItem = filteredItems[activeIndex];
  const activeDescendant = activeItem ? `${listId}-${activeItem.id}` : undefined;

  return (
    <>
      {/* الزرار العائم — من غيره مفيش طريقة تفتح البالِت على الموبايل */}
      <button
        type="button"
        className="palette-trigger-btn"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={isAr ? "فتح لوحة التنقل السريع" : "Open quick navigation palette"}
      >
        <Search size={16} aria-hidden="true" />
        <span className="palette-trigger-text">{isAr ? "بحث سريع" : "Quick search"}</span>
        <span className="palette-kbd" aria-hidden="true">
          Ctrl K
        </span>
      </button>

      {isOpen && (
        <div
          className="palette-overlay"
          data-lenis-prevent
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="palette-modal glass"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={handleModalKeyDown}
          >
            <h2 id={titleId} className="sr-only">
              {isAr ? "لوحة التنقل السريع" : "Quick navigation palette"}
            </h2>

            <div className="palette-search-box">
              <Search size={20} className="palette-search-icon" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                className="palette-input"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                {...(activeDescendant ? { "aria-activedescendant": activeDescendant } : {})}
                aria-label={isAr ? "ابحث عن صفحة أو أمر" : "Search for a page or command"}
                placeholder={
                  isAr
                    ? "اكتب للانتقال السريع للصفحات أو تغيير الإعدادات..."
                    : "Type to jump to any page or toggle settings..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className="palette-esc-kbd"
                onClick={close}
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X size={12} aria-hidden="true" />
                <span aria-hidden="true">ESC</span>
              </button>
            </div>

            <div className="palette-list" id={listId} role="listbox" ref={listRef}>
              {filteredItems.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  id={`${listId}-${item.id}`}
                  className={`palette-item ${index === activeIndex ? "active" : ""}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                >
                  <span className="palette-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="palette-item-title">{isAr ? item.titleAr : item.titleEn}</span>
                  <ArrowRight size={14} className="palette-item-arrow" aria-hidden="true" />
                </button>
              ))}

              {filteredItems.length === 0 && (
                <p className="palette-empty" role="status">
                  {isAr ? "لا توجد نتائج مطابقة" : "No matching results"}
                </p>
              )}
            </div>

            <div className="palette-footer">
              <span>{isAr ? "التنقل السريع في كلايمتيفاي" : "Climatify Quick Navigation"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
