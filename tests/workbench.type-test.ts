import {
  defineWorkbenchPage,
  defineWorkbenchPreferencesPage,
  type WorkbenchPreferencesAdapter,
} from "@zerp/ui";
type Key = { kind: "report" | "ds"; id: string };
const adapter: WorkbenchPreferencesAdapter<Key> = {
  load: async () => [
    {
      id: "report:a",
      key: { kind: "report", id: "a" },
      name: "报表",
      added: false,
    },
  ],
  async setAdded({ key, added, signal }) {
    const id: string = key.id;
    const value: boolean = added;
    void [id, value, signal];
  },
};
defineWorkbenchPreferencesPage({ title: "管理", instance: "a", adapter });
defineWorkbenchPreferencesPage<string>({
  title: "管理",
  instance: "a",
  // @ts-expect-error Cannot pair string keys with an object-key adapter.
  adapter,
});
const home = {
  title: "工作台",
  instance: "a",
  adapter: {
    load: async () => ({
      vouchers: { items: [] },
      reports: { items: [] },
      masters: { items: [] },
      information: [],
    }),
  },
};
defineWorkbenchPage(home);
// @ts-expect-error No consumer-rendered layout.
defineWorkbenchPage({ ...home, render: () => null });
// @ts-expect-error No consumer component through a getter.
defineWorkbenchPreferencesPage(() => ({
  title: "管理",
  instance: "a",
  adapter,
  component: {},
}));
