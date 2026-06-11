export type ActionState = {
  fieldErrors?: Record<string, string>;
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
  // US-052: a learning-target save that would re-status a live pipeline row asks
  // the user to confirm first (no silent demotion). The client re-submits with a
  // `confirm` flag set when this is true.
  requiresConfirm?: boolean;
};

export const idleActionState: ActionState = {
  status: "idle",
  message: "",
};
