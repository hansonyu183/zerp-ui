export type EditWriteState = "idle" | "pending" | "unknown";
/** A leave request authorizes only the context in which it was requested. */
export type EditGuardHandle = { requestLeave(): Promise<boolean> };
