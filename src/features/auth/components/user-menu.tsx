import {
  SignOutIcon,
} from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requireUser } from "@/server/auth";
import { signOutAction } from "../actions";

export async function UserMenu() {
  const user = await requireUser();
  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
            {user.image ? (
              // biome-ignore lint/performance/noImgElement: tiny remote avatar, next/image config not worth it
              <img src={user.image} alt="" className="size-7 rounded-full" />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          <span className="block font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem render={<button type="submit" className="w-full" />}>
            <SignOutIcon /> Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
