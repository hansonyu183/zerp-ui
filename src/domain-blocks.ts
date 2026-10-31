import { h, type VNodeChild } from "vue";
import DynamicForm from "./DynamicForm.vue";
import FactFields from "./FactFields.vue";
import DomainRows from "./DomainRows.vue";
import VoucherEditor from "./VoucherEditor.vue";
import { formFacts } from "./details";
import { validate } from "./validation";
import type { Fields } from "./contracts";
import { validateVoucherContent } from "./voucher-editor";
import type {
  VoucherEditorDefinition,
  VoucherEditorValue,
} from "./voucher-editor";
export const renderBlock = Symbol("zerp.domain-block");
export type DomainBlockContext<D> = {
  value: D;
  scope: string;
  mode: "read" | "edit";
  formMode: "create" | "edit";
  disabled: boolean;
  update: (value: D) => void;
  pending: (pending: boolean) => void;
};
export type DomainBlock<D extends object> = {
  readonly key: Extract<keyof D, string>;
  readonly label: string;
  readonly validate: (value: D, mode: "create" | "edit") => string | undefined;
  readonly [renderBlock]: (context: DomainBlockContext<D>) => VNodeChild;
};
type ContentOnly = {
  component?: never;
  render?: never;
  template?: never;
  slots?: never;
  layout?: never;
  style?: never;
  class?: never;
  css?: never;
};
type ObjectKey<D> = {
  [K in Extract<keyof D, string>]: D[K] extends object ? K : never;
}[Extract<keyof D, string>];
function setKey<D, K extends keyof D>(value: D, key: K, local: D[K]): D {
  return { ...value, [key]: local };
}
/** Finite library blocks. No component, template, layout, or lifecycle callback is accepted. */
export function domainBlocks<D extends object>() {
  return {
    fields<K extends ObjectKey<D>>(
      options: ContentOnly & {
        key: K;
        label: string;
        fields: Fields<D[K] & object>;
      },
    ): DomainBlock<D> {
      return Object.freeze({
        key: options.key,
        label: options.label,
        validate: (data: D, mode: "create" | "edit") => {
          const local = data[options.key];
          return local && typeof local === "object"
            ? validate(options.fields, local, mode)
            : `请填写${options.label}。`;
        },
        [renderBlock]: (context: DomainBlockContext<D>) => {
          const value = context.value[options.key];
          if (!value || typeof value !== "object") return null;
          return h(
            "fieldset",
            { "aria-label": options.label, disabled: context.disabled },
            [
              h("legend", options.label),
              context.mode === "read"
                ? h(FactFields, { value, fields: formFacts(options.fields) })
                : h(DynamicForm<D[K] & object>, {
                    fields: options.fields,
                    modelValue: value,
                    scope: context.scope,
                    mode: context.formMode,
                    disabled: context.disabled,
                    "onUpdate:modelValue": (local: D[K] & object) =>
                      context.update(setKey(context.value, options.key, local)),
                    onPending: context.pending,
                  }),
            ],
          );
        },
      });
    },
    rows<K extends Extract<keyof D, string>, R extends object>(
      options: ContentOnly & {
        key: K;
        label: string;
        fields: Fields<R>;
        empty: () => R;
        get: (value: D[K]) => readonly R[];
        set: (value: D[K], rows: readonly R[]) => D[K];
      },
    ): DomainBlock<D> {
      return Object.freeze({
        key: options.key,
        label: options.label,
        validate: (data: D, mode: "create" | "edit") =>
          options
            .get(data[options.key])
            .map((row) => validate(options.fields, row, mode))
            .find(Boolean),
        [renderBlock]: (context: DomainBlockContext<D>) => {
          return h(DomainRows<R>, {
            label: options.label,
            fields: options.fields,
            empty: options.empty,
            modelValue: options.get(context.value[options.key]),
            scope: context.scope,
            mode: context.mode,
            formMode: context.formMode,
            disabled: context.disabled,
            "onUpdate:modelValue": (rows: readonly R[]) =>
              context.update(
                setKey(
                  context.value,
                  options.key,
                  options.set(context.value[options.key], rows),
                ),
              ),
            onPending: context.pending,
          });
        },
      });
    },
    voucher<
      K extends Extract<keyof D, string>,
      H extends object,
      R extends object,
      C extends object = object,
    >(
      options: ContentOnly & {
        key: K;
        label: string;
        editor: VoucherEditorDefinition<H, R, C>;
        get: (value: D[K]) => VoucherEditorValue<H, R>;
        set: (value: D[K], content: VoucherEditorValue<H, R>) => D[K];
      },
    ): DomainBlock<D> {
      return Object.freeze({
        key: options.key,
        label: options.label,
        validate: (data: D, mode: "create" | "edit") => {
          const content = options.get(data[options.key]);
          return validateVoucherContent(options.editor, content, mode);
        },
        [renderBlock]: (context: DomainBlockContext<D>) =>
          h("section", { "aria-label": options.label }, [
            h("h3", options.label),
            h(VoucherEditor<H, R, C>, {
              ...options.editor,
              modelValue: options.get(context.value[options.key]),
              scope: context.scope,
              mode: context.mode,
              formMode: context.formMode,
              disabled: context.disabled,
              "onUpdate:modelValue": (value: VoucherEditorValue<H, R>) =>
                context.update(
                  setKey(
                    context.value,
                    options.key,
                    options.set(context.value[options.key], value),
                  ),
                ),
              onPending: context.pending,
            }),
          ]),
      });
    },
  };
}

export function validateDomainBlocks<D extends object>(
  blocks: readonly DomainBlock<D>[] | undefined,
  value: D,
  mode: "create" | "edit",
): string | undefined {
  return blocks?.map((block) => block.validate(value, mode)).find(Boolean);
}
