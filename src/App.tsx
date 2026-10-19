import { useLanguage } from "./i18n/locale";
import OutdoorHourFinder from "./components/bento/OutdoorHourFinder";
import AltitudeProfileExplorer from "./components/bento/AltitudeProfileExplorer";
import SkyAestheticsCard from "./components/bento/SkyAestheticsCard";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Globe2, ArrowUpRight } from "lucide-react";
import { approximateClimate } from "./api/resilience";
import { todayMean, type Climate } from "./types/telemetry";
import { dateKey } from "./lib/meteorology/time";
import {
  ExperienceContext,
  selectedWeather,
  selectedAir,
  type Workspace,
  type DiveRequest,
} from "./experience/ExperienceContext";
import { useWeatherStore, presets } from "./store/useWeatherStore";
import { getForecast, fetchAir, fetchClimate } from "./api/openMeteoClient";
import { syncLocation, exportTelemetry } from "./lib/export/telemetryExporter";
import AtmosphericSkyCanvas from "./components/canvas/AtmosphericSkyCanvas";
import TopCommandBar from "./components/layout/TopCommandBar";
import WorldCitiesRibbon from "./components/layout/WorldCitiesRibbon";
import LiveClock from "./components/layout/LiveClock";
import CommandPaletteModal from "./components/layout/CommandPaletteModal";
import CityComparisonModal from "./components/layout/CityComparisonModal";
import TimeMachineScrubber from "./components/layout/TimeMachineScrubber";
import SoundscapeMixerPopover from "./components/layout/SoundscapeMixerPopover";
import TelemetryDeepDiveModal from "./components/layout/TelemetryDeepDiveModal";
import HeroSynopticCard from "./components/bento/HeroSynopticCard";
import MinutelyNowcastCard from "./components/bento/MinutelyNowcastCard";
import SynopticWorkbench from "./components/bento/SynopticWorkbench";
import DailyForecastMatrix from "./components/bento/DailyForecastMatrix";
import EphemerisHorizonCard from "./components/bento/EphemerisHorizonCard";
import WindShearCompassCard from "./components/bento/WindShearCompassCard";
import AirQualityPollenCard from "./components/bento/AirQualityPollenCard";
import ThermodynamicsCard from "./components/bento/ThermodynamicsCard";
import AtmosphericColumnCard from "./components/bento/AtmosphericColumnCard";
import ActivityScoringCard from "./components/bento/ActivityScoringCard";
import ClimateAnomalyCard from "./components/bento/ClimateAnomalyCard";
import HumanComfortAndWardrobeCard from "./components/bento/HumanComfortAndWardrobeCard";
import LifestylePlanners from "./components/bento/LifestylePlanners";
import BentoSkeletonGrid from "./components/ui/BentoSkeletonGrid";
const Radar = lazy(() => import("./components/bento/InteractiveRadarMap"));
const views: Workspace[] = ["overview", "radar", "forecast", "intelligence"];
const chapters: Record<
  Workspace,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "THE LIVING STORY",
    title: "Not just the weather. The way the day feels.",
    description: "A little more wonder. A little less second-guessing.",
  },
  radar: {
    eyebrow: "THE PLANET, IN MOTION",
    title: "Find your place in something bigger.",
    description:
      "Follow the rain. Read the wind. Explore the edge of daylight.",
  },
  forecast: {
    eyebrow: "THE FORECAST LAB",
    title: "Every day has more than one possibility.",
    description:
      "Compare the models. Trace the layers. Make a plan with perspective.",
  },
  intelligence: {
    eyebrow: "LIFE, UNDER THIS SKY",
    title: "A forecast for the things you love.",
    description:
      "The ride, the walk, the perfect light. Find the moment that feels right.",
  },
};
let urlRead = false;
export default function App() {
  useLanguage();
  const s = useWeatherStore(),
    [search, setSearch] = useState(false),
    [compare, setCompare] = useState(false),
    [sound, setSound] = useState(false),
    [dive, setDive] = useState<DiveRequest | null>(null),
    [offset, setOffset] = useState(0),
    [workspace, setWorkspace] = useState<Workspace>(() => {
      const v = new URLSearchParams(location.search).get("view") as Workspace;
      return views.includes(v) ? v : "overview";
    });
  const city = s.city;
  useEffect(() => {
    if (urlRead) return;
    urlRead = true;
    const q = new URLSearchParams(location.search),
      lat = Number(q.get("lat")),
      lon = Number(q.get("lon"));
    if (
      q.has("lat") &&
      q.has("lon") &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      Number.isFinite(lon) &&
      Math.abs(lon) <= 180
    )
      s.setCity({
        ...(presets.find(
          (c) =>
            Math.abs(c.latitude - lat) < 0.001 &&
            Math.abs(c.longitude - lon) < 0.001,
        ) ??
          s.saved.find(
            (c) =>
              Math.abs(c.latitude - lat) < 0.001 &&
              Math.abs(c.longitude - lon) < 0.001,
          ) ?? { country: "Selected location", timezone: "UTC" }),
        latitude: lat,
        longitude: lon,
        name: q.get("city") || "Selected location",
      });
  }, []);
  useEffect(() => {
    syncLocation(city);
    setOffset(0);
  }, [city.latitude, city.longitude]);
  const navigate = useCallback((view: Workspace) => {
    setWorkspace(view);
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    url.hash = "";
    history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const pop = () => {
      const v = new URLSearchParams(location.search).get("view") as Workspace;
      setWorkspace(views.includes(v) ? v : "overview");
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
        setDive(null);
        setCompare(false);
        setSound(false);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setCompare(false);
        setDive(null);
        setSound(false);
      }
    };
    addEventListener("keydown", key);
    addEventListener("popstate", pop);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("popstate", pop);
    };
  }, []);
  const weather = useQuery({
      queryKey: ["forecast", city.latitude, city.longitude],
      queryFn: ({ signal }) => getForecast(city, signal),
      staleTime: 600000,
      refetchInterval: 600000,
    }),
    air = useQuery({
      queryKey: ["air", city.latitude, city.longitude],
      queryFn: ({ signal }) => fetchAir(city, signal),
      staleTime: 1800000,
    });
  const source = weather.data,
    w = useMemo(
      () => (source ? selectedWeather(source, offset) : undefined),
      [source, offset],
    ),
    selectedAirData = useMemo(
      () =>
        offset > 0 && w
          ? selectedAir(air.data, w.current.time * 1000)
          : air.data,
      [air.data, w, offset],
    );
  const selectedDate = w
    ? dateKey(new Date(w.current.time * 1000), w.timezone)
    : dateKey(new Date(), city.timezone);
  const climate = useQuery<Climate>({
    queryKey: ["climate", city.latitude, city.longitude, selectedDate],
    queryFn: ({ signal }) =>
      fetchClimate(
        {
          ...city,
          timezone: w?.timezone ?? city.timezone,
          elevation: w?.elevation ?? city.elevation,
        },
        signal,
        w ? new Date(w.current.time * 1000) : new Date(),
      ),
    placeholderData: () =>
      approximateClimate(
        city,
        w ? new Date(w.current.time * 1000) : new Date(),
      ),
    staleTime: 86400000,
    refetchInterval: (query) =>
      query.state.data?.source === "estimated" ? 180000 : false,
    retry: false,
  });
  const openDive = useCallback((request: DiveRequest) => {
      setSound(false);
      setDive(request);
    }, []),
    closeSound = useCallback(() => setSound(false), []);
  const props = w ? { weather: w, air: selectedAirData, city } : null,
    chapter = chapters[workspace];
  const context =
    source && w
      ? {
          source,
          weather: w,
          air: selectedAirData,
          city,
          offset,
          workspace,
          openDive,
          selectTime: (timestamp: number) =>
            setOffset(
              Math.max(
                0,
                Math.min(
                  24,
                  (timestamp - source.current.time * 1000) / 3600000,
                ),
              ),
            ),
        }
      : null;
  const radar = (variant: "preview" | "command" | "planet" = "preview") =>
    props && (
      <Suspense fallback={<div className="glass-card span-12 skeleton" />}>
        <Radar {...props} variant={variant} />
      </Suspense>
    );
  return (
    <ExperienceContext.Provider value={context}>
      <AtmosphericSkyCanvas
        code={w?.current.weather_code}
        wind={w?.current.wind_speed_10m}
        rain={w?.current.precipitation}
        latitude={city.latitude}
        longitude={city.longitude}
        time={w ? w.current.time * 1000 : Date.now()}
      />
      <div className="app-shell" data-workspace={workspace}>
        <TopCommandBar
          status={
            weather.isError
              ? "FEED INTERRUPTED"
              : weather.isPending
                ? "FINDING YOUR SKY"
                : "YOUR SKY IS CONNECTED"
          }
          workspace={workspace}
          onNavigate={navigate}
          onAudio={() => setSound((v) => !v)}
          onSearch={() => {
            setSearch(true);
            setSound(false);
          }}
          onCompare={() => setCompare(true)}
          onExport={(f) => w && exportTelemetry(w, city, f)}
        />
        <WorldCitiesRibbon
          onSearch={() => setSearch(true)}
          onCompare={() => setCompare(true)}
        />
        <main>
          <div
            className={`workspace-heading ${workspace === "overview" ? "overview-heading" : ""}`}
          >
            <div>
              <span className="eyebrow">{chapter.eyebrow}</span>
              <h2>{chapter.title}</h2>
              <p>{chapter.description}</p>
            </div>
            <LiveClock
              timezone={w?.timezone || city.timezone}
              fetching={weather.isFetching}
              refresh={() => void weather.refetch()}
            />
          </div>
          {weather.isPending && <BentoSkeletonGrid />}
          {weather.isError && (
            <div className="forecast-error glass-card">
              <Globe2 size={45} />
              <h2>We lost the thread of the sky.</h2>
              <p>
                {weather.error.message}. Let’s try the public forecast service
                again.
              </p>
              <button onClick={() => void weather.refetch()}>
                <RefreshCw size={18} />
                Reconnect
              </button>
              <button onClick={() => setSearch(true)}>Try another place</button>
            </div>
          )}
          {props && w && source && (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  className={`dashboard ${workspace}-workspace`}
                  key={workspace}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {workspace === "overview" ? (
                    <>
                      <HeroSynopticCard
                        {...props}
                        anomaly={
                          climate.data && climate.data.source !== "estimated"
                            ? todayMean(w) - climate.data.mean
                            : undefined
                        }
                      />
                      <TimeMachineScrubber
                        weather={source}
                        offset={offset}
                        onChange={setOffset}
                      />
                      <HumanComfortAndWardrobeCard {...props} />
                      <MinutelyNowcastCard {...props} />
                      <EphemerisHorizonCard {...props} />
                      <div className="dashboard-section span-12">
                        <span>THE BIGGER PICTURE</span>
                        <button onClick={() => navigate("radar")}>
                          Step into the planet
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                      {radar()}
                      <WindShearCompassCard {...props} />
                      <AirQualityPollenCard {...props} />
                      <SynopticWorkbench {...props} />
                      <ThermodynamicsCard {...props} />
                      <DailyForecastMatrix {...props} />
                      <SkyAestheticsCard {...props} />
                    </>
                  ) : workspace === "radar" ? (
                    <>
                      <TimeMachineScrubber
                        weather={source}
                        offset={offset}
                        onChange={setOffset}
                      />
                      {radar("command")}
                      {radar("planet")}
                      <div className="radar-field-note span-12">
                        <span className="live-dot" />
                        <p>
                          The radar timeline is observed radar history. The
                          atmospheric time machine previews forecast weather; it
                          never invents future radar imagery.
                        </p>
                      </div>
                      <WindShearCompassCard {...props} />
                      <AtmosphericColumnCard {...props} />
                      <MinutelyNowcastCard {...props} />
                    </>
                  ) : workspace === "forecast" ? (
                    <>
                      <TimeMachineScrubber
                        weather={source}
                        offset={offset}
                        onChange={setOffset}
                      />
                      <SynopticWorkbench {...props} forceEnsemble />
                      <AltitudeProfileExplorer {...props} />
                      <DailyForecastMatrix {...props} />
                      <SkyAestheticsCard {...props} />
                      <AtmosphericColumnCard {...props} />
                      <ClimateAnomalyCard
                        {...props}
                        climate={climate.data}
                        loading={climate.isPending}
                        error={climate.isError}
                      />
                      <EphemerisHorizonCard {...props} />
                      <ThermodynamicsCard {...props} />
                    </>
                  ) : (
                    <>
                      <TimeMachineScrubber
                        weather={source}
                        offset={offset}
                        onChange={setOffset}
                      />
                      <OutdoorHourFinder {...props} />
                      <LifestylePlanners {...props} />
                      <SkyAestheticsCard {...props} />
                      <ActivityScoringCard {...props} />
                      <HumanComfortAndWardrobeCard {...props} />
                      <CityComparisonModal embedded onClose={() => undefined} />
                      <AirQualityPollenCard {...props} />
                      <ThermodynamicsCard {...props} />
                      <WindShearCompassCard {...props} />
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
          <footer className="site-footer">
            <button
              className="brand footer-brand"
              onClick={() => navigate("overview")}
            >
              <Globe2 size={22} />
              AETHERIS<span className="pro">PRO</span>
            </button>
            <span>Same planet. A little more feeling.</span>
            <div>
              <span className="live-dot" />
              Live open data
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Data & attribution ↗
              </a>
            </div>
          </footer>
        </main>
      </div>
      <SoundscapeMixerPopover open={sound} onClose={closeSound} weather={w} />
      {search && <CommandPaletteModal onClose={() => setSearch(false)} />}
      {compare && <CityComparisonModal onClose={() => setCompare(false)} />}
      <AnimatePresence>
        {dive && context && (
          <TelemetryDeepDiveModal
            key={`${dive.title}-${dive.activity ?? ""}-${dive.time ?? ""}`}
            request={dive}
            onClose={() => setDive(null)}
          />
        )}
      </AnimatePresence>
    </ExperienceContext.Provider>
  );
}
