import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Plus, Minus, Globe2 } from "lucide-react";
import {
  fetchCityBatch,
  cityBatchKey,
  fetchWindSamples,
  request,
} from "../../api/openMeteoClient";
import { cityMoment, initialCityTelemetry } from "../../api/resilience";
import { reverseGeocode } from "../../api/nominatimClient";
import { useWeatherStore } from "../../store/useWeatherStore";
import { solarPosition } from "../../lib/meteorology/ephemeris";
import { fmt, temperature } from "../../lib/units/converter";
import type { City } from "../../types/telemetry";
interface Geography {
  features: Array<{
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
  }>;
}
interface Beacon {
  city: City;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  temperature: number;
  visible: boolean;
}
const vertex = `attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}`;
const fragment = `precision highp float;
uniform vec2 uResolution;uniform mat3 uCamera;uniform vec3 uSun;uniform sampler2D uEarth;uniform sampler2D uWind;uniform float uTime;uniform float uZoom;uniform float uWindReady;
const float PI=3.14159265359;
void main(){vec2 p=(gl_FragCoord.xy-uResolution*.5)/(min(uResolution.x,uResolution.y)/2.6)*vec2(1.,1.)/uZoom;float r=length(p);vec3 cameraSun=vec3(dot(uCamera[0],uSun),dot(uCamera[1],uSun),dot(uCamera[2],uSun));
if(r>1.){float halo=exp(-(r-1.)*42.)*.38;float lit=dot(normalize(vec3(p,.05)),cameraSun);vec3 haloColor=mix(vec3(.18,.12,.49),vec3(.08,.62,1.),smoothstep(-.25,.45,lit));haloColor=mix(haloColor,vec3(1.,.37,.14),exp(-abs(lit)*12.)*.85);float alpha=halo*(1.-smoothstep(1.01,1.14,r));gl_FragColor=vec4(haloColor*alpha,alpha);return;}
vec3 normal=vec3(p,sqrt(max(0.,1.-dot(p,p))));vec3 world=normalize(uCamera*normal);vec2 uv=vec2(atan(world.z,world.x)/(2.*PI)+.5,.5-asin(world.y)/PI);vec3 tex=texture2D(uEarth,uv).rgb;float light=dot(world,uSun);float day=smoothstep(-.08,.22,light);float diffuse=.12+max(0.,light)*.88;vec3 base=tex*diffuse;float ocean=1.-smoothstep(.25,.37,tex.g);vec3 reflected=reflect(-uSun,world);vec3 view=normalize(uCamera[2]);float spec=pow(max(0.,dot(reflected,view)),36.)*ocean*.55;float rim=pow(1.-normal.z,3.);vec3 color=base+vec3(.42,.76,.96)*spec;
float twilight=exp(-abs(light+.025)*22.);color+=vec3(.83,.27,.15)*twilight*.16;color=mix(color*.78,color,day);color+=mix(vec3(.14,.18,.65),vec3(.12,.66,.96),day)*rim*.30;
vec3 field=texture2D(uWind,uv).rgb;vec2 flow=(field.rg-.5)*2.;float speed=field.b;vec2 advected=uv-flow*uTime*.0007;float stripe=sin(advected.y*160.+sin(advected.x*35.)*1.8+flow.x*3.);float dash=pow(max(0.,sin(advected.x*190.-uTime*(.6+speed*2.))),8.);float ribbon=pow(max(0.,stripe),35.)*dash*uWindReady;vec3 windColor=mix(vec3(.12,.75,.98),vec3(.25,1.,.66),smoothstep(.08,.25,speed));windColor=mix(windColor,vec3(1.,.68,.18),smoothstep(.3,.6,speed));color+=windColor*ribbon*(.18+normal.z*.45);gl_FragColor=vec4(color,1.);}`;
function basis(lon: number, lat: number) {
  const l = (lon * Math.PI) / 180,
    p = (lat * Math.PI) / 180;
  return {
    east: [-Math.sin(l), 0, Math.cos(l)],
    north: [
      -Math.sin(p) * Math.cos(l),
      Math.cos(p),
      -Math.sin(p) * Math.sin(l),
    ],
    front: [Math.cos(p) * Math.cos(l), Math.sin(p), Math.cos(p) * Math.sin(l)],
  };
}
const dot = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + v * b[i], 0);
export default function InteractivePlanetaryGlobe({
  city,
  time = Date.now(),
}: {
  city: City;
  time?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    rotation = useRef({ lon: city.longitude, lat: city.latitude * 0.6 }),
    target = useRef({ ...rotation.current }),
    pointer = useRef<{
      x: number;
      y: number;
      startX: number;
      startY: number;
    } | null>(null),
    zoom = useRef(1),
    sequence = useRef(0),
    frameData = useRef<{
      geography?: Geography;
      time: number;
      winds?: Awaited<ReturnType<typeof fetchWindSamples>>;
    }>({ time }),
    [beacons, setBeacons] = useState<Beacon[]>([]),
    [error, setError] = useState(""),
    store = useWeatherStore();
  const cities = [...store.saved].sort(
    (a, b) => a.latitude - b.latitude || a.longitude - b.longitude,
  );
  const cityQuery = useQuery({
    queryKey: cityBatchKey(cities),
    queryFn: ({ signal }) => fetchCityBatch(cities, signal),
    staleTime: 600000,
    initialData: () => cities.map((c) => initialCityTelemetry(c)),
    initialDataUpdatedAt: 0,
  });
  const snapshots = useRef(cityQuery.data);
  snapshots.current = cityQuery.data;
  const geography = useQuery({
    queryKey: ["world-coastlines"],
    queryFn: ({ signal }) =>
      request<Geography>(
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
        signal,
      ),
    staleTime: Infinity,
  });
  const winds = useQuery({
    queryKey: ["planetary-surface-wind-v4"],
    queryFn: ({ signal }) =>
      fetchWindSamples(
        Array.from({ length: 48 }, (_, i) => ({
          latitude: 75 - Math.floor(i / 8) * 30,
          longitude: -157.5 + (i % 8) * 45,
        })),
        signal,
      ),
    staleTime: 1800000,
    refetchInterval: (query) => (query.state.data ? 1800000 : 180000),
    retry: false,
  });
  frameData.current = { geography: geography.data, time, winds: winds.data };
  useEffect(() => {
    target.current = { lon: city.longitude, lat: city.latitude * 0.6 };
  }, [city.latitude, city.longitude]);
  useEffect(() => {
    const c = canvas.current!,
      host = container.current!,
      gl = c.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      });
    if (!gl) {
      setError(
        "This browser cannot open the 3D renderer. Try a WebGL-enabled browser.",
      );
      return;
    }
    function shader(type: number, source: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, source);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS))
        throw new Error(gl!.getShaderInfoLog(s) || "Shader compilation failed");
      return s;
    }
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      const vs = shader(gl.VERTEX_SHADER, vertex),
        fs = shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Planet renderer link failed");
    } catch (e) {
      setError(String(e));
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(
      [
        "uResolution",
        "uCamera",
        "uSun",
        "uTime",
        "uZoom",
        "uWindReady",
        "uEarth",
        "uWind",
      ].map((k) => [k, gl.getUniformLocation(program, k)]),
    );
    const texture = (unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const earth = texture(0),
      wind = texture(1);
    gl.uniform1i(uniforms.uEarth, 0);
    gl.uniform1i(uniforms.uWind, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      8,
      6,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(8 * 6 * 4).fill(128),
    );
    let previousGeography: Geography | undefined,
      previousWinds: unknown,
      previousHour = -1,
      width = 1,
      height = 1,
      frame = 0,
      last = performance.now(),
      labelTick = 0,
      performanceStart = last,
      renderedFrames = 0,
      beaconCount = 0;
    const earthCanvas = document.createElement("canvas");
    earthCanvas.width = 2048;
    earthCanvas.height = 1024;
    const paintEarth = () => {
      const ctx = earthCanvas.getContext("2d")!;
      ctx.fillStyle = "#14344c";
      ctx.fillRect(0, 0, 2048, 1024);
      const world = frameData.current.geography;
      if (world)
        for (const feature of world.features) {
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates as number[][][]]
              : (feature.geometry.coordinates as number[][][][]);
          for (const polygon of polygons) {
            ctx.beginPath();
            for (const ring of polygon) {
              for (let i = 0; i < ring.length; i++) {
                const [lon, lat] = ring[i],
                  x = ((lon + 180) / 360) * 2048,
                  y = ((90 - lat) / 180) * 1024;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.closePath();
            }
            ctx.fillStyle = "#549389";
            ctx.fill("evenodd");
            ctx.strokeStyle = "#87b4a7";
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      ctx.strokeStyle = "#8ccee322";
      ctx.lineWidth = 0.65;
      for (let lon = -180; lon <= 180; lon += 15) {
        const x = ((lon + 180) / 360) * 2048;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        const y = ((90 - lat) / 180) * 1024;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(2048, y);
        ctx.stroke();
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, earth);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        earthCanvas,
      );
    };
    paintEarth();
    const resize = () => {
      const r = host.getBoundingClientRect();
      width = r.width;
      height = r.height;
      const dpr = Math.min(devicePixelRatio, 1.75);
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      gl.viewport(0, 0, c.width, c.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const data = frameData.current;
      if (data.geography !== previousGeography) {
        previousGeography = data.geography;
        paintEarth();
      }
      rotation.current.lon +=
        (target.current.lon - rotation.current.lon) * Math.min(1, dt * 5);
      rotation.current.lat +=
        (target.current.lat - rotation.current.lat) * Math.min(1, dt * 5);
      const b = basis(rotation.current.lon, rotation.current.lat),
        sun = solarPosition(new Date(data.time), 0, 0),
        el = (sun.elevation * Math.PI) / 180,
        az = (sun.azimuth * Math.PI) / 180;
      const hour = Math.floor(data.time / 3600000);
      if (
        data.winds &&
        (previousWinds !== data.winds || previousHour !== hour)
      ) {
        previousWinds = data.winds;
        previousHour = hour;
        const pixels = new Uint8Array(8 * 6 * 4);
        data.winds.forEach((w, i) => {
          const k = w.hourly.time.findIndex((t) => t * 1000 >= data.time),
            speed =
              k >= 0
                ? (w.hourly.wind_speed_10m[k] ?? w.current.wind_speed_10m)
                : w.current.wind_speed_10m,
            direction =
              k >= 0
                ? (w.hourly.wind_direction_10m[k] ??
                  w.current.wind_direction_10m)
                : w.current.wind_direction_10m;
          const a = (direction * Math.PI) / 180;
          pixels[i * 4] = Math.round(
            Math.max(
              0,
              Math.min(255, 128 - ((Math.sin(a) * speed) / 100) * 127),
            ),
          );
          pixels[i * 4 + 1] = Math.round(
            Math.max(
              0,
              Math.min(255, 128 - ((Math.cos(a) * speed) / 100) * 127),
            ),
          );
          pixels[i * 4 + 2] = Math.round(Math.min(255, (speed / 100) * 255));
          pixels[i * 4 + 3] = 255;
        });
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, wind);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          8,
          6,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
      }
      gl.uniform2f(uniforms.uResolution, c.width, c.height);
      gl.uniformMatrix3fv(
        uniforms.uCamera,
        false,
        new Float32Array([...b.east, ...b.north, ...b.front]),
      );
      gl.uniform3f(
        uniforms.uSun,
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
        Math.cos(el) * Math.sin(az),
      );
      gl.uniform1f(uniforms.uTime, reduced ? 0 : now / 1000);
      gl.uniform1f(uniforms.uZoom, zoom.current);
      gl.uniform1f(uniforms.uWindReady, data.winds ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (now - labelTick > 75) {
        labelTick = now;
        const radius = (Math.min(width, height) / 2.6) * zoom.current,
          labels: Beacon[] = [];
        for (const row of snapshots.current) {
          const lat = (row.city.latitude * Math.PI) / 180,
            lon = (row.city.longitude * Math.PI) / 180,
            v = [
              Math.cos(lat) * Math.cos(lon),
              Math.sin(lat),
              Math.cos(lat) * Math.sin(lon),
            ],
            z = dot(v, b.front);
          if (z < 0.08) continue;
          const x = width / 2 + dot(v, b.east) * radius,
            y = height / 2 - dot(v, b.north) * radius;
          const labelX = Math.max(
            6,
            Math.min(width - 140, x > width / 2 ? x + 16 : x - 145),
          );
          let labelY = Math.max(8, Math.min(height - 45, y - 15));
          for (let pass = 0; pass < 15; pass++) {
            const collision = labels.find(
              (p) =>
                Math.abs(p.labelX - labelX) < 145 &&
                Math.abs(p.labelY - labelY) < 43,
            );
            if (!collision) break;
            labelY = collision.labelY + 45;
            if (labelY > height - 45) labelY = Math.max(8, y - 60 - pass * 45);
          }
          labels.push({
            city: row.city,
            x,
            y,
            labelX,
            labelY,
            visible: true,
            temperature: cityMoment(row, (data.time - row.time) / 3600000)
              .temperature,
          });
        }
        beaconCount = labels.length;
        setBeacons(labels);
      }
      renderedFrames++;
      if (now - performanceStart > 2000) {
        window.__aetherisGlobePerformance = {
          fps: Math.round((renderedFrames * 1000) / (now - performanceStart)),
          beacons: beaconCount,
        };
        performanceStart = now;
        renderedFrames = 0;
      }
      if (!document.hidden && onScreen) frame = requestAnimationFrame(render);
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
      observer.disconnect();
      cancelAnimationFrame(frame);
      viewportObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      gl.deleteTexture(earth);
      gl.deleteTexture(wind);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);
  const select = (c: City) => {
    target.current = { lon: c.longitude, lat: c.latitude };
    store.setCity(c);
  };
  return (
    <div className="planetary-globe" ref={container}>
      <canvas
        ref={canvas}
        aria-label="Interactive 3D Earth. Drag to orbit, click a point to inspect its weather, or use arrow keys."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key.startsWith("Arrow")) {
            e.preventDefault();
            target.current.lon +=
              e.key === "ArrowRight" ? 12 : e.key === "ArrowLeft" ? -12 : 0;
            target.current.lat = Math.max(
              -80,
              Math.min(
                80,
                target.current.lat +
                  (e.key === "ArrowUp" ? 8 : e.key === "ArrowDown" ? -8 : 0),
              ),
            );
          }
        }}
        onPointerDown={(e) => {
          pointer.current = {
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current;
          if (p) {
            target.current.lon -= (e.clientX - p.x) * 0.35;
            target.current.lat = Math.max(
              -80,
              Math.min(80, target.current.lat + (e.clientY - p.y) * 0.25),
            );
            p.x = e.clientX;
            p.y = e.clientY;
          }
        }}
        onPointerUp={(e) => {
          const p = pointer.current;
          pointer.current = null;
          if (!p || Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 6)
            return;
          const rect = e.currentTarget.getBoundingClientRect(),
            r = (Math.min(rect.width, rect.height) / 2.6) * zoom.current,
            x = (e.clientX - rect.left - rect.width / 2) / r,
            y = -(e.clientY - rect.top - rect.height / 2) / r;
          if (x * x + y * y > 1) return;
          const z = Math.sqrt(1 - x * x - y * y),
            b = basis(rotation.current.lon, rotation.current.lat),
            world = b.front.map(
              (_, i) => b.east[i] * x + b.north[i] * y + b.front[i] * z,
            ),
            latitude = (Math.asin(world[1]) * 180) / Math.PI,
            longitude = (Math.atan2(world[2], world[0]) * 180) / Math.PI;
          const id = ++sequence.current,
            c = {
              name: `Earth · ${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°`,
              country: "Planetary probe",
              latitude,
              longitude,
              timezone: "UTC",
            };
          select(c);
          void reverseGeocode(latitude, longitude)
            .then((result) => {
              if (sequence.current === id) store.setCity(result);
            })
            .catch(() => {});
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      />
      <svg className="beacon-leaders" aria-hidden="true">
        {beacons.map((p) => (
          <g key={p.city.name}>
            <path
              d={`M${p.x},${p.y} L${p.labelX + 65},${p.labelY + 18}`}
              stroke="#9de8ff66"
              fill="none"
            />
            <circle cx={p.x} cy={p.y} r="4" fill="#b5f7ff" />
            <circle
              className="planet-beacon-pulse"
              cx={p.x}
              cy={p.y}
              r="12"
              fill="none"
              stroke="#7bdaff"
            />
          </g>
        ))}
      </svg>
      {beacons.map((p) => (
        <button
          key={p.city.name}
          className="planet-city-label"
          style={{ left: p.labelX, top: p.labelY }}
          onClick={() => select(p.city)}
        >
          <span>{p.city.name}</span>
          <b>{fmt(temperature(p.temperature, store.units))}°</b>
        </button>
      ))}
      <div className="planet-controls">
        <button
          aria-label="Zoom globe in"
          onClick={() => {
            zoom.current = Math.min(1.4, zoom.current + 0.1);
          }}
        >
          <Plus size={17} />
        </button>
        <button
          aria-label="Zoom globe out"
          onClick={() => {
            zoom.current = Math.max(0.7, zoom.current - 0.1);
          }}
        >
          <Minus size={17} />
        </button>
        <button
          aria-label="Center globe on selected city"
          onClick={() => {
            target.current = { lon: city.longitude, lat: city.latitude };
            zoom.current = 1;
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="planet-caption">
        <Globe2 size={15} />
        <span>
          {winds.data
            ? "48-point forecast surface flow"
            : "Earth’s daylight, in real time"}{" "}
          · drag to orbit · click to explore
        </span>
      </div>
      {error && <p className="planet-error">{error}</p>}
    </div>
  );
}

declare global {
  interface Window {
    __aetherisGlobePerformance?: { fps: number; beacons: number };
  }
}
