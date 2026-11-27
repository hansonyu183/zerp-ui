// 约定列表渲染需要的投影列和分页结果数据。
export type Page<T> = { items: readonly T[]; total: number };
export type Column<R> = { key: Extract<keyof R, string>; label: string };
