// ==========================================
// SHIFT program session recordings — shown in the Learning page.
// The videos live in the shared Google Drive folder "Sessions Recordings";
// `driveFileId` is the id from the file's share link
// (https://drive.google.com/file/d/<driveFileId>/view).
// To add a recording: upload it to that folder, make sure it is shared as
// "Anyone with the link", then add an entry here.
// ==========================================

export interface SessionRecording {
  id: string;
  titleEn: string;
  titleAr: string;
  /** ISO date (YYYY-MM-DD) of the session. */
  date: string;
  driveFileId: string;
}

export const sessionRecordings: SessionRecording[] = [
  {
    id: "shift-orientation",
    titleEn: "SHIFT Program – Orientation Session & Participant Instructions",
    titleAr: "برنامج SHIFT — الجلسة التعريفية وتعليمات المشاركين",
    date: "2025-07-20",
    driveFileId: "11h2z-Yie9VdXKl9Aj76CXf22AH01yt-H",
  },
  {
    id: "shift-presentation-negotiation",
    titleEn: "Presentation & Public Speaking – Negotiation & Persuasion in International Conventions",
    titleAr: "العرض والتحدث أمام الجمهور — التفاوض والإقناع في الاتفاقيات الدولية",
    date: "2025-07-22",
    driveFileId: "1qyNSL4DNjj4AFokoLUi1j85BWXMW__EQ",
  },
  {
    id: "shift-3-networking-part-1",
    titleEn: "SHIFT 3: Networking & Stakeholders – Leadership & Teamwork (Part 1)",
    titleAr: "SHIFT 3: التشبيك وأصحاب المصلحة — القيادة والعمل الجماعي (الجزء 1)",
    date: "2025-07-24",
    driveFileId: "1SjRlAxqfL8qLlu9j7O8pwTNhV_9TMhYJ",
  },
  {
    id: "shift-3-networking-part-2",
    titleEn: "SHIFT 3: Networking & Stakeholders – Leadership & Teamwork (Part 2)",
    titleAr: "SHIFT 3: التشبيك وأصحاب المصلحة — القيادة والعمل الجماعي (الجزء 2)",
    date: "2025-07-24",
    driveFileId: "1xgpgTIcxCa_uqolwv5xby4aKFb4ESULS",
  },
];
