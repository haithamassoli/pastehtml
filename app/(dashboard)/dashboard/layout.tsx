import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

// Dashboard shell — signed-in area. Auth is enforced here so every nested
// route inherits the guard.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {/* The account menu itself is Clerk's `UserButton` in the root header,
            which is present on every page including this one. */}
        <Link href="/" className={buttonVariants({ size: "sm" })}>
          New paste
        </Link>
      </div>
      {/* One section until Milestone 8 adds folders. Scrolls rather than wraps
          on a narrow screen, which is the whole of the mobile navigation. */}
      <nav className="border-border flex gap-4 overflow-x-auto border-b pb-2 text-sm">
        <Link href="/dashboard" className="font-medium whitespace-nowrap">
          Pastes
        </Link>
      </nav>
      {children}
    </div>
  );
}
