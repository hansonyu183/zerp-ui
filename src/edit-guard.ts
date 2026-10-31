export type EditWriteState =
  "idle" | "pending" | "unknown" | "refresh" | "seal" | "blocked";
/** A leave request authorizes only the context in which it was requested. */
export type EditGuardHandle = { requestLeave(): Promise<boolean> };

/**
 * Independent local facts and write/recovery ownership.
 * blocked: durable reservation/recovery has not been established; not a business outcome.
 * seal: authoritative not-applied outcome still needs fencing before a new request.
 * refresh: known applied or sealed outcome awaits authoritative read/completion.
 */
export type EditProtection = Readonly<{
  dirty: boolean;
  localPending: boolean;
  invalid: boolean;
  writeState: EditWriteState;
}>;
