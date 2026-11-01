import {
  OfflineIcon,
} from "@/components/shared/icons";
import { Logo } from "@/components/shared/brand";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <Logo />
        <OfflineIcon className="mx-auto mt-10 size-10 text-muted-foreground" />
        <h1 className="mt-4 text-[28px] font-semibold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Forms you opened before still work offline, and answers you submit are sent automatically when you reconnect.
        </p>
      </div>
    </main>
  );
}
