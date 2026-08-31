import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

// Framed the same way as sign-in — see the note there.
export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="panel overflow-clip">
        <SignUp />
      </div>
    </div>
  );
}
