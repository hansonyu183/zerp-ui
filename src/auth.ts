export type AuthMode = "sign-in" | "register" | "recover" | "reset";

export type AuthValues = Readonly<{
  identifier: string;
  password: string;
  confirmation: string;
}>;

export type AuthCapabilities = Readonly<{
  register?: boolean;
  recover?: boolean;
}>;

export type AuthSubmit =
  | Readonly<{ mode: "sign-in"; identifier: string; password: string }>
  | Readonly<{
      mode: "register";
      identifier: string;
      password: string;
    }>
  | Readonly<{ mode: "recover"; identifier: string }>
  | Readonly<{ mode: "reset"; password: string }>;
