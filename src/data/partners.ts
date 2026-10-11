// ==========================================
// Climatify partners — single source for the home logo marquee and the
// Partners page. To show a real logo, drop the file in `public/partners/`
// and set `logo` to its path (e.g. "/partners/youngo.svg"). Until a logo is
// set the partner is rendered as a text wordmark.
// Logos below come from the "Trusted by" pages of the Climatify Portfolio 2025.
// ==========================================

export type PartnerGroup = "partner" | "learning";

export interface Partner {
  id: string;
  nameEn: string;
  nameAr: string;
  group: PartnerGroup;
  /** Path under `public/` — optional until the logo file is provided. */
  logo?: string;
}

export const partners: Partner[] = [
  // الشركاء الرئيسيون — بيظهروا الأول في الـ marquee
  { id: "ministry-climate-change", nameEn: "Ministry of Climate Change & Environment", nameAr: "وزارة التغير المناخي والبيئة", group: "partner", logo: "/partners/ministry-climate-change-environment.png" },
  { id: "eu-med", nameEn: "EU Med – EU Neighbours South", nameAr: "EU Med – EU Neighbours South", group: "partner", logo: "/partners/eu-neighbours-south.png" },
  { id: "iom", nameEn: "IOM – UN Migration", nameAr: "المنظمة الدولية للهجرة (IOM)", group: "partner", logo: "/partners/iom-un-migration.png" },
  { id: "youngo", nameEn: "YOUNGO", nameAr: "YOUNGO", group: "partner", logo: "/partners/youngo.png" },
  { id: "arab-youth-center", nameEn: "Arab Youth Center", nameAr: "مركز الشباب العربي", group: "partner" },

  // شركاء محتوى التعلم
  { id: "zayed-university", nameEn: "Zayed University", nameAr: "جامعة زايد", group: "learning", logo: "/partners/zayed-university.png" },
  { id: "khalifa-university", nameEn: "Khalifa University", nameAr: "جامعة خليفة", group: "learning", logo: "/partners/khalifa-university.png" },
  { id: "heliopolis-university", nameEn: "Heliopolis University", nameAr: "جامعة هليوبوليس", group: "learning", logo: "/partners/heliopolis-university.png" },
  { id: "enoc", nameEn: "ENOC", nameAr: "ENOC", group: "learning" },
];

export const partnersByGroup = (group: PartnerGroup): Partner[] =>
  partners.filter((partner) => partner.group === group);
