import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "generate daily summaries",
  "0 6 * * *",
  internal.dailySummary.generateForAll,
  {}
);

export default crons;
