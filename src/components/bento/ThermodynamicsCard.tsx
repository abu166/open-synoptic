import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Droplets, TrendingDown, TrendingUp, Heart } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import {
  wetBulb,
  vaporPressureDeficit,
  airDensity,
} from "../../lib/meteorology/physics";
import { fmt } from "../../lib/units/converter";
import { useExperience } from "../../experience/ExperienceContext";
export default function ThermodynamicsCard({ weather: w }: PanelProps) {
  const [pressure, setPressure] = useState(false),
    experience = useExperience(),
    c = w.current,
    i = currentIndex(w),
    rh = c.relative_humidity_2m,
    t = c.temperature_2m,
    p = c.pressure_msl,
    delta = p - value(w.hourly, "pressure_msl", Math.max(0, i - 3)),
    day = p - value(w.hourly, "pressure_msl", Math.max(0, i - 24)),
    wet = wetBulb(t, rh),
    vpd = vaporPressureDeficit(t, rh),
    dew = value(w.hourly, "dew_point_2m", i);
  const status =
    t < 10
      ? "Crisp & bracing"
      : wet > 27
        ? "Warmth that lingers"
        : rh > 75
          ? "Soft, close, humid air"
          : rh < 30
            ? "Dry air, a lighter touch"
            : "A comfortable balance";
  return (
    <Glass
      title="How the air meets your body."
      eyebrow="COMFORT · MOISTURE · PRESSURE"
      className="span-4 comfort-card"
    >
      <div className="chart-tabs">
        <button
          className={!pressure ? "selected" : ""}
          onClick={() => setPressure(false)}
        >
          How it feels
        </button>
        <button
          className={pressure ? "selected" : ""}
          onClick={() => setPressure(true)}
        >
          The pressure story
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={pressure ? "pressure" : "comfort"}
          initial={{ opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -7 }}
          transition={{ duration: 0.2 }}
        >
          {!pressure ? (
            <>
              <div className="comfort-main">
                <span>
                  <Droplets size={25} />
                  <b className="numeric">
                    {fmt(rh)}
                    <small>%</small>
                  </b>
                  <small>MOISTURE IN THE AIR</small>
                </span>
                <div>
                  <span className="muted small">Evaporative cooling clue</span>
                  <b className="numeric">{fmt(wet, 1)}°C</b>
                  <span className="status-pill">{status}</span>
                </div>
              </div>
              <p className="comfort-translation">
                {dew < 3
                  ? "Low dew point gives this air a crisp, dry edge. Lip balm and a comfortable layer may feel welcome."
                  : rh > 75
                    ? "Moisture lingers. Breathable layers can make the warmth feel a little less close."
                    : "There is a comfortable amount of moisture in the air for many everyday activities."}
              </p>
              <div className="comfort-spectrum">
                <i style={{ left: `${rh}%` }} />
              </div>
              <div className="spectrum-labels">
                <span>Dry</span>
                <span>Balanced</span>
                <span>Humid</span>
              </div>
              <div className="thermo-metrics">
                <button
                  onClick={() =>
                    experience?.openDive({
                      title: "Skin, hair & the air",
                      metric: "dew_point_2m",
                    })
                  }
                >
                  Dew point<b>{fmt(dew, 1)}°C</b>
                </button>
                <button
                  onClick={() =>
                    experience?.openDive({
                      title: "How thirsty the air is",
                      metric: "vapour_pressure_deficit",
                    })
                  }
                >
                  Drying power<b>{fmt(vpd, 2)} kPa</b>
                </button>
                <button
                  onClick={() =>
                    experience?.openDive({
                      title: "The weight of air",
                      metric: "air_density",
                    })
                  }
                >
                  Air density
                  <b>{fmt(airDensity(t, rh, c.surface_pressure), 3)} kg/m³</b>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="pressure-editorial">
                <span className="eyebrow">
                  THE WEATHER IS{" "}
                  {Math.abs(day) > 5 ? "TURNING A PAGE" : "HOLDING ITS RHYTHM"}
                </span>
                <strong className="numeric">
                  {fmt(p, 1)}
                  <small> hPa</small>
                </strong>
                <h3>
                  {Math.abs(day) > 6
                    ? "A noticeable shift in the air."
                    : "A quieter pressure pattern."}
                </h3>
                <p>
                  {Math.abs(day) > 6
                    ? `Pressure has ${day < 0 ? "fallen" : "risen"} ${fmt(Math.abs(day), 1)} hPa in 24 hours. If weather shifts are one of your personal headache triggers, it can be useful to keep a note of how you feel.`
                    : "A single pressure reading says little about how you will feel. The trend helps tell the weather story."}
                </p>
                <div className="pressure-trend">
                  {delta < 0 ? (
                    <TrendingDown size={21} />
                  ) : (
                    <TrendingUp size={21} />
                  )}
                  <b>
                    {Math.abs(delta) < 0.5
                      ? "Mostly steady"
                      : delta < 0
                        ? "Falling"
                        : "Rising"}{" "}
                    · {delta > 0 ? "+" : ""}
                    {fmt(delta, 1)} hPa / 3h
                  </b>
                </div>
                <div className="pressure-spark">
                  {Array.from({ length: 25 }, (_, j) => {
                    const n = value(
                      w.hourly,
                      "pressure_msl",
                      Math.max(0, i - 24 + j),
                    );
                    return (
                      <span
                        key={j}
                        title={`${fmt(n, 1)} hPa`}
                        style={{
                          height: `${20 + Math.max(0, Math.min(50, (n - 990) * 1.3))}px`,
                        }}
                      />
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    experience?.openDive({
                      title: "Pressure & your day",
                      metric: "pressure_msl",
                    })
                  }
                >
                  <Heart size={18} />
                  Explore your weather sensitivity cues
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <footer className="panel-note">
        {pressure
          ? `Pressure moved ${day > 0 ? "+" : ""}${fmt(day, 1)} hPa in 24 hours · ${delta < 0 ? "follow the falling trend" : "a steadier outlook ahead"}.`
          : `Dew point ${fmt(dew, 1)}° · ${rh > 75 ? "Moisture lingers. Breathable layers feel welcome." : "Dryer air rewards a comfortable, removable layer."}`}
      </footer>
    </Glass>
  );
}
