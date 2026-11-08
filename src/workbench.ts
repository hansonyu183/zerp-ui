import type { RouteLocationRaw } from "vue-router";
import type { NavigationIcon } from "./shell";

export type WorkbenchRequest = Readonly<{ scope: string; signal: AbortSignal }>;
export type WorkbenchLink = Readonly<{
  key: string;
  name: string;
  to: RouteLocationRaw;
  icon?: NavigationIcon;
}>;
export type WorkbenchSection = Readonly<{
  items: readonly WorkbenchLink[];
  description?: string;
}>;
export type WorkbenchSnapshot = Readonly<{
  vouchers: WorkbenchSection;
  reports: WorkbenchSection;
  masters: WorkbenchSection;
  information: readonly Readonly<{ key: string; text: string }>[];
}>;
export type WorkbenchAdapter = Readonly<{
  load(request: WorkbenchRequest): Promise<WorkbenchSnapshot>;
}>;
export type WorkbenchPage = {
  title: string;
  instance: string | number;
  adapter: WorkbenchAdapter;
  manageReportsTo?: RouteLocationRaw;
};
export type WorkbenchPreference<K> = Readonly<{
  /** Stable UI identity; distinct domain kinds must use distinct IDs. */
  id: string;
  key: K;
  name: string;
  added: boolean;
}>;
export type WorkbenchPreferencesAdapter<K> = Readonly<{
  load(request: WorkbenchRequest): Promise<readonly WorkbenchPreference<K>[]>;
  /** Must set an idempotent desired preference, never toggle or execute business commands. */
  setAdded(
    request: WorkbenchRequest & { key: K; added: boolean },
  ): Promise<void>;
}>;
export type WorkbenchPreferencesPage<K> = {
  title: string;
  instance: string | number;
  adapter: WorkbenchPreferencesAdapter<K>;
};
