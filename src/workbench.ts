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
  sections?: readonly {
    key: "vouchers" | "reports" | "masters" | "information";
    title: string;
    empty: string;
  }[];
  informationTitle?: string;
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
  nameLabel?: string;
  instance: string | number;
  adapter: WorkbenchPreferencesAdapter<K>;
};

import {
  defineWorkbenchPage,
  defineWorkbenchPreferencesPage,
  type PageDefinition,
} from "./pages";
import type { BusinessObject } from "./model";
/** Workbench sections retain their business shape and use the model's order. */
export function defineBusinessWorkbenchPage(
  options: Omit<WorkbenchPage, "title" | "sections" | "informationTitle"> & {
    model: BusinessObject;
  },
): PageDefinition {
  const { model } = options;
  const keys = model.form?.fields ?? [];
  if (
    keys.length !== 4 ||
    new Set(keys).size !== 4 ||
    !["vouchers", "reports", "masters", "information"].every(
      (key) => keys.includes(key) && model.properties[key],
    )
  )
    throw Error("工作台分区定义不完整。");
  return defineWorkbenchPage({
    ...options,
    title: model.name,
    informationTitle: model.properties.information!.name,
    sections: keys.map((path) => {
      const key = path as "vouchers" | "reports" | "masters" | "information";
      return {
        key,
        title: model.properties[key]!.name,
        empty: `暂无${model.properties[key]!.name}`,
      };
    }),
  });
}

/** Preference identity and desired state remain in the typed idempotent adapter. */
export function defineBusinessWorkbenchPreferencesPage<K>(
  model: BusinessObject,
  options: Omit<WorkbenchPreferencesPage<K>, "title" | "nameLabel">,
): PageDefinition {
  if (
    model.properties.name?.kind !== "text" ||
    model.properties.added?.kind !== "boolean"
  )
    throw Error("常用项定义不完整。");
  return defineWorkbenchPreferencesPage({
    ...options,
    title: model.name,
    nameLabel: model.properties.name.name,
  });
}
