import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

// Clerk draws its own card, so the comic frame goes around it: the panel
// supplies the ink border and hard shadow the rest of the site is built from.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="panel overflow-clip">
        <SignIn />
      </div>
    </div>
  );
}
