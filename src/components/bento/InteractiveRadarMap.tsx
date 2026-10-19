import { dateLocale, translate, useLanguage } from "../../i18n/locale";
import type { MapFieldMode } from "../../lib/meteorology/vectorField";
import InteractivePlanetaryGlobe from "../canvas/InteractivePlanetaryGlobe";
import MapWindParticles from "../canvas/MapWindParticles";
import { useExperience } from "../../experience/ExperienceContext";
import workerURL from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Pause,
  Globe2,
  Map as MapIcon,
  Layers,
  LocateFixed,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { fetchRadar, tileURL } from "../../api/rainViewerClient";
import { getForecast } from "../../api/openMeteoClient";
import type { PanelProps, Forecast } from "../../types/telemetry";
import Glass from "../ui/GlassBentoCard";
import { reverseGeocode } from "../../api/nominatimClient";
import { presets } from "../../store/useWeatherStore";
export default function InteractiveRadarMap({
  city,
  weather,
  variant = "preview",
}: PanelProps & { variant?: "preview" | "command" | "planet" }) {
  const experience = useExperience();
  const language = useLanguage();
  const [showWind, setShowWind] = useState(true),
    [fieldMode, setFieldMode] = useState<MapFieldMode>(
      variant === "command" ? "wind" : "radar",
    );
  const viewport = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActivated(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapLibreMap | null>(null),
    activeLayer = useRef(""),
    probeMarker = useRef<import("maplibre-gl").Marker | null>(null),
    [probeName, setProbeName] = useState(""),
    [ready, setReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [globe, setGlobe] = useState(variant === "planet"),
    [sat, setSat] = useState(false),
    [playing, setPlaying] = useState(false),
    [frame, setFrame] = useState(0),
    [opacity, setOpacity] = useState(0.7),
    [color, setColor] = useState(2),
    [speed, setSpeed] = useState(1),
    [probe, setProbe] = useState<Forecast | null>(null);
  const radar = useQuery({
    queryKey: ["radar"],
    enabled: activated && !globe && fieldMode === "radar",
    queryFn: ({ signal }) => fetchRadar(signal),
    staleTime: 300000,
  });
  const frames = sat
    ? (radar.data?.satellite?.infrared ?? [])
    : [...(radar.data?.radar.past ?? []), ...(radar.data?.radar.nowcast ?? [])];
  useEffect(() => {
    if (!activated || globe || !container.current) return;
    let cancelled = false;
    import("maplibre-gl")
      .then((ml) => {
        if (cancelled) return;
        ml.setWorkerUrl(workerURL);
        const m = new ml.Map({
          container: container.current!,
          style:
            "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          center: [city.longitude, city.latitude],
          zoom: 6,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.on("load", () => setReady(true));
        if (variant === "command")
          for (const c of presets) {
            const button = document.createElement("button");
            button.className = "map-city-marker";
            button.textContent = translate(c.name);
            button.setAttribute("aria-label", translate(`Explore ${c.name}`));
            button.addEventListener("click", (e) => {
              e.stopPropagation();
              m.flyTo({ center: [c.longitude, c.latitude], zoom: 5 });
              void getForecast(c)
                .then(setProbe)
                .catch(() => setMapError("Location preview unavailable."));
              setProbeName(c.name);
            });
            new ml.Marker({ element: button })
              .setLngLat([c.longitude, c.latitude])
              .addTo(m);
          }
        m.on("error", () => setMapError("Some map tiles could not be loaded."));
        m.on("click", async (e) => {
          probeMarker.current?.remove();
          probeMarker.current = new ml.Marker({ color: "#c0d7f0" })
            .setLngLat(e.lngLat)
            .addTo(m);
          setProbeName("Resolving location…");
          void reverseGeocode(e.lngLat.lat, e.lngLat.lng)
            .then((c) => setProbeName(c.name))
            .catch(() => setProbeName("Selected coordinate"));
          try {
            setProbe(
              await getForecast({
                ...city,
                latitude: e.lngLat.lat,
                longitude: e.lngLat.lng,
              }),
            );
          } catch {
            setMapError("Probe telemetry unavailable.");
          }
        });
      })
      .catch(() => setMapError("Map engine unavailable."));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [globe, activated, language]);
  useEffect(() => {
    map.current?.flyTo({ center: [city.longitude, city.latitude], zoom: 6 });
  }, [city.latitude, city.longitude]);
  useEffect(() => {
    setFrame(Math.max(0, (radar.data?.radar.past.length ?? 1) - 1));
  }, [radar.data]);
  useEffect(() => {
    if (!playing || !frames.length) return;
    const id = setInterval(
      () => setFrame((i) => (i + 1) % frames.length),
      1100 / speed,
    );
    return () => clearInterval(id);
  }, [playing, frames.length, speed]);
  useEffect(() => {
    const m = map.current,
      f = frames[Math.min(frame, frames.length - 1)];
    if (!ready || !m || !radar.data) return;
    if (!f) {
      m.getStyle()
        .layers.filter((l) => l.id.startsWith("radar-"))
        .forEach((l) => {
          m.removeLayer(l.id);
          if (m.getSource(l.id)) m.removeSource(l.id);
        });
      return;
    }
    const next = `radar-${sat ? "sat" : "rain"}-${f.time}-${color}`;
    activeLayer.current = next;
    if (!m.getSource(next))
      m.addSource(next, {
        type: "raster",
        tiles: [tileURL(radar.data.host, f, color)],
        tileSize: 256,
        maxzoom: 7,
      });
    if (!m.getLayer(next))
      m.addLayer({
        id: next,
        type: "raster",
        source: next,
        paint: {
          "raster-opacity": 0,
          "raster-opacity-transition": { duration: 500 },
          "raster-fade-duration": 500,
        },
      });
    m.setPaintProperty(
      next,
      "raster-opacity",
      fieldMode === "radar" ? opacity : 0,
    );
    const old = m
      .getStyle()
      .layers.filter((l) => l.id.startsWith("radar-") && l.id !== next);
    old.forEach((l) => m.setPaintProperty(l.id, "raster-opacity", 0));
    setTimeout(() => {
      if (map.current !== m) return;
      old.forEach((l) => {
        if (activeLayer.current === l.id) return;
        if (m.getLayer(l.id)) m.removeLayer(l.id);
        if (m.getSource(l.id)) m.removeSource(l.id);
      });
    }, 650);
  }, [ready, frame, radar.data, sat, color, fieldMode]);
  useEffect(() => {
    const m = map.current;
    if (ready && m)
      m.getStyle()
        .layers.filter((l) => l.id.startsWith("radar-"))
        .forEach((l) =>
          m.setPaintProperty(
            l.id,
            "raster-opacity",
            l.id === activeLayer.current && fieldMode === "radar" ? opacity : 0,
          ),
        );
  }, [opacity, ready, fieldMode]);
  return (
    <Glass
      title={
        variant === "planet"
          ? "A planet, turning toward the light."
          : "Follow the sky in motion."
      }
      eyebrow="GEOSPATIAL INTELLIGENCE"
      className={`radar-card ${variant === "command" ? "span-8 radar-command" : "span-4"} ${variant === "planet" ? "planetary-card" : ""}`}
      action={
        <div className="segmented">
          <button
            aria-label="Regional map"
            className={!globe ? "selected" : ""}
            onClick={() => setGlobe(false)}
          >
            <MapIcon size={13} />
          </button>
          <button
            aria-label="Planetary globe"
            className={globe ? "selected" : ""}
            onClick={() => setGlobe(true)}
          >
            <Globe2 size={13} />
          </button>
        </div>
      }
    >
      {!globe && (
        <div className="map-field-tabs">
          {(
            [
              ["radar", "Doppler radar"],
              ["wind", "Wind velocity"],
              ["temperature", "Temperature"],
              ["cloud", "Cloud field"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={fieldMode === key}
              className={fieldMode === key ? "selected" : ""}
              onClick={() => setFieldMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="radar-map" id="radar" ref={viewport}>
        {globe && activated ? (
          <InteractivePlanetaryGlobe
            city={city}
            time={weather.current.time * 1000}
          />
        ) : (
          <div ref={container} className="map-container" />
        )}
        {!globe && (
          <div className="map-badge">
            <i className="live-dot" />
            {fieldMode === "wind"
              ? "WIND VELOCITY"
              : fieldMode === "temperature"
                ? "THERMAL FIELD"
                : fieldMode === "cloud"
                  ? "CLOUD FORECAST"
                  : sat
                    ? "INFRARED"
                    : "PRECIPITATION"}
            <span>
              {fieldMode !== "radar"
                ? "FORECAST"
                : frames.length
                  ? "LIVE"
                  : "LOADING"}
            </span>
          </div>
        )}
        {!globe && ready && map.current && (
          <MapWindParticles
            map={map.current}
            time={weather.current.time * 1000}
            mode={fieldMode}
            weather={weather}
            enabled={showWind}
          />
        )}
        {!globe && (
          <button
            className="map-recenter"
            title="Recenter map"
            onClick={() =>
              map.current?.flyTo({
                center: [city.longitude, city.latitude],
                zoom: 6,
              })
            }
          >
            <LocateFixed size={15} />
          </button>
        )}
        {probe && (
          <button
            className="probe-readout"
            onClick={() => {
              setProbe(null);
              probeMarker.current?.remove();
            }}
          >
            {probeName} · {probe.latitude.toFixed(2)}°,{" "}
            {probe.longitude.toFixed(2)}° · {probe.current.temperature_2m}°C ×
          </button>
        )}
      </div>
      {!globe && (
        <>
          {fieldMode === "radar" && (
            <div className="radar-controls">
              <button
                onClick={() => setPlaying(!playing)}
                aria-label={playing ? "Pause radar" : "Play radar"}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <input
                aria-label="Radar timeline"
                type="range"
                min="0"
                max={Math.max(0, frames.length - 1)}
                value={frame}
                onChange={(e) => setFrame(+e.target.value)}
              />
              <span className="numeric">
                {frames[frame]
                  ? new Date(frames[frame].time * 1000).toLocaleTimeString(
                      dateLocale(),
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: city.timezone,
                      },
                    )
                  : "—"}
              </span>
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
              >
                {[0.5, 1, 2].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          <div className="radar-options">
            <button
              className={showWind ? "active" : ""}
              onClick={() => setShowWind((v) => !v)}
              aria-pressed={showWind}
            >
              Wind flow
            </button>
            {fieldMode === "radar" && (
              <>
                <button
                  onClick={() => {
                    if (!radar.data?.satellite?.infrared?.length) {
                      setFieldMode("cloud");
                      return;
                    }
                    setSat(!sat);
                    setFrame(0);
                  }}
                >
                  <Layers size={12} />
                  {radar.data?.satellite?.infrared?.length
                    ? sat
                      ? "Satellite infrared"
                      : "Radar"
                    : "Cloud field"}
                </button>
                <select
                  aria-label="Radar palette"
                  value={color}
                  onChange={(e) => setColor(+e.target.value)}
                >
                  <option value="2">Universal</option>
                  <option value="4">TITAN</option>
                  <option value="6">NEXRAD</option>
                </select>
                <input
                  aria-label="Layer opacity"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={opacity}
                  onChange={(e) => setOpacity(+e.target.value)}
                />
              </>
            )}
          </div>
        </>
      )}
      {(radar.isError || mapError || (sat && !frames.length)) && (
        <p className="small muted">
          {sat && !frames.length
            ? "Infrared frames are not supplied by RainViewer."
            : mapError || "Radar provider is temporarily unavailable."}
        </p>
      )}
      <footer className="radar-footer">
        <button
          onClick={() =>
            experience?.openDive({
              title: "Radar & the wind",
              metric: "wind_speed_10m",
            })
          }
        >
          Read the wind ↗
        </button>
        <span>RAINVIEWER · CARTO · OSM</span>
        <span>
          {globe ? "Drag to rotate · select a city" : "Click map to probe ↗"}
        </span>
      </footer>
    </Glass>
  );
}
