"use client";

import { createContext, use, useState, useTransition } from "react";
import { SpinnerIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createWorkspaceAction } from "../actions";

const Ctx = createContext<(open: boolean) => void>(() => {});

/** Menu item that opens the dialog. The dialog lives in the provider so closing the menu doesn't unmount it. */
export function NewWorkspaceItem({ icon }: { icon: React.ReactNode }) {
  const setOpen = use(Ctx);
  return (
    <DropdownMenuItem onClick={() => setOpen(true)}>
      {icon} New team workspace
    </DropdownMenuItem>
  );
}

export function NewWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Ctx value={setOpen}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New team workspace</DialogTitle>
            <DialogDescription>Forms in a team workspace are shared with everyone you invite. Your personal workspace stays private.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createWorkspaceAction(name);
                if (res?.error) setError(res.error);
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="ws-name" className="text-sm font-medium">
                Name
              </label>
              <Input id="ws-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance team, Hiring, Design studio" className="h-10" />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending && <SpinnerIcon className="animate-spin" />} Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Ctx>
  );
}
