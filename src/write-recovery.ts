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
/** Atomic durable compare-and-set; completed records retain the original terminal evidence. */
export type WritePersistence<A, C = unknown> = {
  load(owner: WriteOwner): Promise<WriteJournal<A, C> | null>;
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
  return {
    async restore() {
      if (!persistence || target.phase === "pending") return;
      const known = target.attempt,
        knownOutcome = target.outcome,
        knownContext = target.context,
        knownRefreshed = target.refreshed;
      target.phase = "blocked";
      const journal = await persistence.load(clone(owner));
      if (target.phase !== "blocked" || target.attempt !== known) return;
      if (!journal) {
        if (known) throw Error("原请求记录缺失，请保留原请求并重试核实。");
        target.phase = "idle";
        return;
      }
      if (target.phase !== "blocked" || target.attempt !== known) return;
      const a = journal.attempt;
      if (
        typeof a?.id !== "string" ||
        !a.id ||
        !["create", "save", "enable", "disable", "delete"].includes(
          a.operation,
        ) ||
        (journal.completed !== undefined && journal.completed !== true) ||
        (journal.refreshed !== undefined && journal.refreshed !== true) ||
        a.scope !== owner.scope ||
        a.resource !== owner.resource ||
        (known && !equalValues(known, a)) ||
        (journal.outcome !== undefined &&
          !["applied", "not-applied"].includes(journal.outcome)) ||
        (knownOutcome && journal.outcome && knownOutcome !== journal.outcome) ||
        (journal.completed && (!journal.refreshed || !journal.outcome)) ||
        (journal.refreshed && !journal.outcome)
      )
        throw Error("原请求记录不匹配，请重试恢复。");
      if (known && knownOutcome && !journal.completed) {
        if (journal.outcome && journal.outcome !== knownOutcome)
          throw Error("原请求终态不匹配，请保留证据。");
        target.context = knownContext;
        target.refreshed = knownRefreshed;
        target.outcome = knownOutcome;
        target.phase = "refresh";
        return;
      }
      target.context = clone(journal.context);
      target.outcome = journal.outcome;
      target.refreshed = journal.refreshed;
      target.attempt = journal.completed ? null : clone(a);
      target.phase = journal.completed
        ? "idle"
        : journal.outcome
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
      if (target.refreshed) return;
      if (persistence && target.attempt)
        await persistence.save(
          {
            attempt: clone(target.attempt),
            outcome,
            refreshed: target.refreshed,
            context: clone(target.context),
          },
          target.attempt.id,
        );
    },
    async complete() {
      if (persistence && target.attempt) {
        if (!target.refreshed) {
          await persistence.save(
            {
              attempt: clone(target.attempt),
              outcome: target.outcome ?? "applied",
              context: clone(target.context),
              refreshed: true,
            },
            target.attempt.id,
          );
          target.refreshed = true;
        }
        await persistence.complete(clone(owner), target.attempt.id);
      }
    },
  };
}
