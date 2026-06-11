"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DeleteRecordDialog } from "@/components/forms/delete-record-dialog";
import { EditRecordDialog } from "@/components/forms/edit-record-dialog";

type RecordActionsMenuProps = {
  kind: "resume" | "job";
  recordId: string;
  viewHref: string;
  title: string;
  company?: string;
  deleteSummary: string;
};

// The per-row kebab (⋯) menu for list/grid surfaces (US-058): View → detail
// page, Edit → rename modal, Delete → confirm modal. Both dialogs are rendered
// as siblings of the menu and driven by state, so closing the menu never
// unmounts an open dialog. Opening is deferred to the next tick so the menu's
// focus restoration settles before the modal traps focus.
export function RecordActionsMenu({
  kind,
  recordId,
  viewHref,
  title,
  company,
  deleteSummary,
}: RecordActionsMenuProps) {
  const [dialog, setDialog] = useState<"none" | "edit" | "delete">("none");

  function openDialog(next: "edit" | "delete") {
    window.setTimeout(() => setDialog(next), 0);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLinkItem render={<Link href={viewHref} />}>
            <Eye />
            View
          </DropdownMenuLinkItem>
          <DropdownMenuItem onClick={() => openDialog("edit")}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => openDialog("delete")}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditRecordDialog
        kind={kind}
        recordId={recordId}
        title={title}
        company={company}
        open={dialog === "edit"}
        onOpenChange={(next) => setDialog(next ? "edit" : "none")}
      />
      <DeleteRecordDialog
        kind={kind}
        recordId={recordId}
        summary={deleteSummary}
        open={dialog === "delete"}
        onOpenChange={(next) => setDialog(next ? "delete" : "none")}
      />
    </>
  );
}
