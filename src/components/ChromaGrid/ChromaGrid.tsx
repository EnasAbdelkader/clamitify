import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import './ChromaGrid.css';

export interface ChromaItem {
  image: string;
  title: string;
  subtitle?: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
}

export interface ChromaGridProps {
  items?: ChromaItem[];
  className?: string;
  radius?: number;
  columns?: number;
  rows?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
}

const FALLBACK_BORDER = 'var(--green)';
const FALLBACK_GRADIENT = 'linear-gradient(145deg, var(--navy-600), var(--navy-800))';

/** ألوان مقبولة: #hex أو rgb()/rgba()/hsl()/hsla() فقط. */
const SAFE_COLOR_RE = /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9a-z.,%\s/-]+\))$/i;
/** تدرّجات مقبولة: linear/radial/conic-gradient بمحتوى من حروف وأرقام وعلامات آمنة. */
const SAFE_GRADIENT_RE = /^(?:linear|radial|conic)-gradient\([#0-9a-z.,%\s/()-]+\)$/i;
const UNSAFE_CSS_RE = /url\(|expression|@import|[;{}]|\/\*/i;

/**
 * البيانات دي بتيجي من الـ CMS/الباك إند وبتتحط مباشرة في inline style،
 * فلازم تتفلتر عشان محدش يقدر يحقن CSS عشوائي (url(...) وخلافه).
 */
function safeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim();
  if (v.length > 64 || UNSAFE_CSS_RE.test(v)) return fallback;
  return SAFE_COLOR_RE.test(v) ? v : fallback;
}

function safeGradient(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim();
  if (v.length > 300 || UNSAFE_CSS_RE.test(v)) return fallback;
  return SAFE_GRADIENT_RE.test(v) ? v : fallback;
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const ChromaGrid: React.FC<ChromaGridProps> = ({
  items,
  className = '',
  radius = 300,
  columns = 3,
  rows = 3,
  damping = 0.45,
  fadeOut = 0.6,
  ease = 'power3.out'
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const pos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [failedImages, setFailedImages] = useState<Record<number, true>>({});

  // إعدادات الحركة بتتقرا من ref جوه الـ handlers عشان الـ effect ما يعيدش التسجيل.
  const settingsRef = useRef({ damping, ease, fadeOut });
  settingsRef.current = { damping, ease, fadeOut };

  // مفيش بيانات تجريبية هنا إطلاقاً — لو الفريق فاضي مبنعرضش حاجة.
  const data = items ?? [];
  const hasItems = data.length > 0;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const setterX = gsap.quickSetter(el, '--x', 'px');
    const setterY = gsap.quickSetter(el, '--y', 'px');

    let rootRect = el.getBoundingClientRect();
    let rectDirty = false;
    pos.current = { x: rootRect.width / 2, y: rootRect.height / 2 };
    setterX(pos.current.x);
    setterY(pos.current.y);

    // على اللمس مفيش hover — بنسيب الـ CSS يعرض الكروت بحالتها الملوّنة.
    if (isCoarsePointer()) return;

    const reduceMotion = prefersReducedMotion();
    const fadeEl = fadeRef.current;
    const cardRects = new Map<HTMLElement, DOMRect>();

    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;
    let pendingCard: HTMLElement | null = null;
    let hasPending = false;

    const markRectDirty = () => { rectDirty = true; };

    const flush = () => {
      frame = 0;
      if (!hasPending) return;
      hasPending = false;

      if (rectDirty) {
        rootRect = el.getBoundingClientRect();
        cardRects.clear();
        rectDirty = false;
      }

      const x = pendingX - rootRect.left;
      const y = pendingY - rootRect.top;

      if (reduceMotion) {
        pos.current.x = x;
        pos.current.y = y;
        setterX(x);
        setterY(y);
      } else {
        gsap.to(pos.current, {
          x,
          y,
          duration: settingsRef.current.damping,
          ease: settingsRef.current.ease,
          onUpdate: () => {
            setterX(pos.current.x);
            setterY(pos.current.y);
          },
          overwrite: true
        });
      }

      if (fadeEl) {
        if (reduceMotion) gsap.set(fadeEl, { opacity: 0 });
        else gsap.to(fadeEl, { opacity: 0, duration: 0.25, overwrite: true });
      }

      const card = pendingCard;
      if (card) {
        let rect = cardRects.get(card);
        if (!rect) {
          rect = card.getBoundingClientRect();
          cardRects.set(card, rect);
        }
        card.style.setProperty('--mouse-x', `${pendingX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${pendingY - rect.top}px`);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = e.target instanceof Element ? e.target : null;
      pendingCard = target?.closest<HTMLElement>('.chroma-card') ?? null;
      pendingX = e.clientX;
      pendingY = e.clientY;
      hasPending = true;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const handlePointerLeave = () => {
      hasPending = false;
      pendingCard = null;
      if (!fadeEl) return;
      if (reduceMotion) gsap.set(fadeEl, { opacity: 1 });
      else {
        gsap.to(fadeEl, {
          opacity: 1,
          duration: settingsRef.current.fadeOut,
          overwrite: true
        });
      }
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('resize', markRectDirty);
    window.addEventListener('scroll', markRectDirty, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', markRectDirty);
      window.removeEventListener('scroll', markRectDirty);
      // من غير ده الـ tweens بتفضل تكتب في quickSetters متعلّقة بـ DOM متشال.
      gsap.killTweensOf(pos.current);
      if (fadeEl) gsap.killTweensOf(fadeEl);
    };
  }, [hasItems]);

  if (!hasItems) return null;

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`}
      style={{
        '--r': `${radius}px`,
        '--cols': columns,
        '--rows': rows
      } as React.CSSProperties}
    >
      {data.map((c, i) => {
        const cardStyle = {
          '--card-border': safeColor(c.borderColor, FALLBACK_BORDER),
          '--card-gradient': safeGradient(c.gradient, FALLBACK_GRADIENT)
        } as React.CSSProperties;

        const showFallbackImage = !c.image || failedImages[i];
        const initial = c.title?.trim().charAt(0) || '؟';

        const cardContent = (
          <>
            <div className="chroma-img-wrapper">
              {showFallbackImage ? (
                <div className="chroma-img-fallback" aria-hidden="true">
                  <span>{initial}</span>
                </div>
              ) : (
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedImages(prev => (prev[i] ? prev : { ...prev, [i]: true }))}
                />
              )}
            </div>
            <footer className="chroma-info">
              <h3 className="name">{c.title}</h3>
              {c.handle && <span className="handle">{c.handle}</span>}
              {c.subtitle && <p className="role">{c.subtitle}</p>}
              {c.location && <span className="location">{c.location}</span>}
            </footer>
          </>
        );

        // لو فيه رابط بنستخدم <a> حقيقي: قابل للوصول بالكيبورد ومقروء للـ screen readers.
        return c.url ? (
          <a
            key={`${c.title}-${i}`}
            className="chroma-card chroma-card-link"
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            style={cardStyle}
          >
            {cardContent}
          </a>
        ) : (
          <article key={`${c.title}-${i}`} className="chroma-card" style={cardStyle}>
            {cardContent}
          </article>
        );
      })}
      <div className="chroma-overlay" aria-hidden="true" />
      <div ref={fadeRef} className="chroma-fade" aria-hidden="true" />
    </div>
  );
};

export default ChromaGrid;
