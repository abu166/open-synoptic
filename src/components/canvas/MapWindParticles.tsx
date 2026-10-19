import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Map as LibreMap } from "maplibre-gl";
import { fetchWindSamples } from "../../api/openMeteoClient";
import {
  bicubic,
  fieldColor,
  windColor,
  type MapFieldMode,
} from "../../lib/meteorology/vectorField";
import { currentIndex, value, type Forecast } from "../../types/telemetry";
export default function MapWindParticles({
  map,
  time,
  mode = "wind",
  weather,
  enabled = true,
}: {
  map: LibreMap;
  time: number;
  mode?: MapFieldMode;
  weather: Forecast;
  enabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    heat = useRef<HTMLCanvasElement>(null),
    [bounds, setBounds] = useState(() => map.getBounds()),
    [size, setSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBounds(map.getBounds()), 900);
    };
    map.on("moveend", update);
    const resize = () => {
      const r = map.getContainer().getBoundingClientRect();
      setSize({ width: r.width, height: r.height });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    return () => {
      clearTimeout(timer);
      map.off("moveend", update);
      observer.disconnect();
    };
  }, [map]);
  const points = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        latitude: Math.max(
          -84,
          Math.min(
            84,
            bounds.getNorth() -
              ((bounds.getNorth() - bounds.getSouth()) * Math.floor(i / 4)) / 3,
          ),
        ),
        longitude:
          ((bounds.getWest() +
            ((bounds.getEast() - bounds.getWest()) * (i % 4)) / 3 +
            540) %
            360) -
          180,
      })),
    [bounds],
  );
  const query = useQuery({
    queryKey: [
      "spatial-field-v4",
      points
        .map((p) => `${p.latitude.toFixed(1)},${p.longitude.toFixed(1)}`)
        .join("|"),
    ],
    queryFn: ({ signal }) => fetchWindSamples(points, signal),
    staleTime: 1800000,
    refetchInterval: (query) => (query.state.data ? 1800000 : 180000),
    retry: false,
  });
  const latest = useRef({ time, weather });
  latest.current = { time, weather };
  const hour = Math.floor(time / 3600000);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext("2d")!,
      h = heat.current!,
      hc = h.getContext("2d")!,
      dpr = Math.min(devicePixelRatio, 1.5);
    c.width = Math.round(size.width * dpr);
    c.height = Math.round(size.height * dpr);
    h.width = 80;
    h.height = 56;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = latest.current.weather,
      wi = currentIndex(w),
      grids = {
        u: [] as number[],
        v: [] as number[],
        temperature: [] as number[],
        cloud: [] as number[],
      };
    for (let j = 0; j < 16; j++) {
      const sample = query.data?.[j],
        k =
          sample?.hourly.time.findIndex(
            (t) => t * 1000 >= latest.current.time,
          ) ?? -1,
        speed =
          (k >= 0
            ? sample?.hourly.wind_speed_10m[k]
            : sample?.current.wind_speed_10m) ?? w.current.wind_speed_10m,
        direction =
          (k >= 0
            ? sample?.hourly.wind_direction_10m[k]
            : sample?.current.wind_direction_10m) ??
          w.current.wind_direction_10m,
        a = (direction * Math.PI) / 180;
      grids.u.push(-Math.sin(a) * speed);
      grids.v.push(Math.cos(a) * speed);
      grids.temperature.push(
        (k >= 0
          ? sample?.hourly.temperature_2m[k]
          : sample?.current.temperature_2m) ?? w.current.temperature_2m,
      );
      grids.cloud.push(
        (k >= 0
          ? sample?.hourly.cloud_cover[k]
          : sample?.current.cloud_cover) ?? value(w.hourly, "cloud_cover", wi),
      );
    }
    const cols = 80,
      rows = 56,
      field = new Float32Array(cols * rows * 3),
      image = hc.createImageData(cols, rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const geo = map.unproject([
            (x / (cols - 1)) * size.width,
            (y / (rows - 1)) * size.height,
          ]),
          u = Math.max(
            0,
            Math.min(
              3,
              ((geo.lng - bounds.getWest()) /
                (bounds.getEast() - bounds.getWest())) *
                3,
            ),
          ),
          v = Math.max(
            0,
            Math.min(
              3,
              ((bounds.getNorth() - geo.lat) /
                (bounds.getNorth() - bounds.getSouth())) *
                3,
            ),
          ),
          dx = bicubic(grids.u, 4, 4, u, v),
          dy = bicubic(grids.v, 4, 4, u, v),
          speed = Math.hypot(dx, dy),
          i = y * cols + x;
        field[i * 3] = dx;
        field[i * 3 + 1] = dy;
        field[i * 3 + 2] = speed;
        const n =
            mode === "temperature"
              ? bicubic(grids.temperature, 4, 4, u, v)
              : mode === "cloud"
                ? Math.max(0, Math.min(100, bicubic(grids.cloud, 4, 4, u, v)))
                : speed,
          color = fieldColor(mode, n);
        image.data.set(
          [...color, mode === "radar" ? 0 : mode === "cloud" ? 110 : 125],
          i * 4,
        );
      }
    hc.putImageData(image, 0, 0);
    const vector = (x: number, y: number) => {
      const gx = Math.max(
          0,
          Math.min(cols - 1.001, (x / size.width) * (cols - 1)),
        ),
        gy = Math.max(
          0,
          Math.min(rows - 1.001, (y / size.height) * (rows - 1)),
        ),
        ix = Math.floor(gx),
        iy = Math.floor(gy),
        tx = gx - ix,
        ty = gy - iy;
      return [0, 1, 2].map((component) => {
        const at = (xx: number, yy: number) =>
          field[(yy * cols + xx) * 3 + component];
        return (
          (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) +
          (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty
        );
      });
    };
    const particles = Array.from({ length: 1400 }, () => ({
        x: Math.random() * size.width,
        y: Math.random() * size.height,
        age: Math.random() * 7,
      })),
      palette = [5, 17, 35, 50, 75].map(windColor);
    let frame = 0,
      last = performance.now(),
      sampleStart = last,
      frames = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (now: number) => {
      const dt = Math.min(0.045, (now - last) / 1000);
      last = now;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,.95)";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.15;
      const paths = palette.map(() => new Path2D());
      if (enabled)
        for (const p of particles) {
          p.age += dt;
          if (
            p.age > 7 ||
            p.x < 0 ||
            p.y < 0 ||
            p.x > size.width ||
            p.y > size.height
          ) {
            p.x = Math.random() * size.width;
            p.y = Math.random() * size.height;
            p.age = 0;
          }
          const [u, v, s] = vector(p.x, p.y),
            mid = vector(p.x + u * dt, p.y + v * dt),
            nx = p.x + mid[0] * dt * 2,
            ny = p.y + mid[1] * dt * 2,
            index = s < 10 ? 0 : s < 25 ? 1 : s < 45 ? 2 : s < 65 ? 3 : 4;
          paths[index].moveTo(p.x, p.y);
          paths[index].quadraticCurveTo(p.x + u * dt, p.y + v * dt, nx, ny);
          p.x = nx;
          p.y = ny;
        }
      paths.forEach((path, j) => {
        ctx.strokeStyle = palette[j];
        ctx.globalAlpha = 0.68;
        ctx.stroke(path);
      });
      ctx.globalAlpha = 1;
      frames++;
      if (now - sampleStart > 2000) {
        window.__aetherisWindPerformance = {
          fps: Math.round((frames * 1000) / (now - sampleStart)),
          particles: particles.length,
        };
        sampleStart = now;
        frames = 0;
      }
      if (!document.hidden && onScreen && !reduced)
        frame = requestAnimationFrame(render);
    };
    let onScreen = true;
    frame = requestAnimationFrame(render);
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && onScreen) {
        last = performance.now();
        frame = requestAnimationFrame(render);
      }
    };
    const viewportObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      visibility();
    });
    if (canvas.current) viewportObserver.observe(canvas.current);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      viewportObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [map, query.data, size, hour, mode, bounds, enabled]);
  return (
    <>
      <canvas ref={heat} className="map-field-heatmap" aria-hidden="true" />
      <canvas
        ref={canvas}
        className="map-wind-particles vivid-flow"
        aria-hidden="true"
      />
      <span className="wind-field-caption">
        {query.data
          ? "16-point forecast field · bicubic interpolation"
          : "Local forecast projection · spatial field warming up"}
        {mode === "temperature"
          ? " · °C"
          : mode === "cloud"
            ? " · cloud %"
            : " · cyan calm / emerald breeze / gold gusts"}
      </span>
    </>
  );
}
declare global {
  interface Window {
    __aetherisWindPerformance?: { fps: number; particles: number };
  }
}
