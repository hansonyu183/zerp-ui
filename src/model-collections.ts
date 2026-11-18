import type {
  BusinessCategory,
  BusinessModel,
  Collection,
} from "./business-model";

export function categoryDomains(category: BusinessCategory) {
  return category.members.flatMap((member) =>
    member.kind === "section" ? member.members : [member],
  );
}

/** 栏目和领域只组织入口；集合仍是独立的授权和写入边界。 */
export function modelCollections(model: BusinessModel): Collection[] {
  return model.members.flatMap((member) => {
    if (!("kind" in member)) return [member];
    if (member.kind === "domain") return member.members;
    return categoryDomains(member).flatMap((domain) => domain.members);
  });
}
