import { createContext, useContext, useSyncExternalStore } from "react";
import { catalog } from "./messages.ts";
export type Language = "en" | "kk" | "ru";
export const languages: { code: Language; label: string }[] = [
  { code: "en", label: "English" }, { code: "kk", label: "Қазақша" }, { code: "ru", label: "Русский" },
];
let language: Language = "en";
try { const saved = typeof window === "undefined" ? null : localStorage.getItem("aetheris-language"); if (saved === "kk" || saved === "ru") language = saved; } catch {}
const listeners = new Set<() => void>();
export const LocaleContext = createContext<Language>(language);
export function useLanguage() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => language, () => "en" as Language);
}
export function useLocaleContext() { return useContext(LocaleContext); }
export function setLanguage(next: Language) {
  if (!languages.some((l) => l.code === next)) return;
  language = next;
  try { if (typeof window !== "undefined") localStorage.setItem("aetheris-language", next); } catch {}
  if (typeof document !== "undefined") {
  document.documentElement.lang = next;
  document.title = next === "kk" ? "AETHERIS PRO · Ғаламшар деректері" : next === "ru" ? "AETHERIS PRO · Планетарная аналитика" : "AETHERIS PRO · Planetary intelligence";
  }
  listeners.forEach((listener) => listener());
}
export function dateLocale() { return language === "kk" ? "kk-KZ" : language === "ru" ? "ru-RU" : "en-GB"; }
export function apiLanguage() { return language; }
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
const exact = new Map(Object.entries(catalog).sort(([a], [b]) => Number(b === b.toUpperCase()) - Number(a === a.toUpperCase())).map(([key, values]) => [normalize(key).toLowerCase(), values]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(catalog).filter(([key]) => /\{\d+\}/.test(key)).map(([key, values]) => {
  const slots: number[] = [];
  const parts = key.split(/(\{\d+\})/g).map((part) => { const match = /^\{(\d+)\}$/.exec(part); if (!match) return escape(part); slots.push(+match[1]); return /^\{0\}[\sA-Za-z°%µ³²₀₂₅.\/×-]*$/.test(key) ? "([-+−]?[0-9]+(?:[.,][0-9]+)?)" : "(.+?)"; });
  return { regex: new RegExp(`^${parts.join("")}$`, "i"), slots, values, specificity: key.replace(/\{\d+\}/g, "").length };
}).sort((a, b) => b.specificity - a.specificity);
const cache = new Map<string, string>();
export const untranslated = new Set<string>();
if (typeof window !== "undefined") Object.defineProperty(window, "__aetherisI18n", { configurable: true, get: () => ({ language, missing: [...untranslated] }) });
export function translate(input: string, locale: Language = language, depth = 0): string {
  if (locale === "en" || !/[a-zA-Z]/.test(input) || depth > 8) return input;
  const text = normalize(input), cacheKey = `${locale}:${text}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return input.replace(input.trim(), cached);
  const direct = exact.get(text.toLowerCase());
  let result: string | undefined = direct?.[locale === "kk" ? 0 : 1];
  if (result === undefined) for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const params: Record<number, string> = {};
    pattern.slots.forEach((slot, i) => { params[slot] = translate(match[i + 1], locale, depth + 1); });
    result = pattern.values[locale === "kk" ? 0 : 1].replace(/\{(\d+)\}/g, (_, index) => params[+index] ?? "");
    break;
  }
  if (result === undefined) {
    // Rendered compound labels retain separators, numbers and scientific symbols.
    const parts = text.split(/(\s*[·—]\s*|\n|:\s+)/);
    if (parts.length > 1) {
      const mapped = parts.map((part) => translate(part, locale, depth + 1)).join("");
      if (mapped !== text) result = mapped;
    }
  }
  if (result === undefined) {
    // Weather narratives combine independently translated complete sentences.
    const boundaries = [...text.matchAll(/[.!?]\s+(?=[A-Z])/g)].map((match) => match.index + 1);
    for (const boundary of boundaries.reverse()) {
      const prefix = text.slice(0, boundary);
      if (!exact.has(prefix.toLowerCase())) continue;
      result = `${translate(prefix, locale, depth + 1)} ${translate(text.slice(boundary).trim(), locale, depth + 1)}`;
      break;
    }
  }
  if (result === undefined) {
    untranslated.add(text);
    return input;
  }
  if (text === text.toUpperCase() && /[A-Z]{3}/.test(text)) result = result.toLocaleUpperCase(dateLocale());
  if (cache.size > 5000) cache.clear();
  cache.set(cacheKey, result);
  return input.replace(input.trim(), result);
}

const monthNames = {
  kk: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};
const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function localizedDate(date: Date, options: Intl.DateTimeFormatOptions) {
  if (language === "en") return new Intl.DateTimeFormat("en-GB", options).format(date);
  return new Intl.DateTimeFormat("en-GB", options).formatToParts(date).map((part) => {
    if (part.type === "weekday") return translate(part.value);
    if (part.type === "month" && options.month && !["numeric", "2-digit"].includes(options.month)) {
      const index = englishMonths.findIndex((name) => name.startsWith(part.value));
      return index < 0 ? part.value : monthNames[language === "kk" ? "kk" : "ru"][index];
    }
    return part.value;
  }).join("");
}
