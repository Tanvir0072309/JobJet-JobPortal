import { apiRequest } from "./api";

export type DocumentItem = {
  id: string;
  name: string;
  document_type: string;
  file_type: string;
  file_size_bytes: number;
  is_default: boolean;
  // Which interested post (e.g. "Backend Developer") this specific
  // resume/project-list was tagged for on the Profile screen. null/undefined
  // means it's the general/default document for its document_type.
  post_tag?: string | null;
  created_at: string;
  updated_at: string;
};

export function listDocuments() {
  return apiRequest<{ success: boolean; documents: DocumentItem[] }>("/api/documents");
}

export function uploadDocument(form: FormData) {
  return apiRequest<{ success: boolean; document: DocumentItem }>("/api/documents", {
    method: "POST",
    body: form,
    isFormData: true,
  });
}

export function deleteDocument(id: string) {
  return apiRequest<{ success: boolean; message: string }>(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export function setDefaultDocument(id: string) {
  return apiRequest<{ success: boolean; message: string }>(`/api/documents/${id}/default`, {
    method: "PATCH",
  });
}
