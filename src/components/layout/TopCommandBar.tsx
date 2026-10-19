import { useLanguage, setLanguage, languages } from "../../i18n/locale";
import { AudioEqualizer } from "../canvas/AudioOscilloscope";
import type { Workspace } from "../../experience/ExperienceContext";
import {
  Search,
  Download,
  Layers,
  Globe2,
  ChevronDown,
  Command,
} from "lucide-react";
import { useWeatherStore } from "../../store/useWeatherStore";
import type { Units } from "../../types/telemetry";
export default function TopCommandBar({
  onSearch,
  onExport,
  onCompare,
  status,
  workspace,
  onNavigate,
  onAudio,
}: {
  status: string;
  workspace: Workspace;
  onNavigate: (view: Workspace) => void;
  onAudio: () => void;
  onSearch: () => void;
  onExport: (f: "json" | "csv") => void;
  onCompare: () => void;
}) {
  const s = useWeatherStore();
  const language = useLanguage();
  return (
    <>
      <header className="top-bar">
        <a href="./" className="brand">
          <div className="brand-mark">
            <Globe2 size={25} />
          </div>
          AETHERIS<span className="pro">PRO</span>
        </a>
        <nav className="main-nav" aria-label="Weather workspaces">
          {(
            [
              { key: "overview", name: "Overview" },
              { key: "radar", name: "Radar & satellite" },
              { key: "forecast", name: "Forecast" },
              { key: "intelligence", name: "Intelligence" },
            ] as const
          ).map((view) => (
            <button
              key={view.key}
              className={workspace === view.key ? "selected" : ""}
              aria-current={workspace === view.key ? "page" : undefined}
              onClick={() => onNavigate(view.key)}
            >
              {view.name}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <select className="language-picker" aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <span className="live-status">
            <i /> {status}
          </span>
          <button
            className="avatar"
            onClick={onCompare}
            title="Compare locations"
          >
            <Globe2 size={14} />
          </button>
        </div>
      </header>
      <div className="control-row">
        <div className="breadcrumb">
          WORKSPACE <span>/</span> GLOBAL OBSERVATORY
        </div>
        <div className="controls">
          <button className="search-button" onClick={onSearch}>
            <Search size={14} />
            Search location{" "}
            <kbd>
              <Command size={10} /> K
            </kbd>
          </button>
          <select
            aria-label="Measurement system"
            value={s.units}
            onChange={(e) => s.setUnits(e.target.value as Units)}
          >
            <option value="metric">°C · km/h</option>
            <option value="imperial">°F · mph</option>
            <option value="aviation">°C · knots</option>
          </select>
          <button
            aria-label="Open soundscape studio"
            className={`studio-header-button ${s.audio ? "active" : ""}`}
            onClick={onAudio}
          >
            <AudioEqualizer active={s.audio} />
          </button>
          <button
            title="Multi-model ensemble"
            className={s.ensemble ? "active" : ""}
            onClick={s.toggleEnsemble}
          >
            <Layers size={15} />
            <span>Ensemble</span>
          </button>
          <div className="export-menu">
            <button>
              <Download size={15} />
              <span>Export</span>
              <ChevronDown size={12} />
            </button>
            <div className="export-options">
              <button onClick={() => onExport("json")}>Download JSON</button>
              <button onClick={() => onExport("csv")}>Download CSV</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
