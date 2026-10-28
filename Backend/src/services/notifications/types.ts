import type { Timestamp } from "firebase-admin/firestore";

export type EmailProvider = "resend" | "gmail_smtp";
export type DispatchContext = { provider: EmailProvider; messageId?: string; createdAt: number };

export type ActivityRecord = {
  userId: string; cycleId: string; lastActiveAt: Timestamp; lastReminderAcceptedAt?: Timestamp;
};
export type ReminderStatus = "sending" | "accepted" | "retryable" | "uncertain" | "failed_permanent" | "needs_review" | "skipped";
export type FrozenEmail = { from: string; to: string[]; subject: string; html: string; text: string; tags: { name: string; value: string }[] };
export type SealedEmail = { iv: string; ciphertext: string; tag: string };
export type ReminderRecord = {
  // Los documentos anteriores sin provider pertenecen a Resend.
  provider?: EmailProvider; messageId?: string; dispatchStartedAt?: Timestamp | null;
  userId: string; cycleId: string; status: ReminderStatus; attemptCount: number;
  idempotencyKey: string; payloadHash: string; envelope: SealedEmail;
  createdAt: Timestamp; firstRequestAt: Timestamp; retryDeadlineAt: Timestamp;
  leaseId: string; leaseUntil: Timestamp | null; nextAttemptAt: Timestamp | null;
};
export type ProviderResult =
  | { status: "accepted"; providerMessageId?: string; messageId?: string }
  | { status: "retryable" | "permanent" | "uncertain" | "account_error"; code: string; message: string }
  | { status: "disabled" | "simulated" };
