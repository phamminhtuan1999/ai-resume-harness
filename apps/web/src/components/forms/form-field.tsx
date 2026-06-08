import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  helpText?: string;
  label: string;
  required?: boolean;
};

export function FormField({
  children,
  className,
  error,
  helpText,
  label,
  required = false,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium", className)}>
      <span className="flex items-center gap-1.5">
        {label}
        {required ? <span className="text-destructive" aria-label="required">*</span> : null}
      </span>
      {children}
      <FormFieldHint text={helpText} />
      <FormFieldError error={error} />
    </label>
  );
}

export function FormFieldHint({ text }: { text?: string }) {
  if (!text) {
    return null;
  }

  return <span className="text-xs leading-5 text-muted-foreground">{text}</span>;
}

export function FormFieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return (
    <span className="text-xs font-medium leading-5 text-destructive" role="alert">
      {error}
    </span>
  );
}
