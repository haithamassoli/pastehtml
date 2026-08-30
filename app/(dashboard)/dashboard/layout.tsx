import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
      <h1 className="text-xl font-semibold">Dashboard</h1>
      {children}
    </div>
  );
}
