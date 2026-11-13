import type { OperationModel, OperationPersistence } from "./operation";
type Port = OperationPersistence<OperationModel, unknown, unknown>;
// Keep one engine namespace per consumer port, including across component remounts.
const ports = new WeakMap<object, Port>();
export function modelOperationPersistence(source: Port): Port {
  let port = ports.get(source);
  if (!port) {
    const protect = async <T>(work: () => Promise<T>): Promise<T> => {
      try {
        return await work();
      } catch {
        throw Error("原请求存储不可用，请重试恢复；原请求保持锁定。");
      }
    };
    port = {
      load: (owner, id) => protect(() => source.load(owner, id)),
      save: (journal, expected) =>
        protect(() => source.save(journal, expected)),
      remove: (owner, expected) =>
        protect(() => source.remove(owner, expected)),
    };
    ports.set(source, port);
  }
  return port;
}
