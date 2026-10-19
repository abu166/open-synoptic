import { useLanguage } from "../../i18n/locale";
import { useDialog } from "../../lib/ui/useDialog";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, LocateFixed, X, MapPin, ArrowUpRight } from "lucide-react";
import { searchCities } from "../../api/openMeteoClient";
import { reverseGeocode } from "../../api/nominatimClient";
import { useWeatherStore, presets } from "../../store/useWeatherStore";
import type { City } from "../../types/telemetry";
const hotspots: City[] = [
  ...presets,
  {
    name: "Singapore",
    country: "Singapore",
    latitude: 1.35,
    longitude: 103.82,
    timezone: "Asia/Singapore",
  },
  {
    name: "Atacama",
    country: "Chile",
    latitude: -23.86,
    longitude: -69.13,
    timezone: "America/Santiago",
  },
  {
    name: "Mount Washington",
    country: "United States",
    latitude: 44.27,
    longitude: -71.3,
    timezone: "America/New_York",
  },
];
export default function CommandPaletteModal({
  onClose,
}: {
  onClose: () => void;
}) {
  useDialog();
  const language = useLanguage();
  const s = useWeatherStore(),
    [text, setText] = useState(""),
    [term, setTerm] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [onClose]);
  const q = useQuery({
    queryKey: ["geocoding", language, term],
    queryFn: ({ signal }) => searchCities(term, signal),
    enabled: term.length >= 2,
  });
  const choose = (c: City) => {
    s.setCity(c);
    onClose();
  };
  const gps = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is unavailable in this browser.");
      return;
    }
    setError("Locating…");
    navigator.geolocation?.getCurrentPosition(
      async (p) => {
        try {
          choose(await reverseGeocode(p.coords.latitude, p.coords.longitude));
        } catch {
          setError("Reverse lookup unavailable. Try a city search.");
        }
      },
      (e) => setError(e.message),
      { timeout: 15000 },
    );
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="command-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search global locations"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-search">
          <Search size={20} />
          <input
            autoFocus
            placeholder="Search any city on Earth…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <button className="gps-button" onClick={gps}>
          <LocateFixed size={17} />
          Use my precise location
          <ArrowUpRight size={15} />
        </button>
        {error && <p className="error">{error}</p>}
        <div className="eyebrow">
          {term ? "SEARCH RESULTS" : "RECENT LOCATIONS"}
        </div>
        <div className="location-results">
          {(term ? (q.data ?? []) : s.saved).map((c) => (
            <button
              key={`${c.latitude}-${c.longitude}`}
              onClick={() => choose(c)}
            >
              <MapPin size={17} />
              <span>
                {c.name}
                <small>
                  {c.country} · {c.latitude.toFixed(2)}°,{" "}
                  {c.longitude.toFixed(2)}°
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {q.isFetching && <p>Searching the globe…</p>}
          {q.isError && (
            <p className="error">Search unavailable. Please retry.</p>
          )}
          {term && !q.isFetching && q.data?.length === 0 && (
            <p>No matching locations.</p>
          )}
        </div>
        <div className="eyebrow">EXPLORE THE EXTREMES</div>
        <div className="hotspots">
          {hotspots.map((c) => (
            <button key={c.name} onClick={() => choose(c)}>
              {c.name}
            </button>
          ))}
        </div>
        <footer>
          GLOBAL GEOCODING <span>Open-Meteo · OpenStreetMap</span>
        </footer>
      </div>
    </div>
  );
}
