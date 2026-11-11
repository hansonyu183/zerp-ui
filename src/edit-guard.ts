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

/** Aggregate departure facts; this never grants or removes another runtime's write permission. */
export function combineProtection(
  states: readonly EditProtection[],
): EditProtection {
  const order: readonly EditWriteState[] = [
    "pending",
    "unknown",
    "blocked",
    "seal",
    "refresh",
    "idle",
  ];
  return {
    dirty: states.some((state) => state.dirty),
    localPending: states.some((state) => state.localPending),
    invalid: states.some((state) => state.invalid),
    writeState:
      order.find((phase) =>
        states.some((state) => state.writeState === phase),
      ) ?? "idle",
  };
}
