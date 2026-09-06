import { apiRequest } from "./api";
import { listApplications, listUnreadReplies, getApplication, type Application } from "./applicationsService";

// The backend doesn't expose a single generic "inbox" endpoint yet — an
// email thread in JobJet is always attached to an application. This module
// reshapes that data into a plain inbox list (sender / subject / snippet /
// unread) so the UI can render it exactly like a normal mail app.

export type InboxItem = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  status: string;
};

export async function listInbox(): Promise<InboxItem[]> {
  const [{ applications }, { replies }] = await Promise.all([listApplications(), listUnreadReplies()]);

  const unreadByApp = new Set(replies.map((r: any) => r.application_id));

  return applications
    .filter((app: Application) => app.status !== "draft")
    .map((app: Application) => {
      const reply = replies.find((r: any) => r.application_id === app.id);
      return {
        id: app.id,
        sender: app.company_name || "Unknown company",
        subject: app.subject || app.job_title || "Application update",
        snippet: (reply?.body || app.body || "No message content yet.").replace(/\s+/g, " ").trim(),
        date: app.updated_at,
        unread: unreadByApp.has(app.id),
        status: app.status,
      };
    })
    .sort((a, b) => Number(b.unread) - Number(a.unread));
}

export function getThread(applicationId: string) {
  return getApplication(applicationId);
}

// Connects to the user's inbox via IMAP (using the SMTP credentials already
// saved in Settings) and pulls in any new replies from companies that were
// emailed. Safe to call often - already-seen messages are skipped server-side.
export function checkReplies() {
  return apiRequest<{ success: boolean; newReplies: number }>("/api/email/replies/check", {
    method: "POST",
  });
}
