import { useMemo, useState } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Glass from "../ui/GlassBentoCard";
import { type OutfitLayer } from "../../lib/meteorology/humanWeather";
import {
  commuteOutfit,
  physiologyCues,
  outingWindows,
  type OutingWindow,
} from "../../lib/meteorology/commute";
import type { PanelProps } from "../../types/telemetry";
import { useExperience } from "../../experience/ExperienceContext";
export function ClothingIllustration({ kind }: { kind: OutfitLayer["key"] }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width="80"
      height="80"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`fabric-${kind}`} x1="0" x2="1" y2="1">
          <stop stopColor="#ffe5b2" />
          <stop offset="1" stopColor="#d9a57c" />
        </linearGradient>
      </defs>
      {kind === "head" ? (
        <>
          <path d="M23 55C23 19 77 19 77 55Z" fill={`url(#fabric-${kind})`} />
          <rect x="19" y="53" width="62" height="14" rx="5" fill="#f4d9b2" />
          <path
            d="M35 51V35m15 16V28m15 23V35"
            stroke="#a8765e"
            strokeWidth="2"
          />
          <circle cx="50" cy="21" r="9" fill="#f4d9b2" />
        </>
      ) : kind === "outer" ? (
        <>
          <path
            d="M35 22L15 35l-6 32 16 3 9-21-2 35h36l-2-35 9 21 16-3-6-32-20-13-15 9Z"
            fill={`url(#fabric-${kind})`}
          />
          <path
            d="M35 22l15 9-7 19-10-14m32-14-15 9 7 19 10-14M50 31v53M34 65h10m12 0h10"
            stroke="#875f51"
            strokeWidth="2"
          />
          <circle cx="53" cy="60" r="1.5" fill="#875f51" />
          <circle cx="53" cy="73" r="1.5" fill="#875f51" />
        </>
      ) : kind === "middle" ? (
        <>
          <path
            d="M33 23L14 34l-9 27 18 7 10-21v37h34V47l10 21 18-7-9-27-19-11c-4 15-30 15-34 0Z"
            fill="#d3e4e4"
          />
          <path
            d="M36 24c0 20 28 20 28 0M35 75h30M16 58l12 5m56-5-12 5"
            stroke="#7199ad"
            strokeWidth="3"
          />
        </>
      ) : kind === "shoes" ? (
        <>
          <path
            d="M18 31h25l8 24 31 12c8 3 9 15 0 15H15c-8 0-7-16-4-23Z"
            fill={`url(#fabric-${kind})`}
          />
          <path
            d="M11 73h76M45 43l-11 5m16 4-11 5m18 2-11 5"
            stroke="#825f54"
            strokeWidth="3"
          />
          <path d="M18 31v28l-7 6" stroke="#f2dbc2" strokeWidth="4" />
        </>
      ) : (
        <>
          <path
            d="M12 46C19 6 81 6 88 46c-9-8-17-8-25 0-9-8-17-8-25 0-9-8-17-8-26 0Z"
            fill="#c6e6ef"
          />
          <path
            d="M50 14v58c0 19 24 19 24 2M50 15C35 26 36 35 38 46m12-31c15 11 14 20 13 31"
            stroke="#64879d"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function ThermalBodyMap({
  cold,
  wind,
  rain,
  uv,
  pm,
}: {
  cold: number;
  wind: number;
  rain: number;
  uv: number;
  pm: number;
}) {
  const [zone, setZone] = useState(0),
    zones = [
      {
        name: "Head & ears",
        color: cold < 8 ? "#74d4ff" : "#8df1c7",
        detail:
          cold < 8
            ? "A scarf or beanie helps soften the exposed-air bite."
            : "Light accessories suit the air.",
      },
      {
        name: "Core & chest",
        color: cold < 5 ? "#83c9ff" : cold > 26 ? "#f6b46c" : "#88edc5",
        detail:
          cold < 12
            ? "Keep an insulating layer close; make it easy to unzip when walking."
            : "Breathable fabric helps your core shed warmth.",
      },
      {
        name: "Hands & extremities",
        color: cold < 8 ? "#92bdff" : "#c0f4c5",
        detail:
          wind > 25
            ? "Gusts steal warmth from bare hands first. Gloves make a difference."
            : "A pocket or light glove is an easy comfort adjustment.",
      },
      {
        name: "Lungs & breathing",
        color: pm > 35 ? "#fbb779" : "#8ff3dc",
        detail:
          pm > 35
            ? "Particles are elevated. Consider an easier route away from traffic."
            : cold < 5
              ? "Cold air can feel sharp. A comfortable pace and scarf can soften the sensation."
              : "A softer breathing environment for an unhurried walk.",
      },
      {
        name: "Skin & UV",
        color: uv > 5 ? "#f5b27b" : "#b7defa",
        detail:
          uv > 3
            ? "Sun protection belongs in the plan, even if the air feels cool."
            : rain > 35
              ? "Choose a weather-ready outer fabric; the light is relatively gentle."
              : "Gentle UV. Dry air may make lip balm feel welcome.",
      },
    ];
  const activate = (e: React.KeyboardEvent<SVGGElement>, j: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setZone(j);
    }
  };
  return (
    <aside className="thermal-body-map" onClick={(e) => e.stopPropagation()}>
      <span className="eyebrow">YOUR BODY, IN THIS AIR</span>
      <svg
        viewBox="0 0 250 340"
        role="group"
        aria-label="Interactive thermal body zones"
      >
        <defs>
          <radialGradient id="bodyGlow">
            <stop stopColor="#9ee7ff" stopOpacity=".22" />
            <stop offset="1" stopColor="#9ee7ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="125" cy="170" rx="120" ry="160" fill="url(#bodyGlow)" />
        <path
          d="M103 90Q125 80 147 90L162 165 150 210 145 302 126 302 125 218 123 218 121 302 102 302 98 210 88 164Z"
          fill="#c8edff16"
          stroke="#bfe8ff77"
        />
        <path
          d="M103 92L78 110 61 190M147 92l25 18 17 80"
          stroke="#c8edff66"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <circle
          cx="125"
          cy="58"
          r="26"
          fill={zones[0].color + "50"}
          stroke={zones[0].color}
        />
        {zones.map((z, j) => (
          <g
            key={z.name}
            role="button"
            tabIndex={0}
            aria-label={z.name}
            onClick={() => setZone(j)}
            onKeyDown={(e) => activate(e, j)}
            className={zone === j ? "body-zone active" : "body-zone"}
          >
            {j === 0 ? (
              <circle cx="125" cy="58" r="34" />
            ) : j === 1 ? (
              <path d="M107 98Q125 90 143 98L149 163 101 163Z" />
            ) : j === 2 ? (
              <>
                <ellipse cx="60" cy="196" rx="12" ry="17" />
                <ellipse cx="190" cy="196" rx="12" ry="17" />
              </>
            ) : j === 3 ? (
              <>
                <path d="M119 109q-19 4-17 34 14 5 17-12Z" />
                <path d="M131 109q19 4 17 34-14 5-17-12Z" />
              </>
            ) : (
              <circle cx="125" cy="245" r="18" />
            )}
            <title>{z.name}</title>
            <style>{`.body-zone:nth-of-type(${j + 1}){--zone-color:${z.color}}`}</style>
          </g>
        ))}
      </svg>
      <div className="body-zone-pills">
        {zones.map((z, j) => (
          <button
            key={z.name}
            className={zone === j ? "selected" : ""}
            onClick={() => setZone(j)}
            style={{ borderColor: z.color + "55" }}
          >
            {z.name}
          </button>
        ))}
      </div>
      <h3 style={{ color: zones[zone].color }}>{zones[zone].name}</h3>
      <p>{zones[zone].detail}</p>
    </aside>
  );
}
function GaugeTrace({ points, color }: { points: number[]; color: string }) {
  const valid = points.filter(Number.isFinite),
    min = Math.min(...valid),
    max = Math.max(...valid);
  return (
    <svg
      className="physiology-trace"
      viewBox="0 0 240 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="0" y1="54" x2="240" y2="54" stroke="#ffffff20" />
      <polyline
        points={points
          .map(
            (n, j) =>
              `${(j / (points.length - 1)) * 240},${48 - ((n - min) / (max - min || 1)) * 40}`,
          )
          .join(" ")}
        stroke={color}
        strokeWidth="2"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export default function HumanComfortAndWardrobeCard({
  weather: w,
  air,
}: PanelProps) {
  const [tab, setTab] = useState<"wardrobe" | "feel">("wardrobe"),
    [window, setWindow] = useState<OutingWindow>("now"),
    outing = useMemo(() => commuteOutfit(w, window), [w, window]),
    cues = useMemo(() => physiologyCues(w, air), [w, air]),
    experience = useExperience();
  return (
    <Glass
      title="Your day. Dressed for the possibilities."
      eyebrow="COMMUTE & OUTFIT ARCHITECT"
      className="span-12 wardrobe-card"
      action={<Sparkles size={24} />}
    >
      <div className="wardrobe-intro">
        <p>
          One outfit. Every chapter of your outing.
          <br />
          <strong>Plan for the journey home, too.</strong>
        </p>
        <div className="chart-tabs">
          <button
            className={tab === "wardrobe" ? "selected" : ""}
            onClick={() => setTab("wardrobe")}
          >
            Build your layers
          </button>
          <button
            className={tab === "feel" ? "selected" : ""}
            onClick={() => setTab("feel")}
          >
            How the day feels
          </button>
        </div>
      </div>
      <div className="commute-windows">
        {outingWindows.map((p) => (
          <button
            key={p.key}
            className={window === p.key ? "selected" : ""}
            aria-pressed={window === p.key}
            onClick={() => setWindow(p.key)}
          >
            {p.label}
            {p.key !== "now" && (
              <small>
                {String(p.start).padStart(2, "0")}:00–{p.end}:00
              </small>
            )}
          </button>
        ))}
      </div>
      <div className="outing-story">
        <span className="time-state forecast">
          {outing.date} · {outing.from}
          {outing.to !== outing.from ? `–${outing.to}` : ""}
        </span>
        <h3>{outing.tip}</h3>
        <div>
          <span>
            Feels-like floor <b>{Math.round(outing.cold)}°</b>
          </span>
          <span>
            Warmest air <b>{Math.round(outing.warm)}°</b>
          </span>
          <span>
            Rain risk <b>{Math.round(outing.rain)}%</b>
          </span>
          <span>
            Peak gust <b>{Math.round(outing.wind)} km/h</b>
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "wardrobe" ? (
            <div className="outfit-architect">
              <ThermalBodyMap
                cold={outing.cold}
                wind={outing.wind}
                rain={outing.rain}
                uv={Number(w.hourly.uv_index?.[outing.worst] ?? 0)}
                pm={air?.current.pm2_5 ?? 0}
              />
              <div className="outfit-layers">
                {outing.layers.map((layer) => (
                  <button
                    key={layer.key}
                    className="outfit-layer"
                    onClick={() =>
                      experience?.openDive({
                        title: "What to wear & how you’ll feel",
                        metric:
                          layer.key === "umbrella"
                            ? "precipitation_probability"
                            : "apparent_temperature",
                      })
                    }
                  >
                    <div className="outfit-art">
                      <ClothingIllustration kind={layer.key} />
                      <ArrowUpRight size={18} />
                    </div>
                    <span className="eyebrow">{layer.name}</span>
                    <h3>{layer.recommendation}</h3>
                    <p>{layer.reason}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="physiology-intro">
                Four weather-based exposure cues. A personal way to notice the
                day’s rhythm.
              </p>
              <div className="physiology-dashboard">
                {cues.cues.map((cue, j) => {
                  const color = ["#d6b3ff", "#ffe0a0", "#8aead5", "#9cceff"][j];
                  return (
                    <button
                      className="physiology-gauge"
                      key={cue.key}
                      onClick={() =>
                        experience?.openDive({
                          title: cue.title,
                          metric: cue.metric,
                        })
                      }
                    >
                      <div className="physiology-gauge-head">
                        <svg viewBox="0 0 110 110" aria-hidden="true">
                          <circle
                            cx="55"
                            cy="55"
                            r="45"
                            fill="none"
                            stroke="#ffffff15"
                            strokeWidth="7"
                          />
                          <circle
                            cx="55"
                            cy="55"
                            r="45"
                            fill="none"
                            stroke={color}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={`${(cue.value / 100) * 283} 283`}
                            transform="rotate(-90 55 55)"
                          />
                          <text
                            x="55"
                            y="60"
                            textAnchor="middle"
                            fill="white"
                            fontSize="30"
                          >
                            {cue.value}
                          </text>
                        </svg>
                        <span>
                          {cue.title}
                          <small>WEATHER CUE / 100</small>
                        </span>
                      </div>
                      <p>{cue.detail}</p>
                      <GaugeTrace points={cue.series} color={color} />
                      <span className="trace-unit">
                        {cue.key === "pressure"
                          ? "Past 24h pressure derivative"
                          : `Next 24h · ${cue.unit}`}{" "}
                        <ArrowUpRight size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <footer className="panel-note">
        Your outing spans {outing.indices.length} forecast hour
        {outing.indices.length === 1 ? "" : "s"} ·{" "}
        {Math.round(outing.warm - outing.low)}° temperature swing ·{" "}
        {outing.rain > 35
          ? "Keep an outer layer handy."
          : "A little room for outside."}
      </footer>
    </Glass>
  );
}
