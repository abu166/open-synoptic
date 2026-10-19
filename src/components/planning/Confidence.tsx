import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { City } from "../../types/telemetry";
import type { Window } from "../../lib/planning/plans";
import { fetchMembers, memberSummary } from "../../api/planningClient";
export default function Confidence({
  city,
  window,
  gust,
}: {
  city: City;
  window: Window;
  gust: number;
}) {
  const [opened, setOpened] = useState(false);
  const q = useQuery({
    queryKey: ["members", city.latitude, city.longitude],
    queryFn: ({ signal }) => fetchMembers(city, signal),
    staleTime: 3600000,
    retry: false,
    enabled: opened,
  });
  const m = q.data ? memberSummary(q.data, window.start, gust) : null;
  return (
    <details
      className="decision-details"
      onToggle={(e) => setOpened(e.currentTarget.open)}
    >
      <summary>How much do the forecasts agree?</summary>
      {q.isPending ? (
        <p>Loading real ensemble members…</p>
      ) : q.isError ? (
        <p>
          Ensemble unavailable. This recommendation uses the primary forecast
          only.
        </p>
      ) : m ? (
        <>
          <p>
            ICON ensemble · {m.rainN} precipitation members ·{" "}
            {q.data?.provenance?.source === "cached"
              ? "Saved response"
              : "Provider response"}
          </p>
          <div className="decision-metrics">
            <span>
              <b>{m.wet === null ? "—" : `${Math.round(m.wet * 100)}%`}</b>
              members with ≥0.1 mm rain in the departure hour
            </span>
            <span>
              <b>{m.gust === null ? "—" : `${Math.round(m.gust * 100)}%`}</b>
              members above your gust limit in the departure hour
            </span>
            <span>
              <b>
                {m.low === null
                  ? "—"
                  : `${m.low.toFixed(0)}–${m.high?.toFixed(0)}°C`}
              </b>
              temperature P10–P90
            </span>
          </div>
          <p className="panel-note">
            Raw ensemble fractions for the departure hour, not calibrated odds
            for the whole outing. Generated scenarios are excluded.{" "}
            {m.rainN < 10 ? "Few precipitation members are available." : ""}
          </p>
        </>
      ) : null}
    </details>
  );
}
