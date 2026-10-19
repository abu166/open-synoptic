const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function dateKey(date: Date, timezone: string) {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timezone, formatter);
  }
  const p = formatter.formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function zonedMidnight(date: Date, timezone: string) {
  const day = dateKey(date, timezone),
    utc = Date.parse(`${day}T00:00:00Z`);
  const offset = (timestamp: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const get = (key: string) =>
      Number(parts.find((p) => p.type === key)?.value);
    return (
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
      ) - timestamp
    );
  };
  let candidate = utc - offset(utc);
  candidate = utc - offset(candidate);
  return new Date(candidate);
}
