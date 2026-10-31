export type EditWriteState = "idle" | "pending" | "unknown" | "refresh";
/** A leave request authorizes only the context in which it was requested. */
export type EditGuardHandle = { requestLeave(): Promise<boolean> };

/** Independent local facts and the lifecycle of an already-sent write. */
export type EditProtection = Readonly<{
  dirty: boolean;
  localPending: boolean;
  invalid: boolean;
  writeState: EditWriteState;
}>;
