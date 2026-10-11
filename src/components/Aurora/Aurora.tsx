import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import React, { useEffect, useRef, useState } from 'react';
import './Aurora.css';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

const DEFAULT_COLOR_STOPS = ['#00d0ff', '#72ecff', '#27ff70'];
const DEFAULT_SPEED = 0.5;
const DEFAULT_AMPLITUDE = 1.0;
const DEFAULT_BLEND = 0.5;

/**
 * الشيدر مكتوب بـ `#version 300 es` يعني WebGL2 إجباري.
 * لو الجهاز مش مدعّم (أو WebGL متقفل) بنرجّع false ونعرض خلفية CSS ثابتة
 * بدل ما الـ rAF يفضل يرمي exception ٦٠ مرة في الثانية.
 */
let webgl2Support: boolean | null = null;

function detectWebGL2(): boolean {
  if (webgl2Support !== null) return webgl2Support;
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    webgl2Support = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  time?: number;
}

export const Aurora: React.FC<AuroraProps> = (props) => {
  const { colorStops = DEFAULT_COLOR_STOPS } = props;

  // كل القيم الحية بتتقرا من الـ ref جوه لوب الرسم، عشان تغيير أي prop
  // ما يعيدش بناء الـ renderer/program/mesh من الصفر.
  const propsRef = useRef(props);
  propsRef.current = props;

  const ctnDom = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  // سلسلة ثابتة بدل مرجع المصفوفة (اللي بيتغيّر كل render لو اتبعت inline).
  const colorStopsKey = colorStops.join(',');

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    if (!detectWebGL2()) {
      setUnsupported(true);
      return;
    }

    const reduceMotion = prefersReducedMotion();

    let disposed = false;
    let running = false;
    let frameId = 0;
    let elapsed = 0;
    let lastTs = 0;
    let inView = true;

    let renderer: Renderer | null = null;
    let mesh: Mesh | null = null;
    let program: Program | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let onVisibilityChange: (() => void) | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const stop = () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const cleanup = () => {
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (onVisibilityChange) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (canvas && canvas.parentNode === ctn) {
        ctn.removeChild(canvas);
      }
      renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
    };

    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true
      });

      if (!renderer.isWebgl2) {
        throw new Error('Aurora requires a WebGL2 context (#version 300 es shaders).');
      }

      const gl = renderer.gl;
      canvas = gl.canvas;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      canvas.style.backgroundColor = 'transparent';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';

      const geometry = new Triangle(gl);
      if (geometry.attributes && 'uv' in geometry.attributes) {
        delete (geometry.attributes as Record<string, unknown>).uv;
      }

      // ── ألوان مرفوعة برّه اللوب: كائن Color واحد + ٣ مصفوفات ثابتة،
      //    وبنحدّثهم بس لما الـ stops تتغيّر فعلاً (مش كل فريم).
      const stop0: [number, number, number] = [0, 0, 0];
      const stop1: [number, number, number] = [0, 0, 0];
      const stop2: [number, number, number] = [0, 0, 0];
      const stopTargets: Array<[number, number, number]> = [stop0, stop1, stop2];
      const stopsValue = [stop0, stop1, stop2];
      const scratchColor = new Color();
      let appliedStopsKey = '';

      const applyStops = (stops: string[]) => {
        const key = stops.join(',');
        if (key === appliedStopsKey) return;
        appliedStopsKey = key;
        for (let i = 0; i < stopTargets.length; i++) {
          const target = stopTargets[i];
          if (!target) continue;
          const hex = stops[i] ?? DEFAULT_COLOR_STOPS[i] ?? '#000000';
          try {
            scratchColor.set(hex);
          } catch {
            scratchColor.set('#000000');
          }
          target[0] = scratchColor.r;
          target[1] = scratchColor.g;
          target[2] = scratchColor.b;
        }
      };

      applyStops(propsRef.current.colorStops ?? DEFAULT_COLOR_STOPS);

      const initialWidth = ctn.offsetWidth || window.innerWidth;
      const initialHeight = ctn.offsetHeight || window.innerHeight;

      program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAmplitude: { value: propsRef.current.amplitude ?? DEFAULT_AMPLITUDE },
          uColorStops: { value: stopsValue },
          uResolution: { value: [initialWidth, initialHeight] },
          uBlend: { value: propsRef.current.blend ?? DEFAULT_BLEND }
        }
      });

      mesh = new Mesh(gl, { geometry, program });
      ctn.appendChild(canvas);

      const activeProgram = program;
      const activeMesh = mesh;
      const activeRenderer = renderer;

      const renderFrame = () => {
        if (disposed) return;
        const live = propsRef.current;
        const speed = live.speed ?? DEFAULT_SPEED;
        const time = live.time ?? elapsed * 0.01;
        activeProgram.uniforms.uTime.value = time * speed * 0.1;
        activeProgram.uniforms.uAmplitude.value = live.amplitude ?? DEFAULT_AMPLITUDE;
        activeProgram.uniforms.uBlend.value = live.blend ?? DEFAULT_BLEND;
        applyStops(live.colorStops ?? DEFAULT_COLOR_STOPS);
        activeRenderer.render({ scene: activeMesh });
      };

      const resize = () => {
        const width = ctn.offsetWidth || window.innerWidth;
        const height = ctn.offsetHeight || window.innerHeight;
        activeRenderer.setSize(width, height);
        activeProgram.uniforms.uResolution.value = [width, height];
        if (!running) renderFrame();
      };

      const tick = (ts: number) => {
        if (disposed) return;
        frameId = requestAnimationFrame(tick);
        // clamp عشان الرجوع من tab في الخلفية ما يعملش قفزة في الزمن
        elapsed += Math.min(Math.max(ts - lastTs, 0), 64);
        lastTs = ts;
        renderFrame();
      };

      const start = () => {
        if (running || disposed || reduceMotion) return;
        running = true;
        lastTs = performance.now();
        frameId = requestAnimationFrame(tick);
      };

      const syncPlayback = () => {
        const shouldRun = inView && document.visibilityState === 'visible';
        if (shouldRun) start();
        else stop();
      };

      resize();

      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(ctn);

      if (typeof IntersectionObserver === 'function') {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            inView = entry.isIntersecting;
            syncPlayback();
          },
          { threshold: 0 }
        );
        intersectionObserver.observe(ctn);
      }

      onVisibilityChange = () => syncPlayback();
      document.addEventListener('visibilitychange', onVisibilityChange);

      if (reduceMotion) {
        // احترام تقليل الحركة: فريم ثابت واحد من غير أي أنيميشن.
        renderFrame();
      } else {
        syncPlayback();
      }
    } catch (err) {
      console.warn('[Aurora] WebGL unavailable — falling back to a static background.', err);
      cleanup();
      setUnsupported(true);
      return;
    }

    return cleanup;
  }, [colorStopsKey]);

  if (unsupported) {
    return <div className="aurora-container aurora-fallback" aria-hidden="true" />;
  }

  return <div ref={ctnDom} className="aurora-container" aria-hidden="true" />;
};

export default Aurora;
