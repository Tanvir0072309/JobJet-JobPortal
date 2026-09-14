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
  company_website: string | null;
  company_location?: string | null;
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

// Today's send count vs the daily cap (see backend env.dailyEmailLimitPerUser,
// currently 25/day) - shown on the Profile screen.
export type SendingLimitStatus = { success: boolean; sentToday: number; limit: number; remaining: number };
export function getSendingLimitStatus() {
  return apiRequest<SendingLimitStatus>("/api/applications/sending-limit");
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

// One request no matter how many companies are selected - the email finder/Groq are
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

// Manual "Send Email" composer (To/From/Write message) - a one-off email
// sent through the connected Gmail account, independent of the AI-apply
// pipeline. Shows up in the inbox afterwards just like an AI-sent one.
export function sendManualEmail(payload: { to: string; subject?: string; body: string; documentIds?: string[] }) {
  return apiRequest<{ success: boolean; application: Application }>("/api/applications/compose-send", {
    method: "POST",
    body: payload,
  });
}

// Auto-drafts a message body from just the subject line, used by the
// manual "Send Email" screen's 3-second "stopped typing the subject" timer.
export function draftMessageFromSubject(subject: string) {
  return apiRequest<{ success: boolean; body: string }>("/api/applications/draft-message", {
    method: "POST",
    body: { subject },
  });
}

export function listUnreadReplies() {
  return apiRequest<{ success: boolean; replies: any[] }>("/api/email/replies/unread");
}

export function markThreadRead(applicationId: string) {
  return apiRequest(`/api/email/replies/${applicationId}/read`, { method: "PATCH" });
}
