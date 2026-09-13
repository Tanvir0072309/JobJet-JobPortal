import { apiRequest } from "./api";
import { API_BASE_URL } from "../constants/config";
import { getAuthToken } from "./api";

// avatar_url is stored as a relative path ("/uploads/avatars/xxx.jpg") -
// this turns it into a full, loadable URL against the current API host.
export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${API_BASE_URL}${avatarUrl}`;
}

export function getProfile() {
  return apiRequest<{ success: boolean; profile: any }>("/api/profile");
}

export function updateProfile(payload: Record<string, any>) {
  return apiRequest<{ success: boolean; profile: any }>("/api/profile", {
    method: "PUT",
    body: payload,
  });
}

export function listDocuments() {
  return apiRequest<{ success: boolean; documents: any[] }>("/api/documents");
}

export function deleteDocument(id: string) {
  return apiRequest(`/api/documents/${id}`, { method: "DELETE" });
}

export function setDefaultDocument(id: string) {
  return apiRequest(`/api/documents/${id}/default`, { method: "PATCH" });
}

// Uploads/replaces the profile picture. Same manual multipart-body
// construction as uploadDocument below, since the file comes from
// expo-image-picker as a { uri, name, mimeType } object.
export async function uploadAvatar(file: { uri: string; name: string; mimeType?: string }) {
  const formData = new FormData();
  formData.append("avatar", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "image/jpeg",
  } as any);

  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Couldn't update your profile picture.");
  }
  return data as { success: boolean; avatar_url: string };
}

// Android's content-provider file picker frequently returns an empty or
// generic mimeType even for a perfectly valid file - guess from the
// extension so the backend's format check (which also has its own
// extension fallback) has the best chance of seeing something concrete.
const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function resolveMimeType(name: string, mimeType?: string) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_TO_MIME[ext] || mimeType || "application/octet-stream";
}

// multer expects real multipart/form-data - built manually here since the
// file comes from expo-document-picker as a { uri, name, mimeType } object,
// not a browser File instance.
export async function uploadDocument(
  file: { uri: string; name: string; mimeType?: string },
  documentType: string,
  postTag?: string
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: resolveMimeType(file.name, file.mimeType),
  } as any);
  formData.append("document_type", documentType);
  formData.append("name", file.name);
  if (postTag) formData.append("post_tag", postTag);

  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Upload failed.");
  }
  return data;
}
