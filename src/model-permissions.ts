import { toRaw, reactive, ref } from "vue";
import { nodeMetadata } from "./model-node";
import type { ApplicationNode, ModelNode, ModelOwner } from "./reactive-model";

import type { ModelPermission } from "./model-permission";
type Access = { read?: boolean; write?: boolean };
export function createModelPermissions(application: () => ApplicationNode) {
  const recovering = ref(false);
  type Scope = { node: ModelNode; path: readonly string[] };
  const scopes = new WeakMap<object, Scope>();
  const views = new WeakMap<object, ModelNode>();
  const owners = new WeakMap<object, string>();
  const ownerKey = (owner: ModelOwner) =>
    JSON.stringify([owner.ledger, owner.operator, owner.generation]);
  const same = (a: unknown, b: unknown) => toRaw(a) === toRaw(b);
  function scopeOf(node: ModelNode): Scope | undefined {
    const known = scopes.get(toRaw(node));
    if (known) return known;
    function find(parent: ModelNode, inherited?: Scope): Scope | undefined {
      if (same(parent, node)) return inherited ?? { node: parent, path: [] };
      const meta = parent[nodeMetadata];
      if (meta.kind !== "object" && meta.kind !== "application") return;
      for (const [key, child] of Object.entries(parent)) {
        if (!child || typeof child !== "object" || !(nodeMetadata in child))
          continue;
        const item = child as ModelNode;
        const childMeta = item[nodeMetadata];
        const independent = Reflect.get(childMeta, "independent");
        const next =
          independent || !inherited
            ? { node: item, path: [] }
            : { node: inherited.node, path: [...inherited.path, key] };
        const result = find(item, next);
        if (result) return result;
      }
    }
    return find(application());
  }
  function ready() {
    const options = application()[nodeMetadata].options;
    const snapshot = options.userPermissions;
    if (!options.owner || !snapshot) return false;
    const identity = toRaw(snapshot);
    if (!owners.has(identity)) owners.set(identity, ownerKey(snapshot.owner));
    return owners.get(identity) === ownerKey(options.owner);
  }
  function access(
    node: ModelNode,
  ): Access & { operations?: ModelPermission["operations"] } {
    const snapshot = application()[nodeMetadata].options.userPermissions;
    if (!ready() || !snapshot) return { read: false, write: false };
    if (snapshot.administrator) return { read: true, write: true };
    const scope = scopeOf(node);
    if (!scope) return { read: false, write: false };
    const grant = snapshot.grants.find((grant) => same(grant.node, scope.node));
    let current: Access & { fields?: ModelPermission["fields"] } = grant ?? {};
    let read = current.read ?? false,
      write = current.write ?? false;
    for (const key of scope.path) {
      current = current.fields?.[key] ?? {};
      read = read && (current.read ?? true);
      write = write && (current.write ?? true);
    }
    const explicit = snapshot.grants.find((grant) => same(grant.node, node));
    return {
      read: read && (explicit?.read ?? true),
      write:
        read && write && (explicit?.read ?? true) && (explicit?.write ?? true),
      operations: explicit?.operations ?? grant?.operations,
    };
  }
  const readable = (node: ModelNode) => access(node).read === true;
  function allowed(node: ModelNode, action: string) {
    const facts = access(node);
    const read = [
      "query",
      "get",
      "export",
      "audit",
      "openVoucher",
      "load",
    ].includes(action);
    return (
      facts.read === true &&
      (read || facts.write === true) &&
      (action === "load" ||
        application()[nodeMetadata].options.userPermissions?.administrator ===
          true ||
        facts.operations?.[action] === true)
    );
  }
  function bind(
    node: ModelNode,
    root: ModelNode,
    path: readonly string[] = [],
  ) {
    const scope = scopeOf(root);
    scopes.set(toRaw(node), {
      node: scope?.node ?? root,
      path: [...(scope?.path ?? []), ...path],
    });
    return view(node);
  }
  function view<N extends ModelNode>(node: N): N {
    const raw = toRaw(node);
    const observed = reactive(raw);
    const known = views.get(raw);
    if (known) return known as N;
    const operations = new WeakMap<object, Map<string, object>>();
    const metadata = new Map<object, object>();
    const portsCache = new WeakMap<object, object>();
    const protocolMetadata = new WeakMap<object, object>();
    function projectMetadata(value: object): object {
      if (nodeMetadata in value) {
        const child = value as ModelNode;
        return scopeOf(child) ? view(child) : bind(child, node);
      }
      const known = protocolMetadata.get(value);
      if (known) return known;
      const projected = new Proxy(value, {
        get(target, key) {
          const child = Reflect.get(target, key);
          return child && typeof child === "object"
            ? projectMetadata(child)
            : child;
        },
      });
      protocolMetadata.set(value, projected);
      return projected;
    }
    const result = new Proxy(raw, {
      set(_target, key, value) {
        return Reflect.set(observed, key, value);
      },
      get(_target, key) {
        if (key === "__v_raw") return raw;
        const value = Reflect.get(observed, key) as unknown;
        if (key === nodeMetadata && value && typeof value === "object") {
          if (metadata.has(value)) return metadata.get(value);
          const projected = new Proxy(value, {
            get(meta, name) {
              const original = Reflect.get(meta, name);
              if (name === "readOnly") return original || !access(node).write;
              if (name === "options" && original)
                return {
                  ...original,
                  readOnly: original.readOnly || !access(node).write,
                };
              if (name === "element" || name === "create") {
                if (typeof original === "function")
                  return () => {
                    const child = original();
                    const scope = scopeOf(node);
                    return bind(child, scope?.node ?? node, scope?.path ?? []);
                  };
                if (original && typeof original === "object") {
                  const scope = scopeOf(node);
                  return bind(original, scope?.node ?? node, scope?.path ?? []);
                }
              }
              if (name !== "operations" || !original) return original;
              if (portsCache.has(original)) return portsCache.get(original);
              const portsView = new Proxy(original, {
                get(ports, action) {
                  if (action === "__v_raw") return toRaw(original);
                  const protocol = Reflect.get(ports, action);
                  if (
                    typeof action === "symbol" &&
                    protocol &&
                    typeof protocol === "object"
                  )
                    return projectMetadata(protocol);
                  if (
                    typeof action !== "string" ||
                    !protocol ||
                    typeof protocol !== "object"
                  )
                    return protocol;
                  if (!allowed(node, action) && !recovering.value)
                    return undefined;
                  let cached = operations.get(protocol);
                  if (!cached) operations.set(protocol, (cached = new Map()));
                  const cacheKey = action;
                  if (!cached.has(cacheKey)) {
                    const callbacks = new Map<Function, Function>();
                    cached.set(
                      cacheKey,
                      new Proxy(protocol, {
                        get(port, method) {
                          if (method === "__v_raw") return toRaw(protocol);
                          const callback = Reflect.get(port, method);
                          if (
                            callback &&
                            typeof callback === "object" &&
                            nodeMetadata in callback
                          )
                            return bind(callback as ModelNode, node);
                          if (method === "disabledReason")
                            return allowed(node, action)
                              ? callback
                              : "当前用户未获授权。";
                          if (
                            typeof callback !== "function" ||
                            [
                              "reconcile",
                              "seal",
                              "refresh",
                              "accepts",
                            ].includes(String(method))
                          )
                            return callback;
                          if (callbacks.has(callback))
                            return callbacks.get(callback);
                          const guarded = (...args: unknown[]) => {
                            if (!allowed(node, action))
                              throw Error("当前用户未获授权。");
                            return callback(...args);
                          };
                          callbacks.set(callback, guarded);
                          return guarded;
                        },
                      }),
                    );
                  }
                  return cached.get(cacheKey);
                },
              });
              portsCache.set(original, portsView);
              return portsView;
            },
          });
          metadata.set(value, projected);
          return projected;
        }
        if (key === "items" && Array.isArray(value)) {
          const scope = scopeOf(node);
          return value.map((child) =>
            bind(child, scope?.node ?? node, scope?.path ?? []),
          );
        }
        if (value && typeof value === "object" && nodeMetadata in value) {
          const scope = scopeOf(node);
          return Reflect.get((value as ModelNode)[nodeMetadata], "independent")
            ? view(value as ModelNode)
            : bind(value as ModelNode, scope?.node ?? node, [
                ...(scope?.path ?? []),
                String(key),
              ]);
        }
        return value;
      },
    });
    views.set(raw, result);
    return result;
  }
  return { ready, readable, allowed, access, view, bind, recovering };
}
