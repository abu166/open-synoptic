import { dateLocale } from "../../i18n/locale";
import { useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
export default function LiveClock({
  timezone,
  refresh,
  fetching,
}: {
  timezone: string;
  refresh: () => void;
  fetching: boolean;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="local-clock">
      <Radio size={12} /> LIVE{" "}
      <span className="numeric">
        {now.toLocaleTimeString(dateLocale(), { timeZone: timezone })}
      </span>
      <span>{timezone}</span>
      <button aria-label="Refresh telemetry" onClick={refresh}>
        <RefreshCw size={13} className={fetching ? "spin" : ""} />
      </button>
    </span>
  );
}
