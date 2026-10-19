import { dateLocale } from "../../i18n/locale";
export const timeLabel = (t: number, zone: string) =>
  new Date(t).toLocaleString(dateLocale(), {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
