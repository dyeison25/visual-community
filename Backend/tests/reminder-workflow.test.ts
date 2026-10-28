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

test("el workflow es exclusivamente manual, fijado, sin secretos en instalación/build ni artefactos", () => {
  const path = resolve(import.meta.dir, "../../.github/workflows/inactivity-reminders.yml");
  const text = readFileSync(path, "utf8");
  const workflow = Bun.YAML.parse(text) as {
    on: { workflow_dispatch: { inputs: Record<string, { default: boolean }> } }; permissions: Record<string, string>;
    concurrency: { "cancel-in-progress": boolean }; jobs: { reminders: { if: string; environment: string; steps: { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }[] } };
  };
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.on.workflow_dispatch.inputs.dry_run?.default).toBe(true); expect(workflow.on.workflow_dispatch.inputs.confirm_send?.default).toBe(false);
  expect(workflow.permissions).toEqual({ contents: "read" }); expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const job = workflow.jobs.reminders; expect(job.environment).toBe("reminder-tests");
  for (const guard of ["github.repository == 'dyeison25/visual-community'", "github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'"]) expect(job.if).toContain(guard);
  const execution = job.steps.filter(step => step.run === "bun run reminders"); expect(execution).toHaveLength(1);
  expect(execution[0]!.env?.REMINDER_SEND_MODE).toBe("test"); expect(execution[0]!.env?.REMINDER_ENABLED).toContain("|| 'false'");
  expect(execution[0]!.env?.REMINDER_DRY_RUN).toContain("inputs.dry_run");
  for (const step of job.steps) {
    if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    if (step !== execution[0]) expect(JSON.stringify(step)).not.toContain("secrets.");
  }
  expect(job.steps.find(step => step.uses?.startsWith("actions/checkout@"))?.with?.["persist-credentials"]).toBe(false);
  expect(job.steps.find(step => step.run?.startsWith("bun install"))?.run).toContain("--ignore-scripts");
  expect(text).not.toMatch(/upload-artifact|actions\/cache|pull_request_target|\$\{\{\s*inputs\.[^}]+\}\}.*\n.*run:/);
  const names = [...text.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]);
  expect(names.sort()).toEqual(["EMAIL_FROM", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_PROJECT_ID", "NOTIFICATION_TOKEN_SECRET", "REMINDER_TEST_USER_IDS", "SMTP_APP_PASSWORD", "SMTP_USER"].sort());
});
