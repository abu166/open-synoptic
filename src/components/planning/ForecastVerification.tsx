import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Download } from "lucide-react";
import type { City } from "../../types/telemetry";
import { fetchVerification } from "../../api/planningClient";
import { downloadFile } from "../../lib/planning/plans";
export default function ForecastVerification({ city }: { city: City }) {
  const [enabled, setEnabled] = useState(false),
    [variable, setVariable] = useState("temperature_2m");
  const q = useQuery({
    queryKey: ["verification", city.latitude, city.longitude],
    queryFn: ({ signal }) => fetchVerification(city, signal),
    enabled,
    staleTime: 86400000,
    retry: false,
  });
  const rows = q.data?.rows.filter((r) => r.variable === variable) ?? [];
  const unit =
    variable === "temperature_2m"
      ? "°C"
      : variable === "wind_speed_10m"
        ? "km/h"
        : "mm/h";
  return (
    <section
      className="glass-card span-12 verification-panel"
      aria-label="Forecast verification"
    >
      <header className="card-heading">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={14} /> EVIDENCE, OVER TIME
          </span>
          <h2>How did the forecasts perform here?</h2>
        </div>
      </header>
      <p>
        Compare ECMWF, GFS and ICON predictions issued 24 and 72 hours before
        the same valid hour against ERA5 reanalysis at {city.name}.
      </p>
      {!enabled ? (
        <div className="plan-empty">
          <p>
            Load a recent 15-day sample ending seven days ago, allowing for
            archive publication delays.
          </p>
          <button onClick={() => setEnabled(true)}>
            Load forecast verification
          </button>
        </div>
      ) : (
        <>
          <div className="decision-toolbar">
            <label>
              Weather variable{" "}
              <select
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                <option value="temperature_2m">Temperature</option>
                <option value="wind_speed_10m">Wind speed</option>
                <option value="precipitation">Precipitation amount</option>
              </select>
            </label>
            {q.data && (
              <button
                onClick={() =>
                  downloadFile(
                    "aetheris-verification.json",
                    JSON.stringify(
                      { city, ...q.data, reference: "ERA5 reanalysis" },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Download size={15} />
                Export evidence
              </button>
            )}
          </div>
          {q.isPending && (
            <p role="status">Loading archived forecasts and ERA5…</p>
          )}
          {q.isError && (
            <div role="alert">
              <p>
                Verification data unavailable. No accuracy estimate has been
                generated.
              </p>
              <button onClick={() => void q.refetch()}>
                Retry verification
              </button>
            </div>
          )}
          {q.data && (
            <>
              <p>
                {q.data.start}–{q.data.end} · hourly UTC alignment · reference:
                ERA5 reanalysis
              </p>
              <div className="verification-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Lead time</th>
                      <th>Valid pairs</th>
                      <th>Mean absolute error ({unit})</th>
                      <th>Bias ({unit})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.model}-${r.lead}`}>
                        <th>{r.model}</th>
                        <td>{r.lead * 24}h</td>
                        <td>{r.n}</td>
                        <td>
                          {r.mae === null ? "Unavailable" : r.mae.toFixed(2)}
                        </td>
                        <td>
                          {r.bias === null
                            ? "Unavailable"
                            : `${r.bias >= 0 ? "+" : ""}${r.bias.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.every((r) => r.n === 0) && (
                <p>
                  No matching archive samples. The selected models or dates may
                  not be available.
                </p>
              )}
            </>
          )}
        </>
      )}
      <p className="panel-note">
        ERA5 is a gridded reconstruction, not a local station observation.
        Missing pairs are excluded. Positive bias means overprediction. This
        short descriptive sample does not establish calibrated confidence or
        justify automatic model weighting. Probability calibration and realized
        plan success need a suitable observation record.
      </p>
      <a
        href="https://open-meteo.com/en/docs/previous-runs-api"
        target="_blank"
        rel="noreferrer"
      >
        Forecast archive methodology ↗
      </a>
    </section>
  );
}
