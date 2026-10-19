import { translate, useLanguage } from "../../i18n/locale";
import { useEffect, useRef } from "react";
import { weatherStudio } from "../../lib/audio/weatherSynth";
export default function AudioOscilloscope({ active }: { active: boolean }) {
  const language = useLanguage();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext("2d")!,
      r = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio, 2);
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const width = r.width,
      height = r.height;
    let frame = 0;
    const wave = new Uint8Array(2048),
      bins = new Uint8Array(1024);
    const draw = () => {
      ctx.fillStyle = "#071a22";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#6bb8a51c";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const a = weatherStudio.getAnalyser();
      if (active && a) {
        a.getByteTimeDomainData(wave);
        a.getByteFrequencyData(bins);
        for (let i = 0; i < 48; i++) {
          const strength = bins[Math.floor((i * i) / 3)] / 255;
          ctx.fillStyle = `rgba(251,191,96,${0.12 + strength * 0.5})`;
          ctx.fillRect(
            (i * width) / 48,
            height,
            width / 55,
            -strength * height * 0.8,
          );
        }
      } else wave.fill(128);
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * width,
          y = height / 2 + ((wave[i] - 128) / 128) * height * 1.4;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = "#a2f4d6";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#81efd3";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#b8ead8";
      ctx.font = "14px monospace";
      ctx.fillText(
        translate(active ? "AETHERIS / SIGNAL LIVE" : "AETHERIS / WAITING FOR SIGNAL"),
        12,
        18,
      );
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    draw();
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) draw();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, language]);
  return (
    <canvas
      ref={ref}
      className="audio-oscilloscope"
      aria-label={
        active
          ? "Live audio waveform and frequency spectrum"
          : "Audio oscilloscope, start soundscape to display the signal"
      }
    />
  );
}
export function AudioEqualizer({ active }: { active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const bins = new Uint8Array(1024);
    const draw = () => {
      const a = weatherStudio.getAnalyser();
      if (a) {
        a.getByteFrequencyData(bins);
        const children = ref.current?.children;
        [4, 16, 36, 80].forEach((start, j) => {
          let sum = 0;
          for (let k = start; k < start + 12; k++) sum += bins[k];
          (children?.[j] as HTMLElement | undefined)?.style.setProperty(
            "height",
            `${5 + (sum / 12 / 255) * 20}px`,
          );
        });
      }
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    draw();
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) draw();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active]);
  return (
    <span
      className={`live-equalizer ${active ? "active" : ""}`}
      ref={ref}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <i key={i} />
      ))}
    </span>
  );
}
