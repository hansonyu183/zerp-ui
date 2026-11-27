// 路由、侧栏、节点归属共用模型中的静态层级与顺序。
import { computed } from "vue";
import type {
  DomainGroup,
  DomainSection,
  ListCollection,
  Workbench,
} from "../../model/business-model";
import { currentModel } from "../session";

type DomainEntry = {
  domain: DomainGroup;
  path: string[];
  section?: DomainSection;
};

// 导航、路由和节点索引共用业务模型的静态顺序与路径。
export const workGroups = computed(() =>
  (currentModel.value?.work.members ?? []).map((member) => {
    const domains: DomainEntry[] = [];
    if ("kind" in member) {
      if (member.kind === "domain")
        domains.push({ domain: member, path: [member.key] });
      else {
        for (const child of member.members) {
          if (child.kind === "domain")
            domains.push({ domain: child, path: [member.key, child.key] });
          else
            for (const domain of child.members)
              domains.push({
                domain,
                path: [member.key, child.key, domain.key],
                section: child,
              });
        }
      }
    }
    return { member, domains };
  }),
);
export const collectionEntries = computed(() =>
  workGroups.value.flatMap<{
    collection: ListCollection;
    path: string[];
    domain?: DomainGroup;
  }>(({ member, domains }) => {
    if (!("kind" in member))
      return [{ collection: member, path: [member.key], domain: undefined }];
    return domains.flatMap(({ domain, path }) =>
      domain.members.map((collection) => ({
        collection,
        path: [...path, collection.key],
        domain,
      })),
    );
  }),
);

export function workbenchSections(workbench: Workbench) {
  return (["information", "vouchers", "reports", "masters"] as const).map(
    (role) => ({ role, node: workbench[role] }),
  );
}
