import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reclaims storage from abandoned browser uploads. Hourly is plenty: orphans
// cost storage, never correctness.
crons.interval(
  "sweep orphaned uploads",
  { hours: 1 },
  internal.storage.sweepOrphans,
  {},
);

// Rate-limit windows are only useful until they reset.
crons.interval("sweep rate limits", { hours: 1 }, internal.rateLimit.sweep, {});

// Password-attempt windows, same story as the rate-limit ones — and the reason
// they need a sweep at all is that the per-paste cap keys on a caller-supplied
// client, so a guesser can mint a fresh row per attempt.
crons.interval(
  "sweep unlock attempts",
  { hours: 1 },
  internal.pastes.sweepUnlockAttempts,
  {},
);

// Analytics retention. Daily is fine: the window is 90 days, so a day of drift
// either way is not a policy anyone can notice.
crons.interval(
  "sweep expired paste views",
  { hours: 24 },
  internal.analytics.sweep,
  {},
);

export default crons;
