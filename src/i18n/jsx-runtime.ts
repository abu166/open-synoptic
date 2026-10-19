import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from "react/jsx-runtime";
import type { ElementType, ReactNode } from "react";
import { useLanguage, translate } from "./locale";
export type { JSX } from "react/jsx-runtime";
export { Fragment };
type Props = Record<string, unknown> & { children?: ReactNode };
function content(value: ReactNode): ReactNode {
  if (typeof value === "string") return translate(value);
  if (Array.isArray(value)) {
    // JSX splits interpolated labels into adjacent strings and numbers.
    const result: ReactNode[] = [];
    let run: (string | number)[] = [];
    const flush = () => {
      if (!run.length) return;
      const source = run.join("");
      const translated = translate(source);
      result.push(...(translated === source ? run.map(content) : [translated]));
      run = [];
    };
    for (const child of value) {
      if (typeof child === "string" || typeof child === "number") run.push(child);
      else { flush(); result.push(content(child)); }
    }
    flush();
    return result;
  }
  return value;
}
function LocalizedElement({ element, attributes }: { element: ElementType; attributes: Props }) {
  const locale = useLanguage();
  const props: Props = { ...attributes, children: element === "style" || element === "script" ? attributes.children : content(attributes.children) };
  for (const key of ["aria-label", "aria-description", "aria-valuetext", "title", "placeholder", "alt"]) {
    if (typeof attributes[key] === "string") props[key] = translate(attributes[key] as string, locale);
  }
  return reactJsx(element, props);
}
// Localize at React's render boundary; no DOM mutation, text replacement observers or remote translation service.
export function jsx(type: ElementType, props: Props, key?: string) {
  return typeof type === "string" ? reactJsx(LocalizedElement, { element: type, attributes: props }, key) : reactJsx(type, props, key);
}
export function jsxs(type: ElementType, props: Props, key?: string) {
  return typeof type === "string" ? reactJsx(LocalizedElement, { element: type, attributes: props }, key) : reactJsxs(type, props, key);
}
