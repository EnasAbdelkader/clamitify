import React, { useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { TeamGroup, TeamMember } from "../../types";
import "./TeamGroups.css";

const GROUP_LABELS: Record<TeamGroup, { ar: string; en: string }> = {
  founder: { ar: "المؤسسون", en: "Founders" },
  core: { ar: "فريق العمل", en: "Core Team" },
  intern: { ar: "المتدربون", en: "Interns" },
};

const DEFAULT_ORDER: TeamGroup[] = ["founder", "core", "intern"];

/** عضو من غير `group` (بيانات قديمة من الـ API) بيتحسب مؤسس. */
const groupOf = (member: TeamMember): TeamGroup => member.group ?? "founder";

/** أول حرف من أول اسمين — بديل الصورة لما العضو ملوش صورة. */
const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const MemberAvatar: React.FC<{ member: TeamMember; name: string }> = ({ member, name }) => {
  const [failed, setFailed] = useState(false);

  if (!member.image || failed) {
    return (
      <span className="team-member-avatar team-member-initials" aria-hidden="true">
        {initialsOf(member.nameEn || name)}
      </span>
    );
  }

  return (
    <img
      src={member.image}
      alt=""
      className="team-member-avatar"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
};

interface TeamGroupsProps {
  members: TeamMember[];
  /** Which groups to show, in order. Groups with no members are skipped. */
  groups?: TeamGroup[];
}

/**
 * الفريق مقسّم على تبويبات: المؤسسون / فريق العمل / المتدربون.
 * التبويب اللي ملوش أعضاء مبيظهرش أصلاً، ولو فضل تبويب واحد بيتعرض من غير شريط تبويبات.
 */
export const TeamGroups: React.FC<TeamGroupsProps> = ({ members, groups = DEFAULT_ORDER }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const available = useMemo(
    () => groups.filter((group) => members.some((member) => groupOf(member) === group)),
    [groups, members]
  );

  const [selected, setSelected] = useState<TeamGroup | null>(null);
  const active = selected && available.includes(selected) ? selected : available[0];

  if (!active) return null;

  const visible = members.filter((member) => groupOf(member) === active);

  return (
    <div className="team-groups">
      {available.length > 1 && (
        <div className="team-groups-tabs" role="group" aria-label={isAr ? "أقسام الفريق" : "Team sections"}>
          {available.map((group) => (
            <button
              key={group}
              type="button"
              className={`team-groups-tab ${group === active ? "active" : ""}`}
              onClick={() => setSelected(group)}
              aria-pressed={group === active}
            >
              {isAr ? GROUP_LABELS[group].ar : GROUP_LABELS[group].en}
            </button>
          ))}
        </div>
      )}

      {available.length === 1 && (
        <h3 className="team-groups-single-title">
          {isAr ? GROUP_LABELS[active].ar : GROUP_LABELS[active].en}
        </h3>
      )}

      <ul className="team-groups-grid" key={active}>
        {visible.map((member) => {
          const name = isAr ? member.nameAr : member.nameEn;
          const bio = isAr ? member.bioAr : member.bioEn;
          return (
            <li key={member.id} className="team-member-card">
              <MemberAvatar member={member} name={name} />
              <h4 className="team-member-name">{name}</h4>
              <p className="team-member-role">{isAr ? member.roleAr : member.roleEn}</p>
              {bio && <p className="team-member-bio">{bio}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
