import type { Column, Fields } from "./contracts";

export type VoucherEditorValue<H extends object, R extends object> = {
  header: H;
  rows: readonly R[];
};

export type VoucherEditorChildColumn<R extends object, C extends object> = {
  key: {
    [K in Extract<keyof R, string>]: R[K] extends readonly C[] ? K : never;
  }[Extract<keyof R, string>];
  label: string;
  type: "children";
  fields: Fields<C>;
  empty: () => C;
  summary: (children: readonly C[]) => string;
  visible?: boolean;
  width?: string;
};

export type VoucherEditorColumn<R extends object, C extends object = object> =
  Column<R> | VoucherEditorChildColumn<R, C>;

export type VoucherEditorDefinition<
  H extends object,
  R extends object,
  C extends object = object,
> = {
  headerFields: Fields<H>;
  rowFields: Fields<R>;
  columns: readonly VoucherEditorColumn<R, C>[];
  rowKey: (row: R) => string;
  emptyRow: () => R;
};

import {validate} from './validation';
/** Internal validation includes committed nested rows as well as unfinished editor state. */
export function validateVoucherContent<H extends object,R extends object,C extends object>(definition:VoucherEditorDefinition<H,R,C>,value:VoucherEditorValue<H,R>):string|undefined {
  const header=validate(definition.headerFields,value.header,'edit');
  if(header)return header;
  for(const row of value.rows){
    const invalid=validate(definition.rowFields,row,'edit');
    if(invalid)return invalid;
    for(const column of definition.columns){
      if(column.type!=='children')continue;
      const children=row[column.key];
      if(!Array.isArray(children))return `${column.label}应为明细列表。`;
      for(const child of children){
        if(!child||typeof child!=='object')return `${column.label}包含无效子项。`;
        const problem=validate(column.fields,child,'edit');
        if(problem)return problem;
      }
    }
  }
  return undefined;
}
