import { shallowReactive } from "vue";
import { clone } from "./clone";
import {
  sameOperationOwner,
  voucherOperationLabels,
} from "./voucher-operation";
import type {
  VoucherOperationModel as Model,
  VoucherOperationDefinition as Definition,
  VoucherOperationOwner as Owner,
  VoucherOperationIntent as Intent,
  VoucherOperationRequest as Request,
  VoucherOperationJournal as Journal,
  VoucherOperationReceipt as Receipt,
} from "./voucher-operation";
type Phase =
  | "loading"
  | "idle"
  | "preparing"
  | "preview"
  | "pending"
  | "unknown"
  | "seal"
  | "refresh"
  | "blocked";
const sessions = new WeakMap<object, Map<string, unknown>>();
// One consumer persistence port represents one journal namespace. Sharing it shares
// in-browser exclusion; its atomic durable reserve fences independent contexts.
export function operationSession<M extends Model, I, B>(
  definition: Definition<M, I, B>,
  owner: Owner,
) {
  let entries = sessions.get(definition.persistence);
  if (!entries) {
    entries = new Map();
    sessions.set(definition.persistence, entries);
  }
  const key = JSON.stringify([owner.scope, owner.operator, owner.resource]);
  let session = entries.get(key) as
    ReturnType<typeof createSession<M, I, B>> | undefined;
  if (!session) {
    session = createSession(definition, clone(owner));
    entries.set(key, session);
  }
  return session;
}
function createSession<M extends Model, I, B>(
  definition: Definition<M, I, B>,
  owner: Owner,
) {
  const source = definition.adapter,
    store = definition.persistence;
  const adapter = {
    prepare: source.prepare.bind(source),
    acceptsPreparation: source.acceptsPreparation.bind(source),
    execute: source.execute.bind(source),
    reconcile: source.reconcile.bind(source),
    seal: source.seal.bind(source),
    refresh: source.refresh.bind(source),
    accepts: source.accepts.bind(source),
  };
  const persistence = {
    load: store.load.bind(store),
    save: store.save.bind(store),
    remove: store.remove.bind(store),
  };
  const state = shallowReactive<{
    phase: Phase;
    busy: boolean;
    notice: string;
    prepared?: Request<M, I, B>;
    journal?: Journal<M, I, B>;
  }>({ phase: "loading", busy: false, notice: "" });
  let initialized = false;
  function accepted(request: Request<M, I, B>, receipt: Receipt<M>) {
    return (
      sameOperationOwner(request.owner, receipt.owner) &&
      request.action === receipt.action &&
      request.requestId === receipt.requestId &&
      request.binding === receipt.binding &&
      adapter.accepts(clone(request), clone(receipt))
    );
  }
  function check(record: Journal<M, I, B>) {
    const r = record?.request;
    if (
      !r ||
      !r.owner ||
      !sameOperationOwner(r.owner, owner) ||
      typeof r.requestId !== "string" ||
      !r.requestId ||
      typeof r.binding !== "string" ||
      !r.binding ||
      !Object.hasOwn(voucherOperationLabels, r.action) ||
      !r.preview ||
      !Array.isArray(r.preview.sections) ||
      (record.receipt && !accepted(r, record.receipt)) ||
      (record.completed !== undefined && record.completed !== true) ||
      (record.refreshed !== undefined && record.refreshed !== true) ||
      (record.completed && !record.refreshed) ||
      (record.refreshed &&
        (!record.receipt ||
          (record.receipt.status === "not-applied" && !record.receipt.sealed)))
    )
      throw new Error("原请求记录或精确证据不匹配；保持锁定。");
  }
  function phase(record: Journal<M, I, B>): Phase {
    return !record.receipt
      ? "unknown"
      : record.receipt.status === "not-applied" && !record.receipt.sealed
        ? "seal"
        : "refresh";
  }
  async function run(work: () => Promise<void>) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!globalThis.navigator?.locks)
        throw new Error("办理需要安全上下文中的 Web Locks；原请求保持锁定。");
      await navigator.locks.request(
        `@zerp/ui:voucher-operation:${JSON.stringify([owner.scope, owner.operator, owner.resource])}`,
        work,
      );
    } catch (e) {
      if (state.phase === "pending") state.phase = "unknown";
      if (state.phase === "loading") state.phase = "blocked";
      if (state.phase === "preparing") state.phase = "idle";
      state.notice =
        e instanceof Error ? e.message : "办理请求失败，原请求仍保留。";
    } finally {
      state.busy = false;
    }
  }
  async function restore(force = false) {
    if (initialized && !force) return;
    await run(async () => {
      state.phase = "loading";
      try {
        const record = await persistence.load(clone(owner));
        if (record) check(record);
        if (!record && state.journal)
          throw new Error("原请求持久记录缺失，不能以空查询解除已知请求。");
        state.journal = record && !record.completed ? clone(record) : undefined;
        state.prepared = undefined;
        state.phase = record && !record.completed ? phase(record) : "idle";
        initialized = true;
        state.notice =
          record && !record.completed
            ? `已恢复原请求 ${record.request.requestId}，不会重新执行。`
            : "可以准备办理。";
      } catch (e) {
        state.phase = state.journal ? phase(state.journal) : "blocked";
        throw e;
      }
    });
  }
  function cancelPreview() {
    if (!state.busy && state.phase === "preview") {
      state.prepared = undefined;
      state.phase = "idle";
      state.notice = "已取消本地预览，未发送写入。";
    }
  }
  async function prepare(intent: Intent<M, I>, live: () => boolean) {
    if (state.phase !== "idle") return;
    await run(async () => {
      state.phase = "preparing";
      state.notice = "正在准备完整预览。";
      const original = clone(intent),
        value = await adapter.prepare(clone(original));
      if (!live()) {
        state.phase = "idle";
        return;
      }
      if (
        !sameOperationOwner(original.owner, owner) ||
        !sameOperationOwner(value.owner, owner) ||
        value.action !== original.action ||
        !adapter.acceptsPreparation(clone(original), clone(value))
      )
        throw new Error("准备结果不匹配：原目标或输入已改变。");
      state.prepared = clone(value);
      state.phase = "preview";
      state.notice = "尚未写入；确认采用本次原输入与并发事实。";
    });
  }
  async function refresh(record: Journal<M, I, B>, live: () => boolean) {
    if (!live()) return;
    let completed = record;
    if (!record.refreshed) {
      await adapter.refresh(
        clone({
          owner: record.request.owner,
          identity: record.request.identity,
        }),
      );
      completed = { ...record, refreshed: true };
      state.journal = completed;
    }
    await persistence.save(clone(completed), record.request.requestId);
    if (!live()) return;
    await persistence.remove(
      clone(record.request.owner),
      record.request.requestId,
    );
    state.journal = undefined;
    state.prepared = undefined;
    state.phase = "idle";
    state.notice =
      record.receipt?.status === "applied"
        ? "已应用，读取完成；可显式准备新请求。"
        : "原请求已确认未应用并封存；可显式准备新请求。";
  }
  async function receive(
    record: Journal<M, I, B>,
    receipt: Receipt<M>,
    live: () => boolean,
  ) {
    if (!accepted(record.request, receipt))
      throw new Error("证据不匹配，原请求继续锁定。");
    const settled = {
      request: record.request,
      receipt: clone(receipt),
    } as Journal<M, I, B>;
    await persistence.save(clone(settled), record.request.requestId);
    state.journal = settled;
    state.prepared = undefined;
    state.phase = phase(settled);
    state.notice =
      state.phase === "seal"
        ? "已确认未应用，必须封存原请求。"
        : "已确认终态，等待读取。";
    if (state.phase === "refresh" && live()) await refresh(settled, live);
  }
  async function confirm(live: () => boolean, allowed: () => boolean) {
    if (state.phase !== "preview" || !state.prepared || !allowed()) return;
    await run(async () => {
      const record = { request: clone(state.prepared!) } as Journal<M, I, B>;
      state.notice = "正在可靠保存原请求。";
      try {
        await persistence.save(clone(record), null);
      } catch (e) {
        state.prepared = undefined;
        state.phase = "blocked";
        state.notice = "保存未确认，本次未发送写入；先重试恢复原记录。";
        throw e instanceof Error
          ? new Error(`${state.notice} ${e.message}`)
          : new Error(state.notice);
      }
      state.journal = record;
      state.prepared = undefined;
      state.phase = "pending";
      if (!live() || !allowed()) {
        state.phase = "unknown";
        state.notice = "原请求已保存但未发送，须核实并封存后再开始。";
        return;
      }
      const outcome = await adapter.execute(clone(record.request));
      if (outcome.status === "unknown") {
        state.phase = "unknown";
        state.notice = "结果未知；普通读取、关闭或取消不能解锁。";
      } else await receive(record, outcome, live);
    });
  }
  async function resume(live: () => boolean) {
    if (!state.journal || !["unknown", "seal", "refresh"].includes(state.phase))
      return;
    await run(async () => {
      const known = state.journal!.request;
      const latest = await persistence.load(clone(owner), known.requestId);
      if (
        !latest ||
        latest.request.requestId !== known.requestId ||
        latest.request.binding !== known.binding
      )
        throw new Error("原请求记录缺失或已改变，不能以普通空查询解锁。");
      check(latest);
      if (!live()) return;
      if (latest.completed) {
        state.journal = undefined;
        state.prepared = undefined;
        state.phase = "idle";
        state.notice = "原请求已由另一页面完成；可显式准备新请求。";
        return;
      }
      state.journal = clone(latest);
      state.phase = phase(latest);
      const record = clone(latest);
      if (state.phase === "refresh") {
        await refresh(record, live);
        return;
      }
      const outcome =
        state.phase === "seal" && record.receipt
          ? await adapter.seal(clone(record.request), clone(record.receipt))
          : await adapter.reconcile(clone(record.request));
      if (outcome.status === "unknown")
        state.notice = "证据不足，原请求继续锁定。";
      else await receive(record, outcome, live);
    });
  }
  return { state, restore, prepare, confirm, resume, cancelPreview };
}
