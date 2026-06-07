export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

export const idleActionState: ActionState = {
  status: "idle",
  message: "",
};
