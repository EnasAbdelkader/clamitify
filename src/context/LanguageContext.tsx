import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ar";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    home: "Home",
    about: "About Us",
    programs: "Programs",
    initiatives: "Initiatives",
    events: "Events",
    learningHub: "Academy",
    gamesHub: "Games Hub",
    community: "Community",
    opportunities: "Careers",
    contact: "Contact",
    media: "Media Center",
    partners: "Partners",
    login: "Login",
    register: "Register",
    dashboard: "Dashboard",
    adminDashboard: "Admin CMS",
    joinMovement: "Join Movement",

    // General text
    keepGoing: "Keep Going",
    learnMore: "Learn More",
    forBetterFuture: "For a Better Future",
    heroTitlePart1: "From youth to youth,",
    heroTitlePart2: "we unite efforts and create solutions",
    heroTitlePart3: "and move toward a more sustainable future.",
    heroSub: "Climatify is a UAE-based startup that unites climate digitization with the empowerment of local, regional, and international communities — turning awareness into real impact.",

    // Impact (verified organizational figures)
    impactYouthValue: "25,000+",
    impactYouthLabel: "Youth reached",
    impactEmpoweredValue: "1,000+",
    impactEmpoweredLabel: "People empowered across the region",
    impactOpportunitiesValue: "200+",
    impactOpportunitiesLabel: "Volunteering & training opportunities provided",

    // Mission Page
    missionTitle: "What is Climatify?",
    missionText1: "Climatify is a UAE-based startup that brings together climate digitization and the development of local, regional, and international communities. Its projects aim to raise awareness of environmental challenges and the importance of the UAE's national strategies, while strengthening community participation and empowering youth and women to contribute to sustainability.",
    missionText2: "From schools to international conferences, we believe a better future is something we build together — from youth to youth.",
    vision: "Vision",
    visionText: "Unifying global climate-action efforts through climate digitization, and empowering youth to participate actively in shaping sustainable solutions around the world.",
    mission: "Mission",
    missionText: "Merging climate digitization with community empowerment, environmental awareness, and sustainable development through technology and effective participation — building a harmonious future for people.",
    focusAreas: "Focus Areas",
    focusAreasText: "Digitization & digital transformation, environmental awareness, youth and women empowerment, interactive workshops and camps, educational programs, and environmental dimensions.",

    // Footer
    footerTagline: "Bridging Borders, Cultures, and Generations through Climate Solutions.",
    newsletterTitle: "Ready to be a Climatifier?",
    newsletterSub: "Join our movement and make a difference for our planet.",
    emailPlaceholder: "Email Address",
    subscribe: "Subscribe",
    services: "Services",
    // السنة تُحسب في الـ Footer وقت العرض — لا تُكتب هنا وإلا تجمّدت.
    copyright: "Climatify. All rights reserved.",
  },
  ar: {
    // Navigation
    home: "الرئيسية",
    about: "من نحن",
    programs: "البرامج",
    initiatives: "المبادرات",
    events: "الفعاليات",
    learningHub: "التعلم",
    gamesHub: "ألعاب المناخ",
    community: "المجتمع",
    opportunities: "الفرص",
    contact: "اتصل بنا",
    media: "المركز الإعلامي",
    partners: "الشركاء",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    dashboard: "لوحة التحكم",
    adminDashboard: "لوحة المسؤول",
    joinMovement: "انضم إلينا",

    // General text
    keepGoing: "ابدأ الآن",
    learnMore: "تعرّف علينا أكثر",
    forBetterFuture: "نحو مستقبل أكثر استدامة",
    heroTitlePart1: "من الشباب وإلى الشباب،",
    heroTitlePart2: "نوحّد الجهود ونبتكر الحلول",
    heroTitlePart3: "وننطلق معاً نحو مستقبل أكثر استدامة.",
    heroSub: "كلايمتيفاي شركة ناشئة إماراتية تجمع بين الابتكار والرقمنة المناخية وتمكين المجتمعات محلياً وإقليمياً ودولياً — لتحويل الوعي إلى أثر ملموس.",

    // Impact (أرقام الأثر المعتمدة)
    impactYouthValue: "+25,000",
    impactYouthLabel: "شاب وشابة شاركوا في مبادراتنا",
    impactEmpoweredValue: "+1,000",
    impactEmpoweredLabel: "مستفيد تم بناء قدراتهم عبر المنطقة",
    impactOpportunitiesValue: "+200",
    impactOpportunitiesLabel: "فرصة تطوع وتدريب نوعية تم توفيرها",

    // Mission Page
    missionTitle: "ما هي كلايمتيفاي؟",
    missionText1: "كلايمتيفاي شركة ناشئة إماراتية رائدة تجمع بين الرقمنة والابتكار المناخي وتنمية وتمكين المجتمعات المحلية والإقليمية والدولية. تهدف مشاريعنا إلى تعزيز الوعي بالتحديات البيئية ودعم الاستراتيجيات الوطنية لدولة الإمارات، مع تحفيز المشاركة المجتمعية وتمكين الشباب والنساء لقيادة مسارات الاستدامة.",
    missionText2: "من المدارس والجامعات إلى المؤتمرات والملتقيات الدولية، نؤمن بأن المستقبل الأفضل نصنعه معاً — من الشباب وإلى الشباب.",
    vision: "الرؤية",
    visionText: "توحيد وتكامل جهود العمل المناخي عالمياً عبر الرقمنة والابتكار، وتمكين الشباب من المشاركة الفعالة والقيادية في صياغة حلول مستدامة حول العالم.",
    mission: "الرسالة",
    missionText: "دمج الرقمنة المناخية مع تمكين المجتمعات وتعزيز الوعي البيئي والتنمية المستدامة من خلال التكنولوجيا والمشاركة المسؤولة، لبناء مستقبل متناغم للإنسان.",
    focusAreas: "مجالات التركيز",
    focusAreasText: "الرقمنة والتحول الرقمي المناخي، التوعية والتثقيف البيئي، تمكين الشباب والنساء، ورش العمل والمعسكرات التفاعلية، البرامج والمناهج التعليمية المتخصصة، والأبعاد البيئية.",

    // Footer
    footerTagline: "نوحّد الحدود والثقافات والأجيال من خلال حلول وابتكارات المناخ.",
    newsletterTitle: "مستعد لتكون جزءاً من التغيير؟",
    newsletterSub: "انضم إلى شبكتنا وساهم في بناء مستقبل مستدام لكوكبنا.",
    emailPlaceholder: "البريد الإلكتروني",
    subscribe: "اشترك الآن",
    services: "خدماتنا",
    // السنة تُحسب في الـ Footer وقت العرض — لا تُكتب هنا وإلا تجمّدت.
    copyright: "كلايمتيفاي. جميع الحقوق محفوظة.",
  }
};

const STORAGE_KEY = "climatify-lang";

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

/**
 * قراءة آمنة: الوصول إلى localStorage يرمي استثناءً في وضع Safari الخاص
 * وعند حجب التخزين، وكانت القراءة هنا تحدث في مرحلة الرسم فتُسقط التطبيق كله.
 */
const readStoredLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    /* التخزين محجوب — نكمل بالافتراضي */
  }
  return "ar"; // Default to Arabic as requested by client dialect & region
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    // index.html يضع lang/dir قبل أول رسم؛ هذا يحافظ عليهما بعد كل تبديل.
    const root = document.documentElement;
    root.setAttribute("lang", language);
    root.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* الكتابة محجوبة — الاختيار يبقى لهذه الجلسة فقط */
    }
  }, [language]);

  // ثابت الهوية طالما لم تتغيّر اللغة، حتى لا يعيد كل مستهلك الرسم بلا داعٍ.
  const t = useCallback(
    (key: string): string => translations[language][key] ?? translations.en[key] ?? key,
    [language]
  );

  const value = useMemo<LanguageContextProps>(
    () => ({ language, setLanguage, t }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
