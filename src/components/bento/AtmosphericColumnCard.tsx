import { Layers3 } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import { stability } from "../../lib/meteorology/physics";
import { fmt } from "../../lib/units/converter";
export default function AtmosphericColumnCard({ weather: w }: PanelProps) {
  const i = currentIndex(w),
    v = (k: string) => value(w.hourly, k, i);
  return (
    <Glass
      title="A whole world above your head."
      eyebrow="VERTICAL SOUNDING"
      className="span-4 column-card"
      action={<Layers3 size={17} />}
    >
      <p className="column-human-note">
        {v("cape") < 100
          ? "The air is settled. Those cloud layers are passing scenery, rather than a sign of growing storm energy."
          : v("cape") > 1500
            ? "There’s fuel for rising clouds. Storm development still needs moisture and a trigger."
            : "A little upward energy in the air. Watch the bigger pattern, not one number."}
      </p>
      <div className="column-visual">
        <span className="thermal-parcel" aria-hidden="true" />
        {[
          ["High", "cloud_cover_high", "> 6 km"],
          ["Mid", "cloud_cover_mid", "2–6 km"],
          ["Low", "cloud_cover_low", "0–2 km"],
        ].map(([label, k, alt]) => (
          <div key={k} className="cloud-layer">
            <span>{alt}</span>
            <div
              style={{
                opacity: 0.25 + v(k) / 150,
                animationDuration: `${Math.max(2, 20 - (label === "High" ? v("wind_speed_120m") : label === "Mid" ? v("wind_speed_80m") : v("wind_speed_10m")) / 4)}s`,
              }}
            >
              <i />
              <i />
              <i />
            </div>
            <b>
              {label}
              <small>{fmt(v(k))}%</small>
            </b>
          </div>
        ))}
        <div className="freezing-line">
          <span>0°C ISOTHERM</span>
          <b>{fmt(v("freezing_level_height"))} m</b>
        </div>
      </div>
      <div className="metrics-grid column-metrics">
        <span>
          Storm-building energy
          <b>
            {fmt(v("cape"))} <small>J/kg</small>
          </b>
        </span>
        <span>
          Rising-air outlook
          <b>
            {fmt(v("lifted_index"), 1)} <small>K</small>
          </b>
        </span>
        <span>
          Visibility
          <b>
            {fmt(v("visibility") / 1000, 1)} <small>km</small>
          </b>
        </span>
        <span>
          Cloud cover
          <b>
            {fmt(w.current.cloud_cover)} <small>%</small>
          </b>
        </span>
      </div>
      <div className="stability-pill">
        <span className="live-dot" />
        {stability(v("cape"), v("lifted_index"))}
      </div>
    </Glass>
  );
}
