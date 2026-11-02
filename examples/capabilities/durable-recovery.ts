import {
  defineTaskPage,
  type OperationJournal,
  type OperationSettlement,
  type OperationOwner,
  type Attempt,
} from "@zerp/ui";
import { operation, recovery, type Model } from "./adapters";
/** Synthetic consumer fixture. This is not a library test export or a production store. */
export function durableRecoveryFixture(run: string, knownOutcome = false) {
  const owner: OperationOwner = {
    scope: "synthetic-session",
    operator: "synthetic-operator",
    resource: `durable-${run}`,
  };
  const definition = operation(owner);
  let failTerminal = false;
  const save = definition.persistence.save;
  definition.persistence.save = async (journal, expected) => {
    if (journal.receipt && failTerminal) {
      failTerminal = false;
      throw Error("合成终态保存失败");
    }
    await save(journal, expected);
  };
  const logKey = `durable-log:${run}`;
  const events = () =>
    JSON.parse(localStorage.getItem(logKey) ?? "[]") as {
      kind: string;
      id: string;
    }[];
  const log = (kind: string, id: string) =>
    localStorage.setItem(logKey, JSON.stringify([...events(), { kind, id }]));
  const execute = definition.adapter.execute,
    reconcile = definition.adapter.reconcile,
    refresh = definition.adapter.refresh;
  definition.adapter.execute = async (request) => {
    log("execute", request.requestId);
    return execute(request);
  };
  definition.adapter.reconcile = async (request) => {
    log("reconcile", request.requestId);
    return reconcile(request);
  };
  definition.adapter.refresh = async (settlement) => {
    log("refresh", settlement.request.requestId);
    return refresh(settlement);
  };
  // Separate probe namespace competes at the public Persistence port, independently
  // of the operation runtime's own Web Lock. The winner alone invokes its Adapter.
  const probeOwner = { ...owner, resource: `${owner.resource}:cas-probe` };
  const probe = operation(probeOwner);
  const probeLog = `${logKey}:probe`;
  async function reserveProbe() {
    const request = await probe.adapter.prepare({
      owner: probeOwner,
      action: "process",
      identity: "probe",
      input: { value: "unknown" },
    });
    try {
      await probe.persistence.save(
        { request } as OperationJournal<Model, string, number>,
        null,
      );
    } catch {
      return { won: false, id: request.requestId };
    }
    localStorage.setItem(
      probeLog,
      JSON.stringify([
        ...(JSON.parse(localStorage.getItem(probeLog) ?? "[]") as string[]),
        request.requestId,
      ]),
    );
    await probe.adapter.execute(request);
    return { won: true, id: request.requestId };
  }
  async function history() {
    const original = (await probe.persistence.load(probeOwner))!;
    const receipt = await probe.adapter.reconcile(original.request);
    if (receipt.status === "unknown") throw Error("合成权威证据缺失。");
    const terminal = { ...original, receipt } as OperationJournal<
      Model,
      string,
      number
    >;
    await probe.persistence.save(terminal, original.request.requestId);
    await probe.adapter.refresh({
      request: original.request,
      receipt,
    } as OperationSettlement<Model, string, number>);
    await probe.persistence.save(
      { ...terminal, refreshed: true },
      original.request.requestId,
    );
    await probe.persistence.remove(probeOwner, original.request.requestId);
    const next = await probe.adapter.prepare({
      owner: probeOwner,
      action: "process",
      identity: "next",
      input: { value: "never-sent" },
    });
    await probe.persistence.save(
      { request: next } as OperationJournal<Model, string, number>,
      null,
    );
    await probe.persistence.remove(probeOwner, original.request.requestId);
    await probe.persistence.remove(probeOwner, original.request.requestId);
    const retained = (await probe.persistence.load(
      probeOwner,
      original.request.requestId,
    ))!;
    let refused = 0;
    for (const bad of [
      { ...retained, completed: undefined },
      {
        ...retained,
        receipt: undefined,
        refreshed: undefined,
        completed: undefined,
      },
      {
        ...retained,
        request: { ...retained.request, input: { value: "changed" } },
      },
      {
        ...retained,
        association: {
          kind: "batch" as const,
          batchId: "invented",
          entryKey: "invented",
        },
      },
    ]) {
      try {
        await probe.persistence.save(
          bad as OperationJournal<Model, string, number>,
          original.request.requestId,
        );
      } catch {
        refused++;
      }
    }
    const differentOwner = operation({
      ...probeOwner,
      scope: "another-session",
    });
    return {
      originalId: original.request.requestId,
      retained,
      head: await probe.persistence.load(probeOwner),
      nextId: next.requestId,
      refused,
      isolated: await differentOwner.persistence.load({
        ...probeOwner,
        scope: "another-session",
      }),
      sends: JSON.parse(localStorage.getItem(probeLog) ?? "[]") as string[],
    };
  }
  async function writeHistory() {
    const port = recovery();
    const a: Attempt<{ name: string }, string> = {
      id: crypto.randomUUID(),
      scope: owner.scope,
      resource: `${owner.resource}:write`,
      operation: "save",
      identity: "one",
      input: { name: "original" },
    };
    await port.save({ attempt: a }, null);
    await port.save({ attempt: a, outcome: "applied" }, a.id);
    await port.save({ attempt: a, outcome: "applied", refreshed: true }, a.id);
    await port.complete(a, a.id);
    const next = { ...a, id: crypto.randomUUID(), input: { name: "next" } };
    await port.save({ attempt: next }, null);
    await port.complete(a, a.id);
    const original = (await port.load(a, a.id))!;
    let refused = 0;
    for (const bad of [
      { ...original, outcome: "not-applied" as const },
      { ...original, completed: undefined },
      { ...original, attempt: { ...a, input: { name: "changed" } } },
    ]) {
      try {
        await port.save(bad, a.id);
      } catch {
        refused++;
      }
    }
    return {
      original,
      head: await port.load(a),
      nextId: next.id,
      refused,
      isolated: await port.load({ ...a, scope: "another-session" }),
    };
  }
  const controls = {
    snapshot: async () => ({
      journal: await definition.persistence.load(owner),
      events: events(),
    }),
    failNextTerminalSave: () => {
      failTerminal = true;
    },
    reserveProbe,
    history,
    writeHistory,
  };
  Object.assign(window, { syntheticDurableRecovery: controls });
  return defineTaskPage<{ value: string }, Model, string, number>({
    title: "耐久恢复验证",
    instance: owner.resource,
    owner,
    identity: "original-target",
    definition,
    values: { value: knownOutcome ? "applied" : "unknown" },
    fields: [],
    actions: ["process"],
    toIntent: (input, action, base) => ({ ...base, action, input }),
    eligible: true,
    recoveryAllowed: true,
  });
}
