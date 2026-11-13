const discarded = Symbol("discarded-collaboration");

/** Internal admission fact; never part of the consumer calculation contract. */
export function discardedCollaboration<D extends object>(value: D) {
  return { value, [discarded]: true };
}
export function isDiscardedCollaboration(result: object) {
  return discarded in result;
}
