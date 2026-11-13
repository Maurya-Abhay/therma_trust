import { API_BASE_URL, PUBLIC_WEB_BASE_URL } from './config';
import { apiClient, tokenStore } from './client';
import type {
  AdminDashboard,
  Assessment,
  AssessmentAttemptResult,
  CapabilitySkill,
  Choices,
  ComplianceAlert,
  Credential,
  ExtractedCredentialFields,
  ContractorCompany,
  ContractorCompliance,
  ContractorDocument,
  CylinderTransaction,
  Equipment,
  EquipmentHistory,
  Facility,
  JobFeedback,
  JobMatch,
  JobRequest,
  NotificationsResponse,
  PushKeyResponse,
  OnboardingChecklist,
  SearchResult,
  Paginated,
  PublicTechnicianVerification,
  RefrigerantCylinder,
  RefrigerantDashboardSummary,
  RefrigerantType,
  ServiceReport,
  ServiceReportPhoto,
  SelfRegisterRole,
  TechnicianProfile,
  User,
  WorkHistoryEntry,
} from '@/src/types/api';

// ---- auth ----
export async function login(email: string, password: string) {
  const { data } = await apiClient.post('/auth/login/', { email, password });
  await tokenStore.set(data.access, data.refresh);
  return data.user as User;
}

export async function register(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: SelfRegisterRole;
}) {
  const { data } = await apiClient.post('/auth/register/', payload);
  return data as User;
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me/');
  return data as User;
}

export async function requestPasswordReset(email: string) {
  const { data } = await apiClient.post<{ detail: string }>('/auth/password-reset/', { email });
  return data;
}

export async function confirmPasswordReset(payload: { uid: string; token: string; password: string }) {
  const { data } = await apiClient.post<{ detail: string }>('/auth/password-reset/confirm/', payload);
  return data;
}

export async function logout() {
  await tokenStore.clear();
}

// ---- core ----
async function fetchAllPages<T>(path: string, params?: Record<string, unknown>) {
  const results: T[] = [];
  const visited = new Set<string>();
  let next: string | null = path;
  let firstPage = true;

  while (next) {
    if (visited.has(next)) throw new Error('The server returned a repeated pagination link.');
    visited.add(next);
    const response: { data: Paginated<T> | T[] } = await apiClient.get<Paginated<T> | T[]>(
      next,
      firstPage && params ? { params } : undefined,
    );
    const pageData: Paginated<T> | T[] = response.data;
    if (Array.isArray(pageData)) {
      results.push(...pageData);
      break;
    }
    results.push(...pageData.results);
    next = pageData.next;
    firstPage = false;
  }

  return results;
}

export async function fetchChoices() {
  const { data } = await apiClient.get('/choices/');
  return data as Choices;
}

export async function fetchRefrigerantTypes() {
  const { data } = await apiClient.get('/refrigerant-types/');
  return (data.results ?? data) as RefrigerantType[];
}

// ---- facilities ----
export async function fetchFacilities() {
  return fetchAllPages<Facility>('/facilities/');
}

export async function fetchFacility(id: number) {
  const { data } = await apiClient.get<Facility>(`/facilities/${id}/`);
  return data as Facility;
}

export async function createFacility(payload: Partial<Facility>) {
  const { data } = await apiClient.post('/facilities/', payload);
  return data as Facility;
}

export async function fetchEquipment(facilityId?: number) {
  return fetchAllPages<Equipment>('/equipment/', facilityId ? { facility: facilityId } : undefined);
}

export async function fetchAllEquipment() {
  return fetchEquipment();
}

export async function createEquipment(payload: Partial<Equipment>) {
  const { data } = await apiClient.post('/equipment/', payload);
  return data as Equipment;
}

// ---- contractors ----
export async function fetchContractors() {
  const { data } = await apiClient.get<Paginated<ContractorCompany>>('/contractors/');
  return data.results;
}

export async function verifyContractorCompany(id: number, verificationStatus: string) {
  const { data } = await apiClient.post(`/contractors/${id}/verify/`, { verification_status: verificationStatus });
  return data as ContractorCompany;
}

export async function fetchAllContractorDocuments() {
  const { data } = await apiClient.get<Paginated<ContractorDocument>>('/contractor-documents/');
  return data.results;
}

export async function verifyContractorDocument(id: number, status: string) {
  const { data } = await apiClient.post(`/contractor-documents/${id}/verify/`, { status });
  return data as ContractorDocument;
}

export async function createContractor(payload: Partial<ContractorCompany>) {
  const { data } = await apiClient.post('/contractors/', payload);
  return data as ContractorCompany;
}

export async function fetchContractorTechnicians(companyId: number) {
  const { data } = await apiClient.get(`/contractors/${companyId}/technicians/`);
  return data as TechnicianProfile[];
}

export async function addTechnicianToContractor(companyId: number, technicianId: number) {
  const { data } = await apiClient.post(`/contractors/${companyId}/add-technician/`, { technician_id: technicianId });
  return data as TechnicianProfile;
}

export async function removeTechnicianFromContractor(companyId: number, technicianId: number) {
  await apiClient.post(`/contractors/${companyId}/remove-technician/`, { technician_id: technicianId });
}

export async function fetchContractorDocuments(companyId: number) {
  const { data } = await apiClient.get<Paginated<ContractorDocument>>('/contractor-documents/', {
    params: { company: companyId },
  });
  return data.results;
}

export async function uploadContractorDocument(companyId: number, docType: string, file: any) {
  const form = new FormData();
  form.append('company', String(companyId));
  form.append('doc_type', docType);
  form.append('file', file);
  const { data } = await apiClient.post('/contractor-documents/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as ContractorDocument;
}

// ---- technicians ----
export async function fetchTechnicians(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<Paginated<TechnicianProfile>>('/technicians/', { params });
  return data.results;
}

export async function fetchMyTechnicianProfile() {
  try {
    const { data } = await apiClient.get<TechnicianProfile>('/technicians/me/');
    return data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function updateTechnicianProfile(id: number, payload: Partial<TechnicianProfile>) {
  const { data } = await apiClient.patch(`/technicians/${id}/`, payload);
  return data as TechnicianProfile;
}

export async function fetchCredentials(technicianId: number | 'me') {
  const { data } = await apiClient.get<Paginated<Credential>>('/credentials/', { params: { technician: technicianId } });
  return data.results;
}

export async function fetchCredential(id: number) {
  const { data } = await apiClient.get<Credential>(`/credentials/${id}/`);
  return data;
}

export async function extractCredential(file: any) {
  const payload = new FormData();
  payload.append('file', file);
  const { data } = await apiClient.post<ExtractedCredentialFields>('/credentials/extract/', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function runCredentialAiCheck(id: number) {
  const { data } = await apiClient.post(`/credentials/${id}/ai-check/`);
  return data as Credential;
}

export async function fetchAllCredentials() {
  const { data } = await apiClient.get<Paginated<Credential>>('/credentials/');
  return data.results;
}

export async function verifyCredential(id: number, status: string, notes?: string) {
  const { data } = await apiClient.post(`/credentials/${id}/verify/`, { status, notes });
  return data as Credential;
}

export async function createCredential(payload: FormData) {
  const { data } = await apiClient.post('/credentials/', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as Credential;
}

export async function fetchCapabilities(technicianId: number | 'me') {
  const { data } = await apiClient.get<Paginated<CapabilitySkill>>('/capabilities/', {
    params: { technician: technicianId },
  });
  return data.results;
}

export async function fetchCapability(id: number) {
  const { data } = await apiClient.get<CapabilitySkill>(`/capabilities/${id}/`);
  return data;
}

export async function fetchAllCapabilities() {
  const { data } = await apiClient.get<Paginated<CapabilitySkill>>('/capabilities/');
  return data.results;
}

export async function createCapability(payload: Partial<CapabilitySkill>) {
  const { data } = await apiClient.post('/capabilities/', payload);
  return data as CapabilitySkill;
}

export async function verifyCapability(id: number, status: string, note?: string) {
  const { data } = await apiClient.post(`/capabilities/${id}/verify/`, { status, note });
  return data as CapabilitySkill;
}

export async function fetchWorkHistory(technicianId: number | 'me') {
  const { data } = await apiClient.get<Paginated<WorkHistoryEntry>>('/work-history/', {
    params: { technician: technicianId },
  });
  return data.results;
}

export async function createWorkHistory(payload: Partial<WorkHistoryEntry>) {
  const { data } = await apiClient.post('/work-history/', payload);
  return data as WorkHistoryEntry;
}

// ---- jobs ----
export async function fetchJobs(params?: Record<string, unknown>) {
  return fetchAllPages<JobRequest>('/jobs/', params);
}

export async function fetchJob(id: number) {
  const { data } = await apiClient.get(`/jobs/${id}/`);
  return data as JobRequest;
}

export async function createJob(payload: {
  facility: number;
  equipment: number;
  description: string;
  urgency: string;
  scheduled_for?: string | null;
}) {
  const { data } = await apiClient.post('/jobs/', payload);
  return data as JobRequest;
}

export async function fetchJobMatches(jobId: number) {
  const { data } = await apiClient.get(`/jobs/${jobId}/matches/`);
  return data as JobMatch[];
}

export async function assignJob(
  jobId: number,
  technicianId: number,
  overrideWarning = false,
  overrideReason = ''
) {
  const { data } = await apiClient.post(`/jobs/${jobId}/assign/`, {
    technician_id: technicianId,
    override_warning: overrideWarning,
    override_reason: overrideReason,
  });
  return data;
}

// ---- service reports ----
export async function fetchServiceReports(params?: Record<string, unknown>) {
  return fetchAllPages<ServiceReport>('/service-reports/', params);
}

export async function createServiceReport(payload: Partial<ServiceReport>) {
  const { data } = await apiClient.post('/service-reports/', payload);
  return data as ServiceReport;
}

export async function approveServiceReport(id: number) {
  const { data } = await apiClient.post(`/service-reports/${id}/approve/`);
  return data as ServiceReport;
}

export async function rejectServiceReport(id: number) {
  const { data } = await apiClient.post(`/service-reports/${id}/reject/`);
  return data as ServiceReport;
}

export async function downloadServiceReportPdf(reportId: number) {
  const { data } = await apiClient.get<ArrayBuffer>(`/service-reports/${reportId}/pdf/`, {
    responseType: 'arraybuffer',
  });
  return data;
}

export async function uploadServiceReportPhoto(reportId: number, file: any, caption: string, isBefore: boolean) {
  const form = new FormData();
  form.append('report', String(reportId));
  form.append('image', file);
  form.append('caption', caption);
  form.append('is_before', String(isBefore));
  const { data } = await apiClient.post('/service-report-photos/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as ServiceReportPhoto;
}

export async function fetchRefrigerantDashboard(facilityId?: number) {
  const { data } = await apiClient.get<RefrigerantDashboardSummary>('/dashboard/refrigerant-summary/', {
    params: facilityId ? { facility: facilityId } : undefined,
  });
  return data;
}

export async function downloadComplianceReport(facilityId?: number) {
  const { data } = await apiClient.get<ArrayBuffer>('/dashboard/refrigerant-summary/export/', {
    params: facilityId ? { facility: facilityId } : undefined,
    responseType: 'arraybuffer',
  });
  return data;
}

export async function downloadEquipmentLabel(equipmentId: number) {
  const { data } = await apiClient.get<ArrayBuffer>(`/equipment/${equipmentId}/label/`, {
    responseType: 'arraybuffer',
  });
  return data;
}

// ---- contractor compliance ----
export async function fetchContractorCompliance(companyId: number) {
  const { data } = await apiClient.get<ContractorCompliance>(`/contractors/${companyId}/compliance/`);
  return data;
}

export async function fetchContractorPendingApprovals(companyId: number) {
  const { data } = await apiClient.get<{ pending_capabilities: number }>(
    `/contractors/${companyId}/pending-approvals/`
  );
  return data.pending_capabilities;
}

// ---- admin dashboard ----
export async function fetchAdminDashboard() {
  const { data } = await apiClient.get<AdminDashboard>('/admin/dashboard/');
  return data;
}

export interface AuditVerifyResult {
  valid: boolean;
  broken_at_id: number | null;
  checked_count: number;
}

export async function verifyAuditLog() {
  const { data } = await apiClient.get<AuditVerifyResult>('/audit/verify/');
  return data;
}

// ---- assessments ----
export async function fetchAssessments() {
  const { data } = await apiClient.get<Paginated<Assessment>>('/assessments/');
  return data.results;
}

export async function fetchAssessment(id: number) {
  const { data } = await apiClient.get<Assessment>(`/assessments/${id}/`);
  return data;
}

export async function submitAssessment(id: number, answers: number[]) {
  const { data } = await apiClient.post<AssessmentAttemptResult>(`/assessments/${id}/submit/`, { answers });
  return data;
}

// ---- public verification (no auth) ----
export async function fetchPublicVerification(token: string) {
  const { data } = await apiClient.get<PublicTechnicianVerification>(`/public/technicians/${token}/`);
  return data;
}

export function publicQrImageUrl(token: string) {
  return `${API_BASE_URL}/public/technicians/${token}/qr/`;
}

export function publicVerifyUrl(token: string) {
  return `${PUBLIC_WEB_BASE_URL}/verify/${token}`;
}

export function publicEquipmentUrl(equipmentId: number) {
  return `${PUBLIC_WEB_BASE_URL}/equipment/${equipmentId}`;
}

export function publicPassportPdfUrl(token: string) {
  return `${API_BASE_URL}/public/technicians/${token}/passport.pdf`;
}

export async function verifyPassportHash(token: string, hash: string) {
  const { data } = await apiClient.get<{ valid: boolean; full_name: string }>(
    `${API_BASE_URL}/public/technicians/${token}/passport/verify/`,
    { params: { hash } }
  );
  return data;
}

// ---- refrigerant cylinders ----
export async function fetchCylinders() {
  const { data } = await apiClient.get<Paginated<RefrigerantCylinder>>('/cylinders/');
  return data.results;
}

export async function createCylinder(payload: {
  company: number;
  serial_number: string;
  refrigerant_type: number;
  kind: string;
  capacity_kg: string;
  current_kg: string;
}) {
  const { data } = await apiClient.post('/cylinders/', payload);
  return data as RefrigerantCylinder;
}

export async function fetchCylinderHistory(id: number) {
  const { data } = await apiClient.get<CylinderTransaction[]>(`/cylinders/${id}/history/`);
  return data;
}

// ---- compliance alerts ----
export async function fetchAlerts() {
  const { data } = await apiClient.get<ComplianceAlert[]>('/alerts/');
  return data;
}

// ---- scheduling / feedback ----
export async function fetchScheduledJobs(from: string, to: string) {
  return fetchAllPages<JobRequest>('/jobs/', {
    scheduled_for__gte: from,
    scheduled_for__lte: to,
  });
}

export async function scheduleJob(jobId: number, scheduledFor: string | null) {
  const { data } = await apiClient.patch<JobRequest>(`/jobs/${jobId}/`, { scheduled_for: scheduledFor });
  return data;
}

export async function submitJobFeedback(jobId: number, rating: number, comment: string) {
  const { data } = await apiClient.post<JobFeedback>(`/jobs/${jobId}/feedback/`, { rating, comment });
  return data;
}

// ---- notifications / search / onboarding ----
export async function fetchNotifications() {
  const { data } = await apiClient.get<NotificationsResponse>('/notifications/');
  return data;
}

export async function markNotificationsRead(payload: { ids?: number[]; all?: boolean }) {
  const { data } = await apiClient.post<{ updated: number }>('/notifications/read/', payload);
  return data;
}

export async function fetchPushKey() {
  const { data } = await apiClient.get<PushKeyResponse>('/notifications/push/key/');
  return data;
}

export async function subscribePush(subscription: any) {
  await apiClient.post('/notifications/push/subscribe/', subscription);
}

export async function unsubscribePush(endpoint: string) {
  await apiClient.post('/notifications/push/unsubscribe/', { endpoint });
}

export async function sendTestPush() {
  await apiClient.post('/notifications/push/test/');
}

export async function searchEverything(q: string) {
  const { data } = await apiClient.get<{ results: SearchResult[] }>('/search/', { params: { q } });
  return data.results;
}

export async function fetchOnboarding() {
  const { data } = await apiClient.get<OnboardingChecklist>('/onboarding/');
  return data;
}

// ---- equipment history / printable files ----
export async function fetchEquipmentHistory(id: number) {
  const { data } = await apiClient.get<EquipmentHistory>(`/equipment/${id}/history/`);
  return data;
}