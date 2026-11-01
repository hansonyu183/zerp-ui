import { clone } from "./clone";
import { equalValues } from "./editor-values";
export type WriteOwner = Readonly<{ scope: string; resource: string }>;
export type WriteJournal<A, C = unknown> = {
  attempt: A;
  outcome?: "applied" | "not-applied";
  context?: C;
  refreshed?: true;
  completed?: true;
};
/** Atomic durable CAS. Exact-ID reads and idempotent completion retain terminal evidence after slot replacement. */
export type WritePersistence<A, C = unknown> = {
  load(
    owner: WriteOwner,
    requestId?: string,
  ): Promise<WriteJournal<A, C> | null>;
  save(journal: WriteJournal<A, C>, expectedId: string | null): Promise<void>;
  complete(owner: WriteOwner, expectedId: string): Promise<void>;
};
type Original = {
  id: string;
  scope: string;
  resource: string;
  operation: string;
};
type Lock<A, C> = {
  phase: "idle" | "pending" | "unknown" | "refresh" | "blocked";
  attempt: A | null;
  context?: C;
  outcome?: "applied" | "not-applied";
  refreshed?: true;
};
export function writeRecovery<A extends Original, C>(
  target: Lock<A, C>,
  persistence: WritePersistence<A, C> | undefined,
  owner: WriteOwner,
) {
  async function read(original: A | null) {
    const journal = await persistence!.load(clone(owner), original?.id);
    if (!journal) {
      if (original) throw Error("原请求记录缺失，请保留原请求并重试核实。");
      return null;
    }
    const a = journal.attempt;
    if (
      typeof a?.id !== "string" ||
      !a.id ||
      !["create", "save", "enable", "disable", "delete"].includes(
        a.operation,
      ) ||
      a.scope !== owner.scope ||
      a.resource !== owner.resource ||
      (original && !equalValues(a, original)) ||
      (journal.outcome !== undefined &&
        !["applied", "not-applied"].includes(journal.outcome)) ||
      (journal.completed !== undefined && journal.completed !== true) ||
      (journal.refreshed !== undefined && journal.refreshed !== true) ||
      (journal.refreshed && !journal.outcome) ||
      (journal.completed && !journal.refreshed) ||
      (target.outcome &&
        original &&
        journal.outcome &&
        target.outcome !== journal.outcome)
    )
      throw Error("原请求记录或终态不匹配，请保留证据。");
    return journal;
  }
  function merge(journal: WriteJournal<A, C>) {
    target.refreshed = target.refreshed || journal.refreshed;
  }
  return {
    async restore() {
      if (!persistence || target.phase === "pending") return;
      const known = target.attempt,
        knownOutcome = target.outcome,
        knownContext = target.context;
      target.phase = "blocked";
      const journal = await read(known);
      if (target.phase !== "blocked" || target.attempt !== known) return;
      if (!journal) {
        target.phase = "idle";
        return;
      }
      if (known) merge(journal);
      else target.refreshed = journal.refreshed;
      target.context =
        known && knownOutcome ? knownContext : clone(journal.context);
      target.outcome = known && knownOutcome ? knownOutcome : journal.outcome;
      target.attempt = journal.completed ? null : clone(journal.attempt);
      target.phase = journal.completed
        ? "idle"
        : target.outcome
          ? "refresh"
          : "unknown";
    },
    async reserve() {
      if (persistence && target.attempt)
        await persistence.save(
          { attempt: clone(target.attempt), context: clone(target.context) },
          null,
        );
    },
    async settle(outcome: "applied" | "not-applied") {
      if (target.outcome && target.outcome !== outcome)
        throw Error("不能回退原请求终态。");
      target.outcome = outcome;
      if (!persistence || !target.attempt) return;
      const original = target.attempt,
        journal = await read(original);
      if (!journal) throw Error("原请求记录缺失。");
      merge(journal);
      if (journal.completed || target.refreshed) return;
      await persistence.save(
        { attempt: clone(original), outcome, context: clone(target.context) },
        original.id,
      );
    },
    async complete() {
      if (!persistence || !target.attempt) return;
      const original = target.attempt,
        journal = await read(original);
      if (!journal || !target.outcome) throw Error("原请求终态尚未确认。");
      merge(journal);
      if (journal.completed) return;
      if (!target.refreshed) {
        await persistence.save(
          {
            attempt: clone(original),
            outcome: target.outcome,
            context: clone(target.context),
            refreshed: true,
          },
          original.id,
        );
        target.refreshed = true;
      }
      await persistence.complete(clone(owner), original.id);
    },
  };
}
