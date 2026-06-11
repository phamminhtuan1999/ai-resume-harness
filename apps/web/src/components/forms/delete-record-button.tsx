"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteRecordDialog } from "@/components/forms/delete-record-dialog";

type DeleteRecordButtonProps = {
  kind: "resume" | "job";
  recordId: string;
  summary: string;
};

// Detail-page delete entry point (US-055 → US-058). Renders the header button
// and opens the shared confirm modal, which states the blast radius before the
// destructive action and redirects to the list (with a flash) on success.
export function DeleteRecordButton({ kind, recordId, summary }: DeleteRecordButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" />
        Delete {kind}
      </Button>
      <DeleteRecordDialog
        kind={kind}
        recordId={recordId}
        summary={summary}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
