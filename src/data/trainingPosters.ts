// ==========================================
// Designs & posters shown in the About page under the team.
// Order matters: the list is rendered as written. The "Intern 2026" poster
// goes FIRST once its file is provided — drop the image in `public/posters/`
// and add an entry at the top of the array.
// ==========================================

export interface TrainingPoster {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** Path under `public/`. */
  image: string;
}

export const trainingPosters: TrainingPoster[] = [
  {
    id: "shift-internship",
    titleEn: "SHIFT Internship",
    titleAr: "برنامج SHIFT للتدريب",
    descriptionEn:
      "Led by Climatify in partnership with Wavemakers United and Space Point, SHIFT is a regional internship that runs four times a year, offering youth a three-month experience in climate action, water sustainability, and space innovation. Accredited by the European Union, it provides hands-on learning, global exposure, and a capacity-building curriculum led by international experts.",
    descriptionAr:
      "برنامج SHIFT مبادرة تدريب إقليمية تقودها كلايمتيفاي بالشراكة مع Wavemakers United و Space Point، تُقام أربع مرات سنوياً وتقدم للشباب تجربة لمدة ثلاثة أشهر في العمل المناخي واستدامة المياه وابتكار الفضاء. البرنامج معتمد من الاتحاد الأوروبي، ويوفر تعلماً عملياً وانفتاحاً دولياً ومنهجاً متكاملاً لبناء القدرات بقيادة خبراء دوليين.",
    image: "/posters/shift-internship.jpg",
  },
];
