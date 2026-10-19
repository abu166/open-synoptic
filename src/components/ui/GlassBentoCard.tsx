import type { ReactNode, MouseEvent, CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  type DiveRequest,
  useExperience,
} from "../../experience/ExperienceContext";
export function useMouseGlow() {
  return (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  };
}
export default function GlassBentoCard({
  title,
  eyebrow,
  children,
  className = "",
  action,
  style,
  dive,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  style?: CSSProperties;
  dive?: DiveRequest;
}) {
  const glow = useMouseGlow(),
    experience = useExperience();
  const open = () => experience?.openDive(dive ?? { title });
  return (
    <section
      className={`glass-card ${className}`}
      data-weather={
        experience
          ? experience.weather.current.temperature_2m < 0
            ? "frost"
            : experience.weather.current.precipitation > 0.05
              ? "rain"
              : undefined
          : undefined
      }
      style={style}
      onMouseMove={glow}
      onClick={(e) => {
        if (
          (e.target as Element).closest(
            'button,a,input,label,select,canvas,[role="slider"],[role="button"],.maplibregl-map,.globe-svg',
          )
        )
          return;
        open();
      }}
    >
      <header className="card-heading">
        <div>
          <span className="eyebrow">{eyebrow || "YOUR ATMOSPHERE"}</span>
          <h2>{title}</h2>
        </div>
        <div className="card-actions">
          {action}
          <button
            className="deep-dive-trigger"
            aria-label={`Explore ${title}`}
            onClick={open}
          >
            <ArrowUpRight size={21} />
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}
