// The shape every status page shares: a code, a headline, a sentence, and the
// ways out. One component so 404, 500 and 422 cannot drift apart.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function StatusPage({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground font-mono text-sm">{code}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="text-muted-foreground flex flex-col gap-3">
        {children}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>
          Publish something
        </Link>
        {actions}
      </div>
    </main>
  );
}
