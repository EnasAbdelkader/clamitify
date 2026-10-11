import React, { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { ChromaGrid } from "../../components/ChromaGrid/ChromaGrid";
import type { ChromaItem } from "../../components/ChromaGrid/ChromaGrid";
import { EmptyState } from "../../components/ui/EmptyState";
import { TeamGroups } from "../../components/TeamGroups/TeamGroups";
import { apiService, ApiError } from "../../services/api";
import { trainingPosters } from "../../data/trainingPosters";
import type { TeamMember } from "../../types";
import "./About.css";

const TEAM_SKELETON_COUNT = 6;

/**
 * صفحة "من نحن" — بتركّز على الفريق بس: المؤسسون، فريق العمل، المتدربون،
 * وتحتهم تصاميم وبوسترات برامج التدريب.
 * (الرؤية والرسالة في الصفحة الرئيسية، والتقرير السنوي اتنقل للمركز الإعلامي.)
 */
export const About: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchTeam = async () => {
      setTeamLoading(true);
      setTeamError(null);
      try {
        const data = await apiService.getTeam();
        if (controller.signal.aborted) return;
        setTeam(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error loading team data:", err);
        setTeamError(err);
      } finally {
        if (!controller.signal.aborted) setTeamLoading(false);
      }
    };

    void fetchTeam();
    return () => controller.abort();
  }, [reloadToken]);

  // بنترجم الخطأ وقت الرسم مش وقت الجلب، عشان تبديل اللغة ميعملش fetch تاني.
  const teamErrorMessage = teamError
    ? teamError instanceof ApiError
      ? teamError.localizedMessage(language)
      : isAr
        ? "حدث خطأ غير متوقع."
        : "An unexpected error occurred."
    : null;

  const retryTeam = useCallback(() => setReloadToken((n) => n + 1), []);

  // الـ ChromaGrid للمؤسسين بس — فريق العمل والمتدربين بيتعرضوا تحته في TeamGroups.
  const founders = team.filter((member) => (member.group ?? "founder") === "founder");
  const hasOtherGroups = team.some((member) => member.group === "core" || member.group === "intern");

  const chromaItems: ChromaItem[] = founders.map((member) => ({
    image: member.image,
    title: isAr ? member.nameAr : member.nameEn,
    subtitle: isAr ? member.roleAr : member.roleEn,
    borderColor: member.borderColor || "#10B981",
    gradient: member.gradient || "linear-gradient(145deg, #059669, #022c22)"
  }));

  const renderTeam = () => {
    if (teamLoading) {
      return (
        <div className="about-team-skeleton-grid" role="status" aria-live="polite">
          <span className="sr-only">{isAr ? "جارٍ تحميل فريق العمل…" : "Loading the team…"}</span>
          {Array.from({ length: TEAM_SKELETON_COUNT }, (_, i) => (
            <div key={i} className="about-team-skeleton-card" aria-hidden="true">
              <div className="about-team-skeleton-avatar" />
              <div className="about-team-skeleton-line" />
              <div className="about-team-skeleton-line short" />
            </div>
          ))}
        </div>
      );
    }

    if (teamErrorMessage) {
      return (
        <EmptyState
          type="error"
          titleAr="تعذّر تحميل فريق العمل"
          titleEn="Could not load the team"
          descriptionAr={teamErrorMessage}
          descriptionEn={teamErrorMessage}
          actionAr="إعادة المحاولة"
          actionEn="Try again"
          onAction={retryTeam}
        />
      );
    }

    if (chromaItems.length === 0) {
      return (
        <EmptyState
          type="no-data"
          titleAr="لم يتم نشر أعضاء الفريق بعد"
          titleEn="No team members published yet"
          descriptionAr="سيتم عرض قادة الفريق هنا فور إضافتهم من لوحة التحكم."
          descriptionEn="Team leaders will appear here once they are added from the CMS."
        />
      );
    }

    return (
      <div className="about-team-grid-wrap">
        <ChromaGrid
          items={chromaItems}
          radius={320}
          columns={3}
          rows={3}
          damping={0.45}
          fadeOut={0.6}
          ease="power3.out"
        />
      </div>
    );
  };

  return (
    <div className="about-page-container container">
      {/* 1. Header Section */}
      <section className="about-header-section text-center">
        <span className="eyebrow">{t("about")}</span>
        <h1 className="section-title">
          {isAr ? "فريق كلايمتيفاي" : "The Climatify Team"}
        </h1>
        <p className="section-lead mx-auto">
          {isAr
            ? "تعرّف على المؤسسين وفريق العمل والمتدربين الذين يقودون العمل المناخي في كلايمتيفاي."
            : "Meet the founders, team members and interns driving climate action at Climatify."}
        </p>
      </section>

      {/* 2. Founders (ChromaGrid from React Bits) + Core Team + Interns */}
      <section className="about-team-section">
        <div className="text-center" style={{ marginBottom: "36px" }}>
          <span className="eyebrow">{isAr ? "المؤسسون" : "Founders"}</span>
          <h2>{isAr ? "قادة التغيير المناخي" : "Our Climate Change Leaders"}</h2>
        </div>

        {renderTeam()}

        {/* فريق العمل والمتدربون — بيظهروا بس لما بياناتهم تتحمّل */}
        {!teamLoading && !teamErrorMessage && hasOtherGroups && (
          <div className="about-team-groups-wrap">
            <TeamGroups members={team} groups={["core", "intern"]} />
          </div>
        )}
      </section>

      {/* 3. Designs & Posters — تصاميم وبوسترات برامج التدريب */}
      {trainingPosters.length > 0 && (
        <section className="about-posters-section" aria-labelledby="about-posters-title">
          <div className="text-center about-posters-header">
            <span className="eyebrow">{isAr ? "المتدربون" : "Interns"}</span>
            <h2 id="about-posters-title">
              {isAr ? "برامج التدريب في كلايمتيفاي" : "Internship Programs at Climatify"}
            </h2>
          </div>

          <div className="about-posters-list">
            {trainingPosters.map((poster) => {
              const title = isAr ? poster.titleAr : poster.titleEn;
              return (
                <article key={poster.id} className="about-poster-card">
                  <img
                    src={poster.image}
                    alt={isAr ? `بوستر ${title}` : `${title} poster`}
                    className="about-poster-img"
                    width={800}
                    height={800}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="about-poster-body">
                    <h3>{title}</h3>
                    <p>{isAr ? poster.descriptionAr : poster.descriptionEn}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
