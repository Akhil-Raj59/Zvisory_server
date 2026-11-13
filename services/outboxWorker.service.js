import LeadJob from '../models/leadJob.model.js';
import Lead from '../models/lead.model.js';
import { sendLeadEmails } from './leadEmail.service.js';
import { syncLeadToLeadSquared } from './leadSquared.service.js';

let workerIntervalId = null;
let isProcessing = false;

/**
 * Calculates exponential backoff delay in milliseconds.
 * E.g., attempt 1 = 30s, attempt 2 = 60s, attempt 3 = 120s, attempt 4 = 240s
 */
function getBackoffDelayMs(attempts) {
  const baseDelay = 30 * 1000; // 30 seconds base
  const multiplier = Math.pow(2, Math.max(0, attempts - 1));
  const maxDelay = 24 * 60 * 60 * 1000; // 24 hours max
  return Math.min(baseDelay * multiplier, maxDelay);
}

/**
 * Process a single outbox job.
 */
async function processJob(job) {
  const { _id, leadId, type, attempts, maxAttempts, payload } = job;

  console.log(`⏳ [OUTBOX_JOB] Starting ${type} for lead ${leadId} (attempt ${attempts + 1}/${maxAttempts})`);

  try {
    if (type === 'EMAIL_NOTIFICATION') {
      await sendLeadEmails(payload);

      await LeadJob.findByIdAndUpdate(_id, {
        status: 'completed',
        attempts: attempts + 1,
        lastAttemptAt: new Date(),
        lastError: '',
      });

      await Lead.findByIdAndUpdate(leadId, {
        emailStatus: 'sent',
      });

      console.log(`✅ [OUTBOX_JOB_SUCCESS] ${type} completed for lead ${leadId}`);
    } else if (type === 'LEADSQUARED_SYNC') {
      const syncResult = await syncLeadToLeadSquared(payload);

      if (syncResult.status === 'configuration_required') {
        await LeadJob.findByIdAndUpdate(_id, {
          status: 'configuration_required',
          attempts: attempts + 1,
          lastAttemptAt: new Date(),
          lastError: syncResult.message,
          result: syncResult,
        });

        await Lead.findByIdAndUpdate(leadId, {
          crmStatus: 'configuration_required',
        });

        console.log(`ℹ️ [OUTBOX_JOB_PENDING] ${type} for lead ${leadId} marked as configuration_required`);
      } else {
        await LeadJob.findByIdAndUpdate(_id, {
          status: 'completed',
          attempts: attempts + 1,
          lastAttemptAt: new Date(),
          lastError: '',
          result: syncResult,
        });

        await Lead.findByIdAndUpdate(leadId, {
          crmStatus: 'synced',
          leadSquaredId: syncResult.externalId || '',
        });

        console.log(`✅ [OUTBOX_JOB_SUCCESS] ${type} completed for lead ${leadId}`);
      }
    }
  } catch (err) {
    const nextAttempt = attempts + 1;
    const hasExceeded = nextAttempt >= maxAttempts;
    const nextRun = new Date(Date.now() + getBackoffDelayMs(nextAttempt));

    console.error(
      `❌ [OUTBOX_JOB_FAILED] ${type} for lead ${leadId} failed (attempt ${nextAttempt}/${maxAttempts}):`,
      err.message
    );

    await LeadJob.findByIdAndUpdate(_id, {
      status: hasExceeded ? 'failed' : 'pending',
      attempts: nextAttempt,
      lastAttemptAt: new Date(),
      lastError: err.message,
      nextRunAt: nextRun,
    });

    if (hasExceeded) {
      const statusField = type === 'EMAIL_NOTIFICATION' ? 'emailStatus' : 'crmStatus';
      await Lead.findByIdAndUpdate(leadId, {
        [statusField]: 'failed',
      });
    }
  }
}

/**
 * Worker tick: grabs eligible pending jobs and executes them.
 */
export async function tickOutboxWorker() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();

    // Fetch up to 10 pending jobs ready for execution
    const jobs = await LeadJob.find({
      status: 'pending',
      nextRunAt: { $lte: now },
    })
      .sort({ nextRunAt: 1 })
      .limit(10);

    for (const job of jobs) {
      // Atomic lock using findOneAndUpdate to prevent duplicate execution across workers
      const lockedJob = await LeadJob.findOneAndUpdate(
        { _id: job._id, status: 'pending' },
        { status: 'processing', lastAttemptAt: new Date() },
        { new: true }
      );

      if (lockedJob) {
        await processJob(lockedJob);
      }
    }
  } catch (err) {
    console.error('❌ [OUTBOX_TICK_ERROR]', err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Triggers an immediate worker cycle in the background.
 */
export function triggerWorkerImmediate() {
  setImmediate(() => {
    tickOutboxWorker().catch((err) =>
      console.error('❌ [OUTBOX_IMMEDIATE_ERROR]', err)
    );
  });
}

/**
 * Recovers stuck jobs on server boot and starts the periodic scheduler.
 */
export async function startOutboxWorker() {
  try {
    // Reset any jobs left in 'processing' state from sudden server restart/crash
    const recovered = await LeadJob.updateMany(
      { status: 'processing' },
      {
        status: 'pending',
        lastError: 'Recovered after server restart while processing',
      }
    );

    if (recovered.modifiedCount > 0) {
      console.log(`🔄 [OUTBOX_RECOVERY] Reset ${recovered.modifiedCount} interrupted jobs to pending`);
    }

    const pollInterval = Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 15000;

    if (!workerIntervalId) {
      workerIntervalId = setInterval(() => {
        tickOutboxWorker().catch((err) =>
          console.error('❌ [OUTBOX_INTERVAL_ERROR]', err)
        );
      }, pollInterval);

      console.log(`🚀 [OUTBOX_WORKER] Started background lead worker (polling every ${pollInterval / 1000}s)`);
    }

    // Run first tick immediately
    triggerWorkerImmediate();
  } catch (err) {
    console.error('❌ [OUTBOX_START_ERROR] Failed to start outbox worker:', err);
  }
}

/**
 * Stops the worker (e.g. for graceful shutdown / tests).
 */
export function stopOutboxWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('🛑 [OUTBOX_WORKER] Stopped background lead worker');
  }
}

/**
 * Admin action: Manually retry an eligible job.
 */
export async function adminRetryJob(jobId) {
  const job = await LeadJob.findById(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  job.status = 'pending';
  job.nextRunAt = new Date();
  job.lastError = 'Manual admin retry initiated';
  await job.save();

  // Also update parent lead status
  const statusField = job.type === 'EMAIL_NOTIFICATION' ? 'emailStatus' : 'crmStatus';
  await Lead.findByIdAndUpdate(job.leadId, {
    [statusField]: 'pending',
  });

  triggerWorkerImmediate();

  return job;
}

