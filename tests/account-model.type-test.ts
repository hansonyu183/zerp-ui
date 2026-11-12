import { defineBusinessAccountPage } from "../src/index";
const model = {
  kind: "object",
  name: "密码",
  properties: { password: { kind: "text", name: "新密码", secret: true } },
  form: { fields: ["password"] },
} as const;
defineBusinessAccountPage(model, {
  kind: "change-password",
  values: { password: "x" },
  submit(value) {
    const password: string | null | undefined = value.password;
    void password;
  },
});
defineBusinessAccountPage(model, {
  kind: "change-password",
  // @ts-expect-error password values follow their literal model
  values: { password: 123 },
  submit() {},
});
defineBusinessAccountPage(model, {
  kind: "change-password",
  // @ts-expect-error unrelated inputs are not admitted by the model
  values: { unrelated: true },
  submit() {},
});
