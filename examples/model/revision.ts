import {
  object,
  text,
  boolean,
  reference,
  array,
  permission,
  type ModelApplicationOptions,
  type ReferenceOperations,
} from "@zerp/ui/model";

/** Synthetic directory and authorization facts; no API, discovery or production data. */
export function revisionNode(options: ModelApplicationOptions) {
  const dependency = text("目录依赖", { value: "甲" });
  const directory: ReferenceOperations = {
    load: {
      async run({ input }) {
        console.info("synthetic-directory-load");
        return Array.from({ length: 45 }, (_, index) => ({
          id: String(index),
          label: `${input.dependencies[0]}候选${index}`,
          selectable: index !== 1,
        }));
      },
    },
  };
  const choice = () =>
    reference("多选项", { operations: directory, dependencies: [dependency] });
  const node = object(
    "权限与引用",
    {
      limited: boolean("普通用户视图", { value: false }),
      dependency,
      first: reference("首个目录", {
        operations: directory,
        dependencies: [dependency],
      }),
      second: reference("复用目录", {
        operations: directory,
        dependencies: [dependency],
      }),
      choices: array("多选目录", choice),
      hidden: text("管理员字段", { value: "管理员可见内容" }),
      locked: text("用户只读字段", { value: "业务原值" }),
    },
    {
      operations: {
        update: {
          async run({ input }) {
            node.limited.value = input.limited === true;
            node.dependency.value = input.dependency ?? "";
            node.first.value = input.first ?? null;
            node.second.value = input.second ?? null;
            node.choices.items = (input.choices ?? []).map((id) => {
              const field = choice();
              field.value = id;
              return field;
            });
            if (options.owner)
              options.userPermissions = node.limited.value
                ? {
                    owner: { ...options.owner },
                    grants: [
                      permission(node, {
                        read: true,
                        write: true,
                        operations: { update: true },
                        fields: {
                          hidden: { read: false },
                          locked: { write: false },
                        },
                      }),
                    ],
                  }
                : { owner: { ...options.owner }, administrator: true };
            return { status: "success" };
          },
        },
      },
    },
  );
  return node;
}
