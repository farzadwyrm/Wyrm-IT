"use client";

import { useEffect, useRef } from "react";

export type RingMode =
  | "idle"
  | "connecting"
  | "speaking"
  | "listening"
  | "thinking"
  | "muted"
  | "ended";

interface ModeStyle {
  /** Ring radius as a share of the canvas half-size. */
  radius: number;
  /** How far the audio level deforms the ring. */
  amplitude: number;
  /** Number of bulges around the ring: few = calm receptionist voice, more = visitor voice. */
  lobes: number;
  /** Idle wobble. */
  noise: number;
  colour: "ember" | "ink" | "inkMuted";
  fill: boolean;
}

const STYLES: Record<RingMode, ModeStyle> = {
  idle: { radius: 0.62, amplitude: 0, lobes: 3, noise: 0.008, colour: "inkMuted", fill: false },
  connecting: { radius: 0.6, amplitude: 0, lobes: 3, noise: 0.01, colour: "inkMuted", fill: false },
  speaking: { radius: 0.62, amplitude: 0.2, lobes: 3, noise: 0.015, colour: "ember", fill: true },
  listening: { radius: 0.6, amplitude: 0.24, lobes: 6, noise: 0.012, colour: "ink", fill: false },
  thinking: { radius: 0.55, amplitude: 0, lobes: 3, noise: 0.01, colour: "inkMuted", fill: false },
  muted: { radius: 0.58, amplitude: 0, lobes: 3, noise: 0, colour: "inkMuted", fill: false },
  ended: { radius: 0.05, amplitude: 0, lobes: 3, noise: 0, colour: "inkMuted", fill: false },
};

interface Palette {
  ember: string;
  ink: string;
  inkMuted: string;
  moss: string;
}

function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  // Fallbacks only matter if the theme failed to load; colours normally come from tokens.
  return {
    ember: get("--color-ember", "orange"),
    ink: get("--color-ink", "black"),
    inkMuted: get("--color-ink-muted", "gray"),
    moss: get("--color-moss", "green"),
  };
}

const POINTS = 96;

/**
 * The "Tide ring": a soft, living ring that shows who is talking. Ember with a filled core when
 * the receptionist speaks (driven by a simulated speaking envelope), ink with quicker ripples when
 * the visitor speaks (driven by the real microphone level), an orbiting comet while thinking.
 * Decorative only (aria-hidden): the call state is always also shown as text.
 */
export function TideRing({
  mode,
  getLevel,
  pulse = 0,
  size = 240,
  className = "",
}: {
  mode: RingMode;
  getLevel: () => number;
  /** Increment to play a one-off green "booked" pulse. */
  pulse?: number;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const getLevelRef = useRef(getLevel);
  const pulseAt = useRef(Number.NEGATIVE_INFINITY);
  const lastPulse = useRef(pulse);

  modeRef.current = mode;
  getLevelRef.current = getLevel;
  if (pulse !== lastPulse.current) {
    lastPulse.current = pulse;
    pulseAt.current = typeof performance === "undefined" ? 0 : performance.now();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.scale(dpr, dpr);

    let palette = readPalette(document.documentElement);
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      palette = readPalette(document.documentElement);
    };
    dark.addEventListener("change", onScheme);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    observer.observe(canvas);

    // Animated values ease towards the current mode's style so transitions feel organic.
    const current = { ...STYLES[modeRef.current] };
    let level = 0;
    let steppedLevel = 0;
    let lastStep = 0;
    let raf = 0;

    const centre = size / 2;
    const half = size / 2;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;

      const m = modeRef.current;
      const target = STYLES[m];
      const ease = reduced.matches ? 1 : 0.08;
      current.radius += (target.radius - current.radius) * ease;
      current.amplitude += (target.amplitude - current.amplitude) * ease;
      current.noise += (target.noise - current.noise) * ease;

      const raw = Math.max(0, Math.min(1, getLevelRef.current()));
      level += (raw - level) * (raw > level ? 0.35 : 0.08); // fast attack, slow release

      ctx.clearRect(0, 0, size, size);
      const colour = palette[target.colour];

      if (reduced.matches) {
        // Static ring; only thickness changes in three steps, at most 4 times a second.
        if (now - lastStep > 250) {
          steppedLevel = level < 0.15 ? 0 : level < 0.5 ? 1 : 2;
          lastStep = now;
        }
        const r = half * Math.max(0.05, target.radius);
        ctx.beginPath();
        ctx.arc(centre, centre, r, 0, Math.PI * 2);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2 + steppedLevel * 2;
        ctx.stroke();
        return;
      }

      const t = now / 1000;
      const baseR = half * current.radius;

      // Halo: a soft glow that breathes with the level.
      if (m === "speaking" || m === "listening") {
        const halo = ctx.createRadialGradient(centre, centre, baseR * 0.6, centre, centre, half);
        halo.addColorStop(0, colour);
        halo.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.06 + 0.22 * level;
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }

      // Breathing while waiting for the visitor to speak.
      const breathe = m === "listening" ? 1 + 0.02 * Math.sin(t * ((2 * Math.PI) / 4)) : 1;

      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const theta = (i / POINTS) * Math.PI * 2;
        const wobble =
          current.noise *
          (Math.sin(theta * 3 + t * 0.9) +
            0.6 * Math.sin(theta * 5 - t * 1.3) +
            0.4 * Math.sin(theta * 2 + t * 0.4));
        const audio =
          level *
          current.amplitude *
          (0.6 + 0.4 * Math.sin(target.lobes * theta + t * 1.5)) *
          (0.85 + 0.15 * Math.sin(theta * 7 - t * 3));
        const r = baseR * breathe * (1 + wobble + audio);
        const x = centre + r * Math.cos(theta);
        const y = centre + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (target.fill) {
        ctx.globalAlpha = 0.12 + 0.1 * level;
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = m === "speaking" || m === "listening" ? 2.5 + 2 * level : 2;
      ctx.stroke();

      // Connecting: a rotating dashed arc and expanding ripples, like a call going out.
      if (m === "connecting") {
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = -t * 40;
        ctx.beginPath();
        ctx.arc(centre, centre, baseR * 1.18, 0, Math.PI * 2);
        ctx.strokeStyle = palette.inkMuted;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        const ripple = (t % 1.2) / 1.2;
        ctx.globalAlpha = 1 - ripple;
        ctx.beginPath();
        ctx.arc(centre, centre, baseR * (1 + ripple * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = palette.ember;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Thinking: a short comet orbiting the ring (only while a request is really in flight).
      if (m === "thinking") {
        const angle = ((t % 1.2) / 1.2) * Math.PI * 2;
        for (let k = 0; k < 14; k++) {
          const a = angle - k * 0.06;
          ctx.globalAlpha = 1 - k / 14;
          ctx.beginPath();
          ctx.arc(
            centre + baseR * 1.16 * Math.cos(a),
            centre + baseR * 1.16 * Math.sin(a),
            3 - k * 0.15,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = palette.ember;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // One-off "booked" pulse in moss.
      const sincePulse = (now - pulseAt.current) / 900;
      if (sincePulse >= 0 && sincePulse < 1) {
        ctx.globalAlpha = 1 - sincePulse;
        ctx.beginPath();
        ctx.arc(centre, centre, baseR * (1 + sincePulse * 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = palette.moss;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      dark.removeEventListener("change", onScheme);
    };
  }, [size]);

  return (
    // Decorative: the wrapper hides it from assistive technology; state is shown as text.
    <div aria-hidden="true" className={className}>
      <canvas
        ref={canvasRef}
        // Scales down on narrow phones while keeping a crisp square.
        style={{ width: `min(${size}px, 55vw)`, aspectRatio: "1 / 1" }}
      />
    </div>
  );
}
