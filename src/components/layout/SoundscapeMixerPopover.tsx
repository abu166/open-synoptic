import AudioOscilloscope from "../canvas/AudioOscilloscope";
import { useExperience } from "../../experience/ExperienceContext";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  CloudRain,
  Wind,
  Sunrise,
  Power,
  X,
  CloudLightning,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { weatherStudio, type SoundMix } from "../../lib/audio/weatherSynth";
import { solarPosition } from "../../lib/meteorology/ephemeris";
import { useWeatherStore } from "../../store/useWeatherStore";
import type { Forecast } from "../../types/telemetry";
export default function SoundscapeMixerPopover({
  open,
  onClose,
  weather,
}: {
  open: boolean;
  onClose: () => void;
  weather?: Forecast;
}) {
  const ref = useRef<HTMLDivElement>(null),
    audio = useWeatherStore((s) => s.audio),
    toggle = useWeatherStore((s) => s.toggleAudio),
    [auto, setAuto] = useState(true),
    [sync, setSync] = useState(true),
    experience = useExperience(),
    [error, setError] = useState(""),
    [mix, setMix] = useState<SoundMix>({
      rain: 0.25,
      wind: 0.25,
      thunder: 0,
      pad: 0.45,
      drone: 0.08,
      master: 0.55,
    });
  const activeWeather = sync ? weather : (experience?.source ?? weather);
  const environment = activeWeather
    ? {
        rain: activeWeather.current.precipitation,
        wind: activeWeather.current.wind_gusts_10m,
        code: activeWeather.current.weather_code,
        temperature: activeWeather.current.temperature_2m,
        elevation: solarPosition(
          new Date(activeWeather.current.time * 1000),
          activeWeather.latitude,
          activeWeather.longitude,
        ).elevation,
      }
    : undefined;
  useEffect(() => {
    if (!environment) return;
    weatherStudio.setEnvironment(environment);
    if (auto)
      setMix((prev) => ({
        ...prev,
        rain:
          environment.rain > 0
            ? Math.min(0.85, 0.2 + environment.rain * 0.2)
            : 0,
        wind: Math.min(0.8, 0.05 + environment.wind / 100),
        thunder: environment.code >= 95 ? 0.5 : 0,
        drone: environment.elevation < 0 ? 0.2 : 0.05,
      }));
  }, [activeWeather, auto]);
  useEffect(() => weatherStudio.setMix(mix), [mix]);
  useEffect(() => () => weatherStudio.stop(), []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[aria-label="Open soundscape studio"]')
      )
        onClose();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose]);
  const power = async () => {
    setError("");
    if (audio) {
      weatherStudio.stop();
      toggle();
    } else
      try {
        weatherStudio.setMix(mix);
        await weatherStudio.start(
          environment?.rain,
          environment?.wind,
          environment?.code,
        );
        if (environment) weatherStudio.setEnvironment(environment);
        toggle();
      } catch {
        setError("Audio could not start. Tap the power button again.");
      }
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          className="soundscape-popover"
          role="dialog"
          aria-label="Atmospheric soundscape studio"
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
        >
          <header>
            <span className="eyebrow">
              <AudioLines size={17} /> SOUND & VIBE STUDIO
            </span>
            <button aria-label="Close soundscape studio" onClick={onClose}>
              <X size={19} />
            </button>
          </header>
          <h2>
            Leave the world
            <br />
            playing softly.
          </h2>
          <p>Your weather, made into a little room for focus.</p>
          <button
            className={`studio-power ${audio ? "active" : ""}`}
            onClick={() => void power()}
          >
            <Power size={21} />
            {audio ? "Soundscape is playing" : "Start your soundscape"}
            <span className={`wave-bars ${audio ? "playing" : ""}`}>
              {[0, 1, 2, 3, 4].map((j) => (
                <i key={j} style={{ animationDelay: `${j * 0.15}s` }} />
              ))}
            </span>
          </button>
          <AudioOscilloscope active={audio} />
          <label className="auto-sound">
            <input
              type="checkbox"
              checked={sync}
              onChange={(e) => setSync(e.target.checked)}
            />
            Sync to time machine
          </label>
          <label className="auto-sound">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Follow this city’s weather
          </label>
          <div className="sound-layers">
            {(
              [
                {
                  key: "rain",
                  name: "Rain on window",
                  description: "Soft texture. A window seat.",
                  Icon: CloudRain,
                },
                {
                  key: "wind",
                  name: "High-altitude wind",
                  description: "Slow gusts, a wider horizon.",
                  Icon: Wind,
                },
                {
                  key: "thunder",
                  name: "Distant thunder",
                  description: "An occasional low, rolling rumble.",
                  Icon: CloudLightning,
                },
                {
                  key: "pad",
                  name: "Warm lo-fi ambient pad",
                  description:
                    environment &&
                    environment.elevation > 0 &&
                    environment.code < 3
                      ? "Warm major chords · stereo drift"
                      : "Contemplative minor chords · stereo drift",
                  Icon: Sunrise,
                },
                {
                  key: "drone",
                  name: "432Hz focus drone",
                  description: "A steady sine tone · a personal focus texture",
                  Icon: AudioLines,
                },
              ] as const
            ).map(({ key, name, description, Icon }) => (
              <div className="sound-layer" key={key}>
                <button
                  aria-label={`Toggle ${name}`}
                  aria-pressed={mix[key] > 0}
                  onClick={() => {
                    if (key !== "pad" && key !== "drone") setAuto(false);
                    setMix((p) => ({ ...p, [key]: p[key] > 0 ? 0 : 0.45 }));
                  }}
                >
                  <Icon size={22} />
                </button>
                <div>
                  <strong>{name}</strong>
                  <small>{description}</small>
                  <input
                    aria-label={`${name} volume`}
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={mix[key]}
                    onChange={(e) => {
                      if (key !== "pad" && key !== "drone") setAuto(false);
                      setMix((p) => ({ ...p, [key]: +e.target.value }));
                    }}
                  />
                </div>
                <span className="numeric">{Math.round(mix[key] * 100)}%</span>
              </div>
            ))}
          </div>
          <label className="master-volume">
            <Volume2 size={20} />
            Master
            <input
              aria-label="Master volume"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={mix.master}
              onChange={(e) =>
                setMix((p) => ({ ...p, master: +e.target.value }))
              }
            />
          </label>
          {error && <p className="error">{error}</p>}
          <footer>
            Procedural sound. No recordings. Best enjoyed quietly with
            headphones.
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
