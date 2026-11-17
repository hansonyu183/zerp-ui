import type { BusinessModel, Collection } from "./business-model";

/** 领域只组织入口；每个集合仍作为独立授权、查询和写入边界。 */
export function modelCollections(model: BusinessModel): Collection[] {
  return Object.values(model.members).flatMap((member) =>
    "kind" in member ? Object.values(member.members) : [member],
  );
}
