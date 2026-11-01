import { CheckIcon, OrgIcon, PlusIcon, SettingsIcon, SwitchIcon, UserIcon } from "@/components/shared/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireUser } from "@/server/auth";
import { switchWorkspaceAction } from "../actions";
import { currentWorkspace, listWorkspaces } from "../server/service";
import { NewWorkspaceItem, NewWorkspaceProvider } from "./new-workspace";

export async function WorkspaceSwitcher() {
  const user = await requireUser();
  const [all, cur] = await Promise.all([listWorkspaces(user.id), currentWorkspace(user.id)]);
  const Icon = cur.personal ? UserIcon : OrgIcon;
  return (
    <NewWorkspaceProvider>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch workspace"
        className="flex h-9 min-w-0 max-w-52 items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{cur.name}</span>
        <SwitchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {all.map((w) => (
            <form key={w.id} action={switchWorkspaceAction.bind(null, w.id)}>
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                {w.personal ? <UserIcon /> : <OrgIcon />}
                <span className="flex-1 truncate text-left">{w.name}</span>
                {!w.personal && <span className="text-xs capitalize text-muted-foreground">{w.role}</span>}
                {w.id === cur.id && <CheckIcon className="text-foreground" />}
              </DropdownMenuItem>
            </form>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <NewWorkspaceItem icon={<PlusIcon />} />
        {!cur.personal && (
          <DropdownMenuItem render={<a href="/team" />}>
            <SettingsIcon /> Members and settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </NewWorkspaceProvider>
  );
}
