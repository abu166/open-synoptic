import { useEffect, useRef } from "react";
import { solarPosition } from "../../lib/meteorology/ephemeris";
export interface SkyProps {
  code?: number;
  wind?: number;
  rain?: number;
  latitude?: number;
  longitude?: number;
  time?: number;
}
interface Particle {
  x: number;
  y: number;
  z: number;
  phase: number;
}
interface Splash {
  x: number;
  y: number;
  age: number;
  snow: boolean;
}
interface Border {
  x: number;
  y: number;
  width: number;
  id: number;
}
declare global {
  interface Window {
    __aetherisPerformance?: {
      fps: number;
      averageFrameMs: number;
      particles: number;
      frames: number;
    };
  }
}
export default function AtmosphericSkyCanvas({
  code = 3,
  wind = 10,
  rain = 0,
  latitude = 51,
  longitude = 71,
  time = Date.now(),
}: SkyProps) {
  const redraw = useRef<(() => void) | null>(null);
  const sky = useRef<HTMLCanvasElement>(null),
    fx = useRef<HTMLCanvasElement>(null),
    telemetry = useRef({ code, wind, rain, latitude, longitude, time });
  useEffect(() => {
    telemetry.current = { code, wind, rain, latitude, longitude, time };
    redraw.current?.();
  }, [code, wind, rain, latitude, longitude, time]);
  useEffect(() => {
    const canvas = sky.current!,
      foreground = fx.current!,
      ctx = canvas.getContext("2d", { alpha: false })!,
      particlesCtx = foreground.getContext("2d")!;
    let width = innerWidth,
      height = innerHeight,
      frame = 0,
      last = performance.now(),
      elapsed = 0,
      borders: Border[] = [],
      borderRefresh = 0,
      frames = 0,
      sampleStart = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drops: Particle[] = Array.from({ length: 340 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.25 + Math.random(),
        phase: Math.random() * 6.28,
      })),
      stars = Array.from({ length: 190 }, () => ({
        x: Math.random(),
        y: Math.random() * 0.85,
        z: Math.random(),
        phase: Math.random() * 6.28,
      })),
      splashes: Splash[] = [];
    const clouds = Array.from({ length: 3 }, (_, layer) => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 500;
      const g = c.getContext("2d")!;
      for (let i = 0; i < 24; i++) {
        const x = Math.random() * 1200,
          y = 120 + Math.random() * 230,
          r = 60 + Math.random() * 130,
          gradient = g.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(
          0,
          layer === 0 ? "rgba(237,245,255,.24)" : "rgba(208,221,240,.18)",
        );
        gradient.addColorStop(0.5, "rgba(210,224,242,.15)");
        gradient.addColorStop(1, "rgba(175,200,230,0)");
        g.fillStyle = gradient;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      return c;
    });
    const rayTexture = document.createElement("canvas");
    rayTexture.width = 512;
    rayTexture.height = 512;
    const rayContext = rayTexture.getContext("2d")!,
      rayPixels = rayContext.createImageData(512, 512);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const dx = (x - 256) / 256,
          dy = (y - 256) / 256,
          r = Math.hypot(dx, dy),
          a = Math.atan2(dy, dx),
          beam = Math.pow((Math.cos(a * 9) + 1) / 2, 22),
          intensity =
            (0.05 + beam * 0.32) *
            Math.exp(-r * r * 3) *
            (1 - Math.exp(-r * 8)),
          i = (y * 512 + x) * 4;
        rayPixels.data.set([255, 240, 204, Math.round(intensity * 255)], i);
      }
    rayContext.putImageData(rayPixels, 0, 0);
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio, 1.75);
      for (const c of [canvas, foreground]) {
        c.width = width * dpr;
        c.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      borderRefresh = 0;
    };
    resize();
    addEventListener("resize", resize);
    const refreshBorders = () => {
      borderRefresh = 0;
    };
    addEventListener("scroll", refreshBorders, { passive: true });
    let palette = [29, 77, 127],
      lastPalette = palette.slice();
    const render = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const data = telemetry.current,
        position = solarPosition(
          new Date(data.time),
          data.latitude,
          data.longitude,
        ),
        night = position.elevation < -6,
        golden = position.elevation >= -6 && position.elevation < 10,
        storm = data.code >= 95,
        snow =
          (data.code >= 70 && data.code < 80) ||
          data.code === 85 ||
          data.code === 86,
        wet = data.code >= 50 || data.rain > 0.02,
        cloudy = data.code >= 2;
      const target = storm
        ? [39, 48, 100]
        : night
          ? [9, 20, 57]
          : golden
            ? [153, 107, 133]
            : cloudy
              ? [43, 86, 135]
              : [36, 145, 211];
      palette = target.map(
        (v, i) => lastPalette[i] + (v - lastPalette[i]) * Math.min(1, dt * 2),
      );
      lastPalette = palette;
      const gradient = ctx.createLinearGradient(0, 0, width * 0.3, height);
      gradient.addColorStop(
        0,
        `rgb(${palette.map((n) => Math.round(n)).join(",")})`,
      );
      gradient.addColorStop(
        0.38,
        night ? "#172b54" : golden ? "#c49aa7" : cloudy ? "#5e89ab" : "#60b8e5",
      );
      gradient.addColorStop(
        0.7,
        night ? "#1f365b" : golden ? "#edba8a" : cloudy ? "#8aa9bb" : "#a5d8e9",
      );
      gradient.addColorStop(
        1,
        night ? "#111d3c" : golden ? "#a2859b" : cloudy ? "#6e91ac" : "#d5c8b0",
      );
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      const sunX =
          width * (0.5 + Math.sin((position.azimuth * Math.PI) / 180) * 0.32),
        sunY = height * Math.max(0.08, 0.5 - position.elevation / 130);
      if (!night) {
        const bloom = ctx.createRadialGradient(
          sunX,
          sunY,
          0,
          sunX,
          sunY,
          width * 0.6,
        );
        bloom.addColorStop(
          0,
          golden ? "#ffe8ad99" : cloudy ? "#fff9db66" : "#fff4bbaa",
        );
        bloom.addColorStop(0.24, "#fff5d52c");
        bloom.addColorStop(1, "#ffffff00");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(elapsed * 0.012);
        ctx.globalAlpha = cloudy ? 0.16 : golden ? 0.55 : 0.32;
        ctx.drawImage(rayTexture, -width, -width, width * 2, width * 2);
        ctx.restore();
      }
      if (cloudy || golden) {
        ctx.save();
        ctx.globalAlpha = night ? 0.18 : storm ? 0.4 : 0.47;
        clouds.forEach((cloud, j) => {
          const scale = 1.15 + j * 0.4,
            cloudWidth = width * scale,
            x = (elapsed * (data.wind * 0.25 + 4) * (j + 1)) % cloudWidth;
          for (let tile = -1; tile <= 1; tile++)
            ctx.drawImage(
              cloud,
              x + tile * cloudWidth - width * 0.3,
              -height * 0.15 + j * height * 0.21,
              cloudWidth,
              height * 0.64,
            );
        });
        ctx.restore();
      }
      if (night) {
        for (const star of stars) {
          ctx.globalAlpha =
            (cloudy ? 0.04 : 0.4) + Math.sin(elapsed * 0.6 + star.phase) * 0.15;
          ctx.fillStyle = "#eff5ff";
          ctx.beginPath();
          ctx.arc(
            star.x * width,
            star.y * height,
            0.4 + star.z * 1.2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        if (Math.abs(data.latitude) > 58 && data.code < 3) {
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.strokeStyle = "#7decd2";
          ctx.lineWidth = 35;
          ctx.shadowColor = "#77e4c9";
          ctx.shadowBlur = 30;
          ctx.beginPath();
          for (let x = 0; x < width; x += 20)
            ctx.lineTo(
              x,
              height * 0.23 +
                Math.sin(x * 0.004 + elapsed * 0.08) * height * 0.08,
            );
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      particlesCtx.clearRect(0, 0, width, height);
      if (!borderRefresh || now - borderRefresh > 800) {
        borders = Array.from(
          document.querySelectorAll<HTMLElement>(".glass-card,.hero-card"),
        )
          .map((el, id) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.top, width: r.width, id };
          })
          .filter((r) => r.y > 0 && r.y < height);
        borderRefresh = now;
      }
      const count = wet
        ? Math.round(Math.min(340, snow ? 170 : 120 + data.rain * 65))
        : 0;
      for (let j = 0; j < count; j++) {
        const p = drops[j],
          oldY = p.y;
        p.y += dt * (snow ? 24 : 640) * p.z;
        p.x +=
          dt *
          (data.wind * (snow ? 1.2 : 4) +
            Math.sin(elapsed + p.phase) * (snow ? 15 : 0));
        if (p.x > width + 30) p.x = -30;
        if (p.y > height + 30) {
          p.y = -30;
          p.x = Math.random() * width;
        }
        const hit = borders.find(
          (b) =>
            oldY < b.y &&
            p.y >= b.y &&
            p.x > b.x + 12 &&
            p.x < b.x + b.width - 12,
        );
        if (hit) {
          splashes.push({ x: p.x, y: hit.y, age: 0, snow });
          p.y = -20;
          p.x = Math.random() * width;
        }
        particlesCtx.globalAlpha = snow ? 0.35 + p.z * 0.3 : 0.15 + p.z * 0.15;
        particlesCtx.strokeStyle = "#e9f6ff";
        particlesCtx.fillStyle = "#f6fbff";
        particlesCtx.lineWidth = snow ? 1 : Math.max(0.6, p.z);
        particlesCtx.beginPath();
        if (snow) {
          particlesCtx.arc(p.x, p.y, 1.4 * p.z, 0, 6.28);
          particlesCtx.fill();
        } else {
          particlesCtx.moveTo(p.x, p.y);
          particlesCtx.lineTo(p.x - data.wind * 0.12, p.y - 18 * p.z);
          particlesCtx.stroke();
        }
      }
      for (let j = splashes.length - 1; j >= 0; j--) {
        const p = splashes[j];
        p.age += dt;
        if (p.age > (p.snow ? 8 : 0.55)) {
          splashes.splice(j, 1);
          continue;
        }
        particlesCtx.globalAlpha = (1 - p.age / (p.snow ? 8 : 0.55)) * 0.55;
        particlesCtx.strokeStyle = "#effaff";
        particlesCtx.lineWidth = p.snow ? 2 : 1;
        particlesCtx.beginPath();
        if (p.snow)
          particlesCtx.ellipse(p.x, p.y, 4 + p.age * 0.3, 1, 0, 0, Math.PI * 2);
        else {
          const radius = 2 + p.age * 22;
          particlesCtx.ellipse(
            p.x,
            p.y,
            radius,
            radius * 0.22,
            0,
            Math.PI,
            Math.PI * 2,
          );
          particlesCtx.moveTo(p.x - radius * 0.6, p.y - p.age * 15);
          particlesCtx.lineTo(p.x - radius * 0.9, p.y - p.age * 20);
        }
        particlesCtx.stroke();
      }
      if (storm && Math.random() < dt * 0.12) {
        ctx.fillStyle = "#e8eaff";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      particlesCtx.globalAlpha = 1;
      frames++;
      if (now - sampleStart > 2000) {
        window.__aetherisPerformance = {
          fps: Math.round((frames * 1000) / (now - sampleStart)),
          averageFrameMs: (now - sampleStart) / frames,
          particles: count,
          frames,
        };
        frames = 0;
        sampleStart = now;
      }
      const theme = night
        ? "night"
        : golden
          ? "golden"
          : storm
            ? "storm"
            : cloudy
              ? "silver"
              : "sunny";
      if (document.documentElement.dataset.sky !== theme)
        document.documentElement.dataset.sky = theme;
      if (!reduced && !document.hidden) frame = requestAnimationFrame(render);
    };
    redraw.current = () => {
      if (reduced) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
      }
    };
    const visibility = () => {
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(render);
    return () => {
      redraw.current = null;
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      removeEventListener("scroll", refreshBorders);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <>
      <canvas ref={sky} className="atmosphere" aria-hidden="true" />
      <canvas ref={fx} className="weather-particles" aria-hidden="true" />
    </>
  );
}
