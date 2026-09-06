import { apiRequest } from "./api";

export type ApplicationSummary = {
  total: number;
  sent: number;
  replied: number;
  interview: number;
  rejected: number;
};

export type Application = {
  id: string;
  company_id: string | null;
  job_id: string | null;
  company_name: string | null;
  job_title: string | null;
  recipient_email: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  has_unread_reply: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getSummary() {
  return apiRequest<{ success: boolean; summary: ApplicationSummary }>("/api/applications/summary");
}

export function listApplications() {
  return apiRequest<{ success: boolean; applications: Application[] }>("/api/applications");
}

export function getApplication(id: string) {
  return apiRequest<{ success: boolean; application: Application; thread: any[] }>(
    `/api/applications/${id}`
  );
}

export function createApplication(payload: {
  companyId: string;
  jobId?: string;
  recipientEmail?: string;
}) {
  return apiRequest<{ success: boolean; application: Application }>("/api/applications", {
    method: "POST",
    body: payload,
  });
}

export function updateApplicationStatus(id: string, status: string) {
  return apiRequest<{ success: boolean; application: Application }>(`/api/applications/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export type ApplyResult = {
  companyId: string;
  company?: string;
  status: "sent" | "generated" | "skipped" | "error";
  to?: string;
  message?: string;
};

export function generateWithAI(companyIds: string[]) {
  return apiRequest<{ success: boolean; results: ApplyResult[] }>("/api/applications/generate", {
    method: "POST",
    body: { companyIds },
  });
}

// One request no matter how many companies are selected - Hunter/Groq are
// each called at most once per company inside this single call.
export function applyToCompanies(companyIds: string[]) {
  return apiRequest<{ success: boolean; results: ApplyResult[] }>("/api/applications/apply", {
    method: "POST",
    body: { companyIds },
  });
}

export function sendApplication(id: string) {
  return apiRequest(`/api/applications/${id}/send`, { method: "POST" });
}

export function listUnreadReplies() {
  return apiRequest<{ success: boolean; replies: any[] }>("/api/email/replies/unread");
}

export function markThreadRead(applicationId: string) {
  return apiRequest(`/api/email/replies/${applicationId}/read`, { method: "PATCH" });
}
