import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useCMSStore } from "../../store/useCMSStore";
import {
  Calendar, FileText, LayoutGrid, Target, GraduationCap, Briefcase, Users,
} from "lucide-react";
import { ContentWorkspace } from "./content/ContentWorkspace";
import {
  eventSection, postSection, programSection, initiativeSection,
  courseSection, opportunitySection, teamSection,
} from "./content/sections";

// ============================================================
// إدارة المحتوى — موجّه رفيع فوق أقسام تصريحية.
// القسم النشط مربوط بالرابط (/admin/content/<section>) فيصمد أمام
// الـ refresh والروابط المباشرة، وكل قسم يُبنى بنوعيه الصريحين.
// ============================================================

type ContentSectionId =
  | "articles" | "events" | "initiatives" | "courses" | "programs" | "opportunities" | "team";

const SECTION_IDS: readonly ContentSectionId[] = [
  "articles", "events", "initiatives", "courses", "programs", "opportunities", "team",
];

const parseSectionFromPath = (pathname: string): ContentSectionId | null => {
  const match = /^\/admin\/content\/([\w-]+)/.exec(pathname);
  if (!match) return null;
  const id = match[1];
  return SECTION_IDS.includes(id as ContentSectionId) ? (id as ContentSectionId) : null;
};

export const AdminContent: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = parseSectionFromPath(location.pathname) ?? "articles";

  // روابط قديمة أو مقاطع غير معروفة تُطبَّع إلى /admin/content بدل صفحة صامتة خاطئة.
  const isKnownPath =
    location.pathname === "/admin/content" || parseSectionFromPath(location.pathname) !== null;
  useEffect(() => {
    if (!isKnownPath) navigate("/admin/content", { replace: true });
  }, [isKnownPath, navigate]);

  // عدّادات الأقسام — selectors ضيقة فلا يعاد رسم الصفحة مع أي تغيير آخر في المخزن.
  const postsCount = useCMSStore((s) => s.posts.length);
  const eventsCount = useCMSStore((s) => s.events.length);
  const initiativesCount = useCMSStore((s) => s.initiatives.length);
  const coursesCount = useCMSStore((s) => s.courses.length);
  const programsCount = useCMSStore((s) => s.programs.length);
  const opportunitiesCount = useCMSStore((s) => s.opportunities.length);
  const teamCount = useCMSStore((s) => s.team.length);

  const counts: Record<ContentSectionId, number> = {
    articles: postsCount,
    events: eventsCount,
    initiatives: initiativesCount,
    courses: coursesCount,
    programs: programsCount,
    opportunities: opportunitiesCount,
    team: teamCount,
  };

  const navTabs: { id: ContentSectionId; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: "articles", labelAr: "المقالات", labelEn: "Articles", icon: <FileText size={16} /> },
    { id: "events", labelAr: "الفعاليات", labelEn: "Events", icon: <Calendar size={16} /> },
    { id: "initiatives", labelAr: "المبادرات", labelEn: "Initiatives", icon: <Target size={16} /> },
    { id: "courses", labelAr: "المساقات", labelEn: "Courses", icon: <GraduationCap size={16} /> },
    { id: "programs", labelAr: "البرامج", labelEn: "Programs", icon: <LayoutGrid size={16} /> },
    { id: "opportunities", labelAr: "الفرص", labelEn: "Opportunities", icon: <Briefcase size={16} /> },
    { id: "team", labelAr: "فريق العمل", labelEn: "Team", icon: <Users size={16} /> },
  ];

  const handleSectionChange = (id: ContentSectionId) => {
    navigate(`/admin/content/${id}`);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <h2 className="admin-page-title">
          <span>{isAr ? "إدارة المحتوى والمواد" : "Content Management Hub"}</span>
        </h2>
        <p className="admin-page-subtitle">
          {isAr
            ? "منصة التحكم بجميع مقالات وفعاليات وبرامج المنصة — عدّل اللغتين معاً في المحرر"
            : "Central CMS workspace to publish, edit, and organize all platform entities — both languages side by side"}
        </p>
      </div>

      {/* Content Navigation Tabs */}
      <div className="admin-cms-nav-tabs" role="tablist" aria-label={isAr ? "أقسام المحتوى" : "Content sections"}>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSection === tab.id}
            className={`admin-cms-tab-btn ${activeSection === tab.id ? "active" : ""}`}
            onClick={() => handleSectionChange(tab.id)}
          >
            {tab.icon}
            <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            <span className="admin-cms-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {activeSection === "articles" && <ContentWorkspace section={postSection} />}
      {activeSection === "events" && <ContentWorkspace section={eventSection} />}
      {activeSection === "initiatives" && <ContentWorkspace section={initiativeSection} />}
      {activeSection === "courses" && <ContentWorkspace section={courseSection} />}
      {activeSection === "programs" && <ContentWorkspace section={programSection} />}
      {activeSection === "opportunities" && <ContentWorkspace section={opportunitySection} />}
      {activeSection === "team" && <ContentWorkspace section={teamSection} />}
    </div>
  );
};
