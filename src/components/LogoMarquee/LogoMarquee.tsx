import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { Partner } from "../../data/partners";
import "./LogoMarquee.css";

interface LogoMarqueeProps {
  partners: Partner[];
  /** Accessible name of the whole strip. */
  labelEn: string;
  labelAr: string;
}

/** One partner tile: the logo when a file exists, the name as a wordmark otherwise. */
export const PartnerMark: React.FC<{ partner: Partner; isAr: boolean }> = ({ partner, isAr }) => {
  const name = isAr ? partner.nameAr : partner.nameEn;
  return partner.logo ? (
    <img src={partner.logo} alt={name} className="partner-mark-logo" decoding="async" />
  ) : (
    <span className="partner-mark-name">{name}</span>
  );
};

/**
 * شريط لوجوهات الشركاء المتحرك (Logo Marquee).
 * القائمة بتتكرر مرتين: النص الأول هو المقروء، والتاني نسخة ديكور مخفية عن
 * قارئ الشاشة عشان الحركة تبان متصلة من غير قفزة.
 */
export const LogoMarquee: React.FC<LogoMarqueeProps> = ({ partners, labelEn, labelAr }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (partners.length === 0) return null;

  // كل نص بيكرر القائمة مرتين عشان الشريط يفضل أعرض من الشاشة حتى مع عدد قليل.
  const half = [...partners, ...partners];

  return (
    <div className="logo-marquee" role="group" aria-label={isAr ? labelAr : labelEn}>
      <div className="logo-marquee-track animate-marquee">
        <ul className="logo-marquee-half">
          {half.map((partner, index) => (
            <li
              key={`${partner.id}-${index}`}
              className={`logo-marquee-item ${partner.logo ? "has-logo" : ""}`}
              aria-hidden={index >= partners.length ? true : undefined}
            >
              <PartnerMark partner={partner} isAr={isAr} />
            </li>
          ))}
        </ul>
        <ul className="logo-marquee-half logo-marquee-clone" aria-hidden="true">
          {half.map((partner, index) => (
            <li key={`${partner.id}-clone-${index}`} className={`logo-marquee-item ${partner.logo ? "has-logo" : ""}`}>
              <PartnerMark partner={partner} isAr={isAr} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
