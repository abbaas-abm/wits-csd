import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverRegistrationEmail } from "@/lib/email/registration";
import { deliverPledgeDocument } from "@/lib/email/pledge";
import { deliverEventReport } from "@/lib/email/report";
import { deliverReminderEmail } from "@/lib/email/reminder";
import { deliverAnnouncementEmail } from "@/lib/email/announcement";
import type { UserPosition } from "@/lib/types";
import type {
  AnnouncementJob,
  PledgeJob,
  RegistrationJob,
  ReportJob,
  ReminderJob,
} from "@/lib/queue";

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("[worker] REDIS_URL is not set. Exiting.");
  process.exit(1);
}

const connection = new IORedis(url, { maxRetriesPerRequest: null });
connection.on("error", (error) => {
  console.error("[worker] redis error:", error.message);
});

function log(job: Job, message: string) {
  console.log(`[worker] ${job.queueName}:${job.id} ${message}`);
}

const registrationWorker = new Worker<RegistrationJob>(
  "registrations",
  async (job) => {
    const supabase = createAdminClient();
    await deliverRegistrationEmail({
      supabase,
      registrationId: job.data.registrationId,
      data: {
        ...job.data.data,
        position: job.data.data.position as UserPosition,
      },
      throwOnError: true,
    });
    log(job, `confirmation processed for ${job.data.data.email}`);
  },
  { connection, concurrency: 4 },
);

const pledgeWorker = new Worker<PledgeJob>(
  "pledges",
  async (job) => {
    const supabase = createAdminClient();
    await deliverPledgeDocument({
      supabase,
      pledgeId: job.data.pledgeId,
      throwOnError: true,
    });
    log(job, `pledge document processed for ${job.data.pledgeId}`);
  },
  { connection, concurrency: 4 },
);

const reportWorker = new Worker<ReportJob>(
  "reports",
  async (job) => {
    const supabase = createAdminClient();
    await deliverEventReport({
      supabase,
      to: job.data.to,
      eventId: job.data.eventId,
      throwOnError: true,
    });
    log(job, `report processed for ${job.data.to}`);
  },
  { connection, concurrency: 2 },
);

const reminderWorker = new Worker<ReminderJob>(
  "reminders",
  async (job) => {
    const supabase = createAdminClient();
    await deliverReminderEmail({
      supabase,
      registrationId: job.data.registrationId,
      throwOnError: true,
    });
    log(job, `reminder processed for ${job.data.registrationId}`);
  },
  // Plunk allows ~1000 emails/min; 5 concurrent keeps us comfortably under it.
  { connection, concurrency: 5 },
);

const announcementWorker = new Worker<AnnouncementJob>(
  "announcements",
  async (job) => {
    const supabase = createAdminClient();
    await deliverAnnouncementEmail({
      supabase,
      announcementId: job.data.announcementId,
      attendeeId: job.data.attendeeId,
      subject: job.data.subject,
      throwOnError: true,
    });
    log(job, `announcement processed for ${job.data.attendeeId}`);
  },
  // Shares Plunk's ~1000 emails/min with reminders; stay well under it.
  { connection, concurrency: 5 },
);

for (const worker of [
  registrationWorker,
  pledgeWorker,
  reportWorker,
  reminderWorker,
  announcementWorker,
]) {
  worker.on("failed", (job, error) => {
    console.error(
      `[worker] ${worker.name} job ${job?.id ?? "?"} failed:`,
      error.message,
    );
  });
}

console.log(
  "[worker] listening for registrations, pledges, reports, reminders, announcements",
);

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down`);
  await Promise.all([
    registrationWorker.close(),
    pledgeWorker.close(),
    reportWorker.close(),
    reminderWorker.close(),
    announcementWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
