// The shape every status page shares: a code, a headline, a sentence, and the
// ways out. One component so 404, 500 and 422 cannot drift apart.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function StatusPage({
  code,
  title,
  children,
  actions,
  role,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** `"alert"` on the error boundary, so a screen reader is told on arrival. */
  role?: "alert";
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-8">
      <div
        role={role}
        className="panel bg-background relative overflow-clip p-7 text-center"
      >
        <span
          aria-hidden
          className="bg-halftone pointer-events-none absolute -top-6 -left-6 size-32 text-[#e62429]/25"
        />
        <p className="font-display text-hero-red text-6xl tracking-wide sm:text-7xl">
          {code}
        </p>
        <h1 className="mt-2 text-3xl tracking-wide sm:text-4xl">{title}</h1>
        <div className="text-muted-foreground mt-3 flex flex-col gap-3 text-sm">
          {children}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            Publish something
          </Link>
          {actions}
        </div>
      </div>
    </main>
  );
}
