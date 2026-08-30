"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";

/**
 * Ownership is decided by Convex from the caller's own identity, so this
 * renders nothing for a visitor, for a signed-in stranger, and during the
 * initial load. The server render is unauthenticated and always sees `false`,
 * which is why the check happens here.
 *
 * ponytail: a link is the whole control surface — editing, replacing and
 * deleting live on the dashboard detail page (Milestone 7).
 */
export function OwnerControls({ token }: { token: string }) {
  const paste = useQuery(api.pastes.getByToken, { token });
  if (!paste?.isViewerOwner) return null;

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-medium">You own this paste</p>
      <Link
        href={`/dashboard/pastes/${token}`}
        className={buttonVariants({ size: "sm", className: "self-start" })}
      >
        Manage
      </Link>
    </div>
  );
}
