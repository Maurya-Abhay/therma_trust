import { Outbox } from './Outbox';
import { apiClient } from '@/src/api/client';
import { createServiceReport, fetchServiceReports, uploadServiceReportPhoto } from '@/src/api/endpoints';
import type { ServiceReport } from '@/src/types/api';
import * as FileSystem from 'expo-file-system/legacy';

interface QueuedReportPhoto {
  uri: string;
  name: string;
  type: string;
  is_before: boolean;
}

interface QueuedReportPayload {
  report: Partial<ServiceReport>;
  photos?: QueuedReportPhoto[];
  reportId?: number;
  uploadedPhotoCount?: number;
}

async function syncServiceReport(payload: unknown, outboxId: number) {
  const saved = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const report = (saved.report as Partial<ServiceReport> | undefined) ?? payload as Partial<ServiceReport>;
  const photos = Array.isArray(saved.photos) ? saved.photos as QueuedReportPhoto[] : [];
  let reportId = typeof saved.reportId === 'number' ? saved.reportId : undefined;
  let uploadedPhotoCount = Math.min(photos.length, Math.max(0, Number(saved.uploadedPhotoCount) || 0));

  if (!reportId) {
    try {
      const created = await createServiceReport(report);
      reportId = created.id;
    } catch (createError) {
      try {
        const existing = await fetchServiceReports({ job: report.job });
        if (!existing.length) throw createError;
        reportId = existing[0].id;
      } catch {
        throw createError;
      }
    }

    Outbox.updatePayload(outboxId, { ...saved, report, photos, reportId, uploadedPhotoCount } satisfies QueuedReportPayload);
  }

  for (let index = uploadedPhotoCount; index < photos.length; index += 1) {
    const photo = photos[index];
    await uploadServiceReportPhoto(
      reportId,
      { uri: photo.uri, name: photo.name, type: photo.type },
      '',
      photo.is_before
    );
    uploadedPhotoCount = index + 1;
    Outbox.updatePayload(outboxId, { ...saved, report, photos, reportId, uploadedPhotoCount } satisfies QueuedReportPayload);
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (documentDirectory) {
    for (const photo of photos) {
      if (photo.uri.startsWith(`${documentDirectory}offline-reports/`)) {
        try {
          await FileSystem.deleteAsync(photo.uri, { idempotent: true });
        } catch (error) {
          console.warn('Could not remove a synced offline report photo:', error);
        }
      }
    }
  }
}

export const SyncManager = {
  async syncAll(userId: number) {
    const entries = Outbox.getAll(userId);
    
    for (const entry of entries) {
      try {
        const payload = JSON.parse(entry.payload);
        if (entry.mutationKey === 'createServiceReport') {
          await syncServiceReport(payload, entry.id);
        } else {
          await this.replayMutation(entry.mutationKey, payload);
        }
        Outbox.remove(entry.id);
      } catch (error) {
        Outbox.incrementRetries(entry.id);
        console.error(`Sync failed for ${entry.mutationKey}:`, error);
        
        // If retries exceeded, could move to dead letter queue
        if (entry.retries >= 5) {
          console.warn(`Mutation ${entry.mutationKey} exceeded max retries`);
        }
      }
    }
  },

  async replayMutation(key: string, payload: any) {
    switch (key) {
      case 'createServiceReport':
        await apiClient.post('/service-reports/', payload);
        break;
      case 'createCredential':
        await apiClient.post('/credentials/', payload, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        break;
      case 'verifyCredential':
        await apiClient.post(`/credentials/${payload.id}/verify/`, payload);
        break;
      case 'createCapability':
        await apiClient.post('/capabilities/', payload);
        break;
      case 'verifyCapability':
        await apiClient.post(`/capabilities/${payload.id}/verify/`, payload);
        break;
      case 'createWorkHistory':
        await apiClient.post('/work-history/', payload);
        break;
      case 'createFacility':
        await apiClient.post('/facilities/', payload);
        break;
      case 'createEquipment':
        await apiClient.post('/equipment/', payload);
        break;
      case 'createJob':
        await apiClient.post('/jobs/', payload);
        break;
      case 'assignJob':
        await apiClient.post(`/jobs/${payload.jobId}/assign/`, payload);
        break;
      case 'createContractor':
        await apiClient.post('/contractors/', payload);
        break;
      case 'addTechnicianToContractor':
        await apiClient.post(`/contractors/${payload.companyId}/add-technician/`, { technician_id: payload.technicianId });
        break;
      case 'removeTechnicianFromContractor':
        await apiClient.post(`/contractors/${payload.companyId}/remove-technician/`, { technician_id: payload.technicianId });
        break;
      case 'uploadContractorDocument':
        await apiClient.post('/contractor-documents/', payload, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        break;
      case 'verifyContractorDocument':
        await apiClient.post(`/contractor-documents/${payload.id}/verify/`, { status: payload.status });
        break;
      case 'verifyContractorCompany':
        await apiClient.post(`/contractors/${payload.id}/verify/`, { verification_status: payload.verification_status });
        break;
      case 'createCylinder':
        await apiClient.post('/cylinders/', payload);
        break;
      case 'updateTechnicianProfile':
        await apiClient.patch(`/technicians/${payload.id}/`, payload);
        break;
      default:
        throw new Error(`Unknown offline mutation key: ${key}`);
    }
  },
};

export function useSyncManager(userId: number) {
  return { syncAll: () => SyncManager.syncAll(userId) };
}