"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, LinkIcon, OrgIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInviteAction, removeMemberAction, renameWorkspaceAction, setRoleAction } from "../actions";
import type { MemberDTO, Role, WorkspaceDTO } from "../server/service";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "owner", label: "Owner", hint: "Everything, including members and settings" },
  { value: "editor", label: "Editor", hint: "Create, edit and delete forms, see responses" },
  { value: "viewer", label: "Viewer", hint: "See forms and responses only" },
];

export function TeamPanel({ workspace, members, me }: { workspace: WorkspaceDTO; members: MemberDTO[]; me: string }) {
  const owner = workspace.role === "owner";
  const [name, setName] = useState(workspace.name);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const report = (err: string | null) => {
    if (err) toast.error(err);
    else toast.success("Updated");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="text-muted-foreground">
          <OrgIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-[22px] font-semibold">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} · you are {workspace.role === "owner" ? "an owner" : `a ${workspace.role}`}
          </p>
        </div>
      </header>

      {owner && (
        <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-medium">Invite people</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Anyone with the link can join for 7 days. Send it over chat or email.</p>
          <div className="flex flex-wrap gap-2">
            <Select items={ROLES.filter((r) => r.value !== "owner")} value={inviteRole} onValueChange={(v) => v && setInviteRole(v as "editor" | "viewer")}>
              <SelectTrigger aria-label="Role for invited people" className="h-10 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r.value !== "owner").map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-10"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const token = await createInviteAction(workspace.id, inviteRole);
                  if (token) setLink(`${window.location.origin}/invite/${token}`);
                })
              }
            >
              <LinkIcon /> Create invite link
            </Button>
          </div>
          {link && (
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 font-mono text-[13px]" aria-label="Invite link" />
              <Button
                variant="outline"
                className="h-10"
                onClick={async () => {
                  await navigator.clipboard.writeText(link).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <CheckIcon className="text-success" /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-5 py-4 font-medium sm:px-6">Members</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {(m.name || m.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name || m.email} {m.userId === me && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {owner ? (
                <Select items={ROLES} value={m.role} onValueChange={(v) => v && start(async () => report(await setRoleAction(workspace.id, m.userId, v)))}>
                  <SelectTrigger aria-label={`Role of ${m.email}`} className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm capitalize text-muted-foreground">{m.role}</span>
              )}
              {(owner || m.userId === me) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => start(async () => {
                    const err = await removeMemberAction(workspace.id, m.userId);
                    if (err) toast.error(err);
                  })}
                >
                  {m.userId === me ? "Leave" : "Remove"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {owner && (
        <section className="space-y-3 rounded-xl border bg-card p-5 sm:p-6">
          <label htmlFor="ws-rename" className="font-medium">
            Workspace name
          </label>
          <div className="flex gap-2">
            <Input id="ws-rename" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
            <Button className="h-10" variant="outline" disabled={!name.trim() || name === workspace.name || pending} onClick={() => start(async () => report((await renameWorkspaceAction(workspace.id, name)) ? null : "Only owners can rename."))}>
              Save
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
