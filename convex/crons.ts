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

export default crons;
