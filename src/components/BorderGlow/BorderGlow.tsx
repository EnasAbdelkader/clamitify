import React, { useRef, useEffect } from 'react';
import './BorderGlow.css';

interface HSL {
  h: number;
  s: number;
  l: number;
}

const FALLBACK_HSL: HSL = { h: 40, s: 80, l: 80 };

function parseHSL(hslStr: string): HSL {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  const rawH = match?.[1];
  const rawS = match?.[2];
  const rawL = match?.[3];
  if (!rawH || !rawS || !rawL) return FALLBACK_HSL;

  const h = parseFloat(rawH);
  const s = parseFloat(rawS);
  const l = parseFloat(rawL);
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return FALLBACK_HSL;

  return { h, s, l };
}

/** درجات التوهج: [لاحقة اسم المتغير, نسبة العتامة] — مصفوفة أزواج بدل مصفوفتين متوازيتين. */
const GLOW_STEPS: ReadonlyArray<readonly [suffix: string, opacity: number]> = [
  ['', 100],
  ['-60', 60],
  ['-50', 50],
  ['-40', 40],
  ['-30', 30],
  ['-20', 20],
  ['-10', 10],
];

function buildGlowVars(glowColor: string, intensity: number): Record<string, string> {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const vars: Record<string, string> = {};
  for (const [suffix, opacity] of GLOW_STEPS) {
    vars[`--glow-color${suffix}`] = `hsl(${base} / ${Math.min(opacity * intensity, 100)}%)`;
  }
  return vars;
}

/** مواضع الـ mesh gradient + أي لون من مصفوفة الـ colors بيتستخدم في كل موضع. */
const GRADIENT_STOPS: ReadonlyArray<{ key: string; position: string; colorIndex: number }> = [
  { key: '--gradient-one', position: '80% 55%', colorIndex: 0 },
  { key: '--gradient-two', position: '69% 34%', colorIndex: 1 },
  { key: '--gradient-three', position: '8% 6%', colorIndex: 2 },
  { key: '--gradient-four', position: '41% 38%', colorIndex: 0 },
  { key: '--gradient-five', position: '86% 85%', colorIndex: 1 },
  { key: '--gradient-six', position: '82% 18%', colorIndex: 2 },
  { key: '--gradient-seven', position: '51% 4%', colorIndex: 1 },
];

const FALLBACK_ACCENT = 'currentColor';

function buildGradientVars(colors: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  const palette = colors.length ? colors : [FALLBACK_ACCENT];
  const pick = (index: number): string =>
    palette[Math.min(index, palette.length - 1)] ?? FALLBACK_ACCENT;

  for (const { key, position, colorIndex } of GRADIENT_STOPS) {
    vars[key] = `radial-gradient(at ${position}, ${pick(colorIndex)} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${pick(0)} 0 100%)`;
  return vars;
}

function easeOutCubic(x: number): number { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x: number): number { return x * x * x; }

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

interface AnimateOptions {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (x: number) => number;
  onUpdate: (v: number) => void;
  onEnd?: () => void;
}

/** بيرجّع دالة إلغاء — لازم تتنادى في الـ cleanup وإلا الـ rAF/timeout بيفضلوا شغالين بعد الـ unmount. */
function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: AnimateOptions): () => void {
  let cancelled = false;
  let frame = 0;

  const timer = window.setTimeout(() => {
    if (cancelled) return;
    const t0 = performance.now();
    const tick = () => {
      if (cancelled) return;
      const t = Math.min((performance.now() - t0) / duration, 1);
      onUpdate(start + (end - start) * ease(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else onEnd?.();
    };
    frame = requestAnimationFrame(tick);
  }, delay);

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (frame) cancelAnimationFrame(frame);
  };
}

export interface BorderGlowProps {
  children?: React.ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
}

export const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = 'var(--surface-2)',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // ── تتبّع المؤشر: listener واحد native، مجمّع في rAF، والـ rect مكاشّ
  //    (بيتحدّث على resize/scroll بس) عشان مفيش layout read لكل حركة ماوس.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    // على الشاشات اللمسية مفيش hover أصلاً — بنتجاهل الـ effect بالكامل.
    if (isCoarsePointer()) return;

    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;
    let rect: DOMRect | null = null;
    let rectDirty = true;

    const markRectDirty = () => { rectDirty = true; };

    const flush = () => {
      frame = 0;
      if (!hasPending) return;
      hasPending = false;

      if (rectDirty || !rect) {
        rect = card.getBoundingClientRect();
        rectDirty = false;
      }
      if (!rect.width || !rect.height) return;

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = pendingX - rect.left - cx;
      const dy = pendingY - rect.top - cy;

      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      let angle = 0;
      if (dx !== 0 || dy !== 0) {
        angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
      }

      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
      card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
    };

    const handlePointerMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      hasPending = true;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    card.addEventListener('pointermove', handlePointerMove);
    card.addEventListener('pointerenter', markRectDirty);
    window.addEventListener('resize', markRectDirty);
    window.addEventListener('scroll', markRectDirty, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      card.removeEventListener('pointermove', handlePointerMove);
      card.removeEventListener('pointerenter', markRectDirty);
      window.removeEventListener('resize', markRectDirty);
      window.removeEventListener('scroll', markRectDirty);
    };
  }, []);

  // ── مسحة التوهج التمهيدية (animated) — كل timer/frame متتبّع ومتلغي عند الـ unmount.
  useEffect(() => {
    const card = cardRef.current;
    if (!animated || !card) return;
    if (prefersReducedMotion()) return;

    const angleStart = 110;
    const angleEnd = 465;
    const setAngle = (v: number) => {
      card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
    };

    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', `${angleStart}deg`);

    const cancels: Array<() => void> = [
      animateValue({
        duration: 500,
        onUpdate: v => card.style.setProperty('--edge-proximity', `${v}`),
      }),
      animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: setAngle }),
      animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: setAngle }),
      animateValue({
        ease: easeInCubic,
        delay: 2500,
        duration: 1500,
        start: 100,
        end: 0,
        onUpdate: v => card.style.setProperty('--edge-proximity', `${v}`),
        onEnd: () => card.classList.remove('sweep-active'),
      }),
    ];

    return () => {
      for (const cancel of cancels) cancel();
      card.classList.remove('sweep-active');
    };
  }, [animated]);

  const glowVars = buildGlowVars(glowColor, glowIntensity);

  return (
    <div
      ref={cardRef}
      className={`border-glow-card ${className}`}
      style={{
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': `${borderRadius}px`,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...glowVars,
        ...buildGradientVars(colors),
      } as React.CSSProperties}
    >
      <span className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
