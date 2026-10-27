import type { Timestamp } from "firebase-admin/firestore";

export type ActivityRecord = {
  userId: string; cycleId: string; lastActiveAt: Timestamp; lastReminderAcceptedAt?: Timestamp;
};
export type ReminderStatus = "sending" | "accepted" | "retryable" | "uncertain" | "failed_permanent" | "needs_review" | "skipped";
export type FrozenEmail = { from: string; to: string[]; subject: string; html: string; text: string; tags: { name: string; value: string }[] };
export type SealedEmail = { iv: string; ciphertext: string; tag: string };
export type ReminderRecord = {
  userId: string; cycleId: string; status: ReminderStatus; attemptCount: number;
  idempotencyKey: string; payloadHash: string; envelope: SealedEmail;
  createdAt: Timestamp; firstRequestAt: Timestamp; retryDeadlineAt: Timestamp;
  leaseId: string; leaseUntil: Timestamp | null; nextAttemptAt: Timestamp | null;
};
export type ProviderResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "retryable" | "permanent" | "uncertain"; code: string; message: string }
  | { status: "disabled" | "simulated" };
