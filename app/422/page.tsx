import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_FILENAME_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  RESERVED_SUBDOMAINS,
  SUBDOMAIN_MAX_LENGTH,
  SUBDOMAIN_MIN_LENGTH,
} from "@/convex/lib/validation";

export const metadata: Metadata = {
  title: "Couldn't publish that",
  description:
    "What pastehtml accepts: file size, content types, and the naming rules for titles and custom subdomains.",
};

/**
 * The human-readable half of a publish rejection. Every surface that publishes
 * — the home page, the REST API, MCP — answers a refusal with a one-line
 * message and a stable error code; this is the page that says what the rules
 * actually are, so that message does not have to recite them.
 *
 * The limits are imported from the validators that enforce them, not restated,
 * so the page cannot describe a rule the backend no longer applies.
 *
 * ponytail: served 200, because a Next page cannot set its own status — the
 * 422 lives on the API response that sends a reader here. Make it a route
 * handler the day something needs the status and the HTML in one answer.
 */
export default function Unprocessable() {
  return (
    <StatusPage code="422" title="Couldn't publish that">
      <p>
        The upload arrived intact but broke one of the rules below. Nothing was
        stored, so fixing it and publishing again is safe.
      </p>
      <dl className="border-border flex flex-col gap-3 rounded-lg border p-4 text-left text-sm">
        <Rule label="Size">
          At most {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.
        </Rule>
        <Rule label="Type">
          <code className="font-mono">text/html</code> or{" "}
          <code className="font-mono">text/plain</code>, and never empty.
        </Rule>
        <Rule label="Filename">
          Up to {MAX_FILENAME_LENGTH} characters, with no slashes or control
          characters — they would break the download header.
        </Rule>
        <Rule label="Title and description">
          Up to {MAX_TITLE_LENGTH} and {MAX_DESCRIPTION_LENGTH} characters.
        </Rule>
        <Rule label="Custom subdomain">
          {SUBDOMAIN_MIN_LENGTH}–{SUBDOMAIN_MAX_LENGTH} characters, lowercase
          letters, digits and hyphens, not starting or ending with one. Must be
          unclaimed, and never one of {RESERVED_SUBDOMAINS.length} reserved
          names such as <code className="font-mono">www</code> or{" "}
          <code className="font-mono">api</code>.
        </Rule>
      </dl>
    </StatusPage>
  );
}

function Rule({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-foreground font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
