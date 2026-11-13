import {
  object,
  secret,
  operation,
  type ModelApplicationOptions,
  type ModelActionModel,
  type ModelOperationJournal,
  type ModelOperationPersistence,
} from "@zerp/ui/model";

// Synthetic business callbacks. A consumer owns encryption, identity and its API.
export function passwordNode(options: ModelApplicationOptions) {
  const input = object("密码", {
    current: secret("当前密码", { required: true }),
    next: secret("新密码", { required: true }),
    confirmation: secret("确认密码", { required: true }),
  });
  type M = ModelActionModel<"changePassword", typeof input, { digest: string }>;
  type Journal = ModelOperationJournal<M, {}, string>;
  type Request = Journal["request"];
  let keyPromise: Promise<CryptoKey> | undefined;
  function encryptionKey() {
    return (keyPromise ??= navigator.locks.request(
      "zerp-model-password-key",
      async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("zerp-model-password", 1);
          request.onupgradeneeded = () =>
            request.result.createObjectStore("keys");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const stored = await new Promise<CryptoKey | undefined>(
            (resolve, reject) => {
              const request = db
                .transaction("keys")
                .objectStore("keys")
                .get("aes");
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            },
          );
          if (stored) return stored;
          const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"],
          );
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction("keys", "readwrite");
            transaction.objectStore("keys").put(key, "aes");
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
          });
          return key;
        } finally {
          db.close();
        }
      },
    ));
  }
  const slot = (owner: Request["owner"]) =>
    "zerp-model-password:" + JSON.stringify(owner);
  async function read(
    owner: Request["owner"],
    requestId?: string,
  ): Promise<Journal | null> {
    const name = requestId ? slot(owner) + ":" + requestId : slot(owner);
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    const { iv, ciphertext } = JSON.parse(raw) as {
      iv: number[];
      ciphertext: number[];
    };
    const clear = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(iv),
        additionalData: new TextEncoder().encode(name),
      },
      await encryptionKey(),
      new Uint8Array(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(clear)) as Journal;
  }
  async function write(name: string, value: Journal) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(name) },
      await encryptionKey(),
      new TextEncoder().encode(JSON.stringify(value)),
    );
    localStorage.setItem(
      name,
      JSON.stringify({
        iv: [...iv],
        ciphertext: [...new Uint8Array(ciphertext)],
      }),
    );
  }
  const persistence: ModelOperationPersistence<M, {}, string> & {
    secrets: "encrypted";
  } = {
    secrets: "encrypted",
    load: read,
    async save(journal, expected) {
      await navigator.locks.request(slot(journal.request.owner), async () => {
        const old = await read(journal.request.owner);
        if (
          (old && !old.completed ? old.request.requestId : null) !== expected ||
          (expected !== null &&
            JSON.stringify(old?.request) !== JSON.stringify(journal.request))
        )
          throw Error("原请求已变化。");
        await write(
          slot(journal.request.owner) + ":" + journal.request.requestId,
          journal,
        );
        await write(slot(journal.request.owner), journal);
      });
    },
    async remove(owner, expected) {
      await navigator.locks.request(slot(owner), async () => {
        const old = await read(owner);
        if (old?.request.requestId !== expected || !old.refreshed)
          throw Error("原请求尚未完成。");
        const done = { ...old, completed: true as const };
        await write(slot(owner) + ":" + expected, done);
        await write(slot(owner), done);
      });
    },
  };
  const receipt = (request: Request) => ({
    status: "applied" as const,
    action: request.action,
    owner: request.owner,
    requestId: request.requestId,
    binding: request.binding,
    evidence: { digest: request.binding },
  });
  const action = operation<
    "changePassword",
    typeof input,
    {},
    string,
    { digest: string }
  >("changePassword", input, {
    persistence,
    async prepare(intent) {
      if (!intent.input.next || intent.input.next !== intent.input.confirmation)
        throw Error("请确认新密码。");
      const requestId = crypto.randomUUID();
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([intent, requestId])),
      );
      return {
        ...intent,
        requestId,
        concurrency: "synthetic-password-1",
        binding: [...new Uint8Array(hash)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        preview: { title: "确认更改密码", sections: [] },
      };
    },
    acceptsPreparation: (intent, request) =>
      JSON.stringify(intent.input) === JSON.stringify(request.input) &&
      request.binding.length === 64,
    async run(request) {
      localStorage.setItem(
        "zerp-model-password-result:" + request.requestId,
        JSON.stringify(receipt(request)),
      );
      return { status: "unknown" };
    },
    async reconcile(request) {
      return JSON.parse(
        localStorage.getItem(
          "zerp-model-password-result:" + request.requestId,
        ) ?? '{"status":"unknown"}',
      ) as ReturnType<typeof receipt> | { status: "unknown" };
    },
    seal: async (_request, outcome) => outcome,
    async refresh() {
      options.forcePasswordChange = false;
    },
    accepts: (request, outcome) => request.binding === outcome.evidence.digest,
  });
  return object("更改密码", {}, { operations: { changePassword: action } });
}
