import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertReminderWorkflowPolicy } from "../src/services/notifications/workflow-policy";

const allowed = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REPOSITORY: "dyeison25/visual-community", GITHUB_REF: "refs/heads/main",
  FIREBASE_PROJECT_ID: "sistemagestionpermanencia", EMAIL_PROVIDER: "gmail_smtp", REMINDER_SEND_MODE: "test", REMINDER_ENABLED: "false", REMINDER_DRY_RUN: "true" };

test("el control del ejecutable admite dry run manual y exige todas las barreras para envío real", () => {
  expect(() => assertReminderWorkflowPolicy(allowed)).not.toThrow();
  expect(() => assertReminderWorkflowPolicy({})).not.toThrow();
  const real = { ...allowed, REMINDER_ENABLED: "true", REMINDER_DRY_RUN: "false", VC_REMINDER_CONFIRM_SEND: "true", REMINDER_TEST_USER_IDS: "fixture-uid" };
  expect(() => assertReminderWorkflowPolicy(real)).not.toThrow();
  for (const patch of [{ REMINDER_ENABLED: "false" }, { VC_REMINDER_CONFIRM_SEND: "false" }, { REMINDER_TEST_USER_IDS: "" }, { REMINDER_SEND_MODE: "general" }, { EMAIL_PROVIDER: "resend" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "schedule" }, { GITHUB_REF: "refs/heads/other" }, { GITHUB_REF: "refs/pull/1/merge" }, { GITHUB_REPOSITORY: "other/fork" }, { FIREBASE_PROJECT_ID: "other-project" }, { FIRESTORE_EMULATOR_HOST: "localhost:8080" }]) {
    expect(() => assertReminderWorkflowPolicy({ ...real, ...patch })).toThrow();
  }
});

test("schedule solo permite live general activo, 96 horas y ninguna lista de prueba", () => {
  const scheduled = { ...allowed, GITHUB_EVENT_NAME: "schedule", REMINDER_ENABLED: "true", REMINDER_DRY_RUN: "false", REMINDER_SEND_MODE: "live", REMINDER_TEST_USER_IDS: "", VC_REMINDER_CONFIRM_SEND: "false" };
  expect(() => assertReminderWorkflowPolicy(scheduled)).not.toThrow();
  for (const patch of [{ REMINDER_ENABLED: "false" }, { REMINDER_DRY_RUN: "true" }, { REMINDER_SEND_MODE: "test" }, { REMINDER_SEND_MODE: "general" }, { REMINDER_SEND_MODE: "typo" }, { REMINDER_TEST_USER_IDS: "fixture-user" }, { REMINDER_INACTIVITY_DAYS: "3" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_REF: "refs/heads/other" }, { GITHUB_REPOSITORY: "other/fork" }]) {
    expect(() => assertReminderWorkflowPolicy({ ...scheduled, ...patch })).toThrow();
  }
});

test("el workflow separa cron live y ensayo manual seguro, sin secretos en instalación/build", () => {
  const path = resolve(import.meta.dir, "../../.github/workflows/inactivity-reminders.yml");
  const text = readFileSync(path, "utf8");
  const workflow = Bun.YAML.parse(text) as {
    on: { schedule: { cron: string }[]; workflow_dispatch: { inputs: Record<string, { default: boolean }> } }; permissions: Record<string, string>;
    concurrency: { "cancel-in-progress": boolean }; jobs: { reminders: { if: string; environment: string; steps: { if?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }[] } };
  };
  expect(Object.keys(workflow.on).sort()).toEqual(["schedule", "workflow_dispatch"]);
  expect(workflow.on.schedule).toEqual([{ cron: "17 15 * * *" }]);
  expect(workflow.on.workflow_dispatch.inputs.dry_run?.default).toBe(true); expect(workflow.on.workflow_dispatch.inputs.confirm_send?.default).toBe(false);
  expect(workflow.permissions).toEqual({ contents: "read" }); expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const job = workflow.jobs.reminders; expect(job.environment).toBe("reminder-tests");
  for (const guard of ["github.repository == 'dyeison25/visual-community'", "github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'"]) expect(job.if).toContain(guard);
  const execution = job.steps.filter(step => step.run === "bun run reminders"); expect(execution).toHaveLength(2);
  const scheduled = execution.find(step => step.if === "github.event_name == 'schedule'")!;
  const manual = execution.find(step => step.if === "github.event_name == 'workflow_dispatch'")!;
  expect(scheduled.env?.REMINDER_ENABLED).toBe("true"); expect(scheduled.env?.REMINDER_DRY_RUN).toBe("false");
  expect(scheduled.env?.REMINDER_SEND_MODE).toBe("live"); expect(scheduled.env?.REMINDER_TEST_USER_IDS).toBe("");
  expect(scheduled.env?.REMINDER_INACTIVITY_DAYS).toBe("4");
  expect(manual.env?.REMINDER_SEND_MODE).toBe("test"); expect(manual.env?.REMINDER_ENABLED).toContain("|| 'false'");
  expect(manual.env?.REMINDER_DRY_RUN).toContain("inputs.dry_run");
  expect(manual.env?.VC_REMINDER_CONFIRM_SEND).toContain("inputs.confirm_send");
  expect(manual.env?.REMINDER_TEST_USER_IDS).toBe("${{ secrets.REMINDER_TEST_USER_IDS }}");
  for (const step of job.steps) {
    if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    if (!execution.includes(step)) expect(JSON.stringify(step)).not.toContain("secrets.");
  }
  expect(job.steps.find(step => step.uses?.startsWith("actions/checkout@"))?.with?.["persist-credentials"]).toBe(false);
  expect(job.steps.find(step => step.run?.startsWith("bun install"))?.run).toContain("--ignore-scripts");
  expect(text).not.toMatch(/upload-artifact|actions\/cache|pull_request_target|\$\{\{\s*inputs\.[^}]+\}\}.*\n.*run:/);
  const names = [...new Set([...text.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]))];
  expect(names.sort()).toEqual(["EMAIL_FROM", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_PROJECT_ID", "NOTIFICATION_TOKEN_SECRET", "REMINDER_TEST_USER_IDS", "SMTP_APP_PASSWORD", "SMTP_USER"].sort());
});
