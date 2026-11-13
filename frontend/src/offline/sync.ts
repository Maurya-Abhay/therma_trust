import axios from "axios";
import { createServiceReport, fetchServiceReports } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import { listItems, removeItem, updateItem, type OutboxItem } from "./outbox";
import type { ServiceReport } from "../types";

export interface FlushResult {
  synced: number;
  // True when we hit a problem that isn't any one report's fault (server
  // unreachable, expired login, 5xx) - everything left stays queued for later.
  stopped: boolean;
}

// A response lost on the way back can leave a report saved on the server but
// still queued here. ServiceReport.job is one-to-one, so the retry gets
// rejected - which is how we know it already arrived and can be dropped.
async function alreadyDelivered(item: OutboxItem) {
  try {
    return (await fetchServiceReports({ job: item.jobId })).length > 0;
  } catch {
    return false;
  }
}

let inFlight: Promise<FlushResult> | null = null;

export function flushOutbox(userId: number, retryFailed = false): Promise<FlushResult> {
  // One flush at a time, or a double trigger would send every report twice.
  inFlight ??= doFlush(userId, retryFailed).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doFlush(userId: number, retryFailed: boolean): Promise<FlushResult> {
  let synced = 0;
  for (const item of await listItems(userId)) {
    if (item.error && !retryFailed) continue;
    try {
      await createServiceReport(item.payload as Partial<ServiceReport>);
      await removeItem(item.id!);
      synced += 1;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) return { synced, stopped: true };
      const status = error.response.status;
      if (status === 401 || status >= 500) return { synced, stopped: true };

      if (await alreadyDelivered(item)) {
        await removeItem(item.id!);
        synced += 1;
        continue;
      }
      await updateItem({ ...item, error: getErrorMessage(error) });
    }
  }
  return { synced, stopped: false };
}
