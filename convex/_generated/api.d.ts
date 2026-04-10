/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as availability from "../availability.js";
import type * as canvasIcs from "../canvasIcs.js";
import type * as checklist from "../checklist.js";
import type * as crons from "../crons.js";
import type * as dailySummary from "../dailySummary.js";
import type * as dashboard from "../dashboard.js";
import type * as feasibility from "../feasibility.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as googleCalendarPush from "../googleCalendarPush.js";
import type * as googleCalendarSync from "../googleCalendarSync.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_availability_cap from "../lib/availability_cap.js";
import type * as lib_calendar_dates from "../lib/calendar_dates.js";
import type * as lib_canvas_ics from "../lib/canvas/ics.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_drift_index from "../lib/drift/index.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_feasibility_availability from "../lib/feasibility/availability.js";
import type * as lib_feasibility_index from "../lib/feasibility/index.js";
import type * as lib_feasibility_overload from "../lib/feasibility/overload.js";
import type * as lib_googleAiGendaCalendar from "../lib/googleAiGendaCalendar.js";
import type * as lib_googleCalendarScopes from "../lib/googleCalendarScopes.js";
import type * as lib_importedTaskUpsert from "../lib/importedTaskUpsert.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_parentTaskProgress from "../lib/parentTaskProgress.js";
import type * as lib_parent_task_progress from "../lib/parent_task_progress.js";
import type * as lib_plan_generate from "../lib/plan/generate.js";
import type * as lib_plan_index from "../lib/plan/index.js";
import type * as lib_plan_period from "../lib/plan/period.js";
import type * as lib_plan_scheduler from "../lib/plan/scheduler.js";
import type * as lib_plan_validate from "../lib/plan/validate.js";
import type * as lib_plan_sequence from "../lib/plan_sequence.js";
import type * as lib_priority_index from "../lib/priority/index.js";
import type * as lib_summary from "../lib/summary.js";
import type * as lib_taskDedupe from "../lib/taskDedupe.js";
import type * as lib_tokenCrypto from "../lib/tokenCrypto.js";
import type * as lib_types from "../lib/types.js";
import type * as overdueAcknowledgments from "../overdueAcknowledgments.js";
import type * as ping from "../ping.js";
import type * as plans from "../plans.js";
import type * as plansInternal from "../plansInternal.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  availability: typeof availability;
  canvasIcs: typeof canvasIcs;
  checklist: typeof checklist;
  crons: typeof crons;
  dailySummary: typeof dailySummary;
  dashboard: typeof dashboard;
  feasibility: typeof feasibility;
  googleCalendar: typeof googleCalendar;
  googleCalendarPush: typeof googleCalendarPush;
  googleCalendarSync: typeof googleCalendarSync;
  "lib/auth": typeof lib_auth;
  "lib/availability_cap": typeof lib_availability_cap;
  "lib/calendar_dates": typeof lib_calendar_dates;
  "lib/canvas/ics": typeof lib_canvas_ics;
  "lib/config": typeof lib_config;
  "lib/drift/index": typeof lib_drift_index;
  "lib/errors": typeof lib_errors;
  "lib/feasibility/availability": typeof lib_feasibility_availability;
  "lib/feasibility/index": typeof lib_feasibility_index;
  "lib/feasibility/overload": typeof lib_feasibility_overload;
  "lib/googleAiGendaCalendar": typeof lib_googleAiGendaCalendar;
  "lib/googleCalendarScopes": typeof lib_googleCalendarScopes;
  "lib/importedTaskUpsert": typeof lib_importedTaskUpsert;
  "lib/mappers": typeof lib_mappers;
  "lib/parentTaskProgress": typeof lib_parentTaskProgress;
  "lib/parent_task_progress": typeof lib_parent_task_progress;
  "lib/plan/generate": typeof lib_plan_generate;
  "lib/plan/index": typeof lib_plan_index;
  "lib/plan/period": typeof lib_plan_period;
  "lib/plan/scheduler": typeof lib_plan_scheduler;
  "lib/plan/validate": typeof lib_plan_validate;
  "lib/plan_sequence": typeof lib_plan_sequence;
  "lib/priority/index": typeof lib_priority_index;
  "lib/summary": typeof lib_summary;
  "lib/taskDedupe": typeof lib_taskDedupe;
  "lib/tokenCrypto": typeof lib_tokenCrypto;
  "lib/types": typeof lib_types;
  overdueAcknowledgments: typeof overdueAcknowledgments;
  ping: typeof ping;
  plans: typeof plans;
  plansInternal: typeof plansInternal;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
