export type ActionState = {
  fieldErrors?: Record<string, string>;
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

export const idleActionState: ActionState = {
  status: "idle",
  message: "",
};
