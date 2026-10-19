import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validatePlan, type Plan } from "../lib/planning/plans.ts";
import type { Snapshot, Change } from "../lib/planning/history.ts";
import { updateHistory } from "../lib/planning/history.ts";
interface PlanningStore {
  plans: Plan[];
  history: Record<string, Snapshot[]>;
  feed: Record<string, Change[]>;
  feedback: Record<string, "Helpful" | "Too cold" | "Too windy" | "Too wet">;
  save: (p: Plan) => void;
  remove: (id: string) => void;
  capture: (key: string, s: Snapshot) => void;
  respond: (
    id: string,
    value: "Helpful" | "Too cold" | "Too windy" | "Too wet",
  ) => void;
  clearFeed: (key: string) => void;
}
export const usePlanningStore = create<PlanningStore>()(
  persist(
    (set) => ({
      plans: [],
      history: {},
      feed: {},
      feedback: {},
      save: (p) => {
        if (validatePlan(p))
          set((s) => ({
            plans: [p, ...s.plans.filter((x) => x.id !== p.id)].slice(0, 30),
          }));
      },
      remove: (id) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      capture: (key, next) =>
        set((s) => {
          const result = updateHistory(
            s.history[key] ?? [],
            next,
            s.feed[key] ?? [],
          );
          const keys = [
            key,
            ...Object.keys(s.history).filter((k) => k !== key),
          ].slice(0, 10);
          return {
            history: Object.fromEntries(
              keys.map((k) => [k, k === key ? result.history : s.history[k]]),
            ),
            feed: Object.fromEntries(
              keys.map((k) => [k, k === key ? result.feed : (s.feed[k] ?? [])]),
            ),
          };
        }),
      respond: (id, value) =>
        set((s) => ({ feedback: { ...s.feedback, [id]: value } })),
      clearFeed: (key) => set((s) => ({ feed: { ...s.feed, [key]: [] } })),
    }),
    {
      name: "aetheris-planning-v1",
      partialize: (s) => ({
        plans: s.plans,
        history: s.history,
        feed: s.feed,
        feedback: s.feedback,
      }),
      merge: (saved, current) => {
        const data = saved as Partial<PlanningStore> | undefined;
        return {
          ...current,
          ...data,
          plans: Array.isArray(data?.plans)
            ? data.plans.filter(validatePlan).slice(0, 30)
            : [],
        };
      },
    },
  ),
);
