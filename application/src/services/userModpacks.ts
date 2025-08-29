import { API_ENDPOINT } from "@/consts";
import { Modpack, NewModpackData } from '@/types/modpacks';

// Placeholder for API base URL - replace with actual config if available

// Placeholder for authentication token retrieval
// Replace with actual implementation, e.g., from AuthContext or a store
async function getAuthToken(): Promise<string | null> {
  // Example: const { token } = useAuth(); return token;
  // Example: return localStorage.getItem('authToken');
  // For now, returning null. This needs to be implemented.
  const token = localStorage.getItem('accessToken'); // Assuming token is stored in localStorage
  return token;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.append('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_ENDPOINT}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `API request failed with status ${response.status}`);
  }

  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json() as Promise<T>;
  } else {
    // @ts-ignore // Handling cases where T might be void or text
    return response.text() as Promise<T>;
  }
}

export async function getUserModpacks(): Promise<Modpack[]> {
  const json = await request<{ data: any[] }>('/modpacks', { method: 'GET' });
  return json.data.map(item => item.attributes);
}

export async function createModpack(modpackData: NewModpackData): Promise<Modpack> {
  const json = await request<{ data: any }>('/modpacks', {
    method: 'POST',
    body: JSON.stringify(modpackData),
  });
  return json.data.attributes;
}

// Example of a more specific error type if needed
export class ApiError extends Error {
  constructor(message: string, public status?: number, public field?: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Update request function to throw ApiError for more detailed error handling in components
async function requestWithErrorHandling<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.append('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_ENDPOINT}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(
      errorData.message || `API request failed with status ${response.status}`,
      response.status,
      errorData.field, // Assuming backend might return a 'field' for validation errors
      errorData.errors // Assuming backend might return 'errors' for detailed validation messages
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json() as Promise<T>;
  } else {
    // @ts-ignore
    return response.text() as Promise<T>;
  }
}

// Update service functions to use the new request function
export async function getUserModpacksV2(): Promise<Modpack[]> {
  const json = await requestWithErrorHandling<{ data: any[] }>('/modpacks', { method: 'GET' });
  return json.data.map(item => item.attributes);
}

export async function createModpackV2(modpackData: NewModpackData): Promise<Modpack> {
  const json = await requestWithErrorHandling<{ data: any }>('/modpacks', {
    method: 'POST',
    body: JSON.stringify(modpackData),
  });
  return json.data.attributes;
}
// For clarity, I've added V2 versions. In a real scenario, you'd replace the originals or choose one.
// For this subtask, I'll assume the V2 versions are preferred due to better error handling.
// Let's rename them back to original for the rest of the subtask.

export async function getUserModpacksClean(): Promise<Modpack[]> {
  const json = await requestWithErrorHandling<{ data: any[] }>('/v1/modpacks', { method: 'GET' });
  return json.data.map(item => item.attributes);
}

export async function createModpackClean(modpackData: NewModpackData): Promise<Modpack> {
  const json = await requestWithErrorHandling<{ data: any }>('/v1/modpacks', {
    method: 'POST',
    body: JSON.stringify(modpackData),
  });
  return json.data.attributes;
}

export async function updateModpackClean(modpackId: string, modpackData: Partial<NewModpackData>): Promise<Modpack> {
  const json = await requestWithErrorHandling<{ data: any }>(`/v1/modpacks/${modpackId}`, {
    method: 'PATCH',
    body: JSON.stringify(modpackData),
  });
  return json.data.attributes;
}

export async function deleteModpackClean(modpackId: string): Promise<void> {
  return requestWithErrorHandling<void>(`/v1/modpacks/${modpackId}`, {
    method: 'DELETE',
  });
}

// Renaming back to original names for use in subsequent steps.
// The actual implementation of requestWithErrorHandling will be used.

export {
  updateModpackClean as updateModpack,
  deleteModpackClean as deleteModpack
};

// Assuming ModpackVersion and NewModpackVersionData are imported from '@/types/modpacks'
import { ModpackVersion, NewModpackVersionData } from '@/types/modpacks';

export async function getModpack(modpackId: string): Promise<Modpack> {
  const json = await requestWithErrorHandling<{ data: any }>(`/v1/modpacks/${modpackId}`, { method: 'GET' });
  return json.data.attributes;
}

export async function getModpackVersions(modpackId: string): Promise<ModpackVersion[]> {
  const json = await requestWithErrorHandling<{ data: any[] }>(`/v1/modpacks/${modpackId}/versions`, { method: 'GET' });
  return json.data.map(item => item.attributes);
}

export async function createModpackVersion(modpackId: string, versionData: NewModpackVersionData): Promise<ModpackVersion> {
  const json = await requestWithErrorHandling<{ data: any }>(`/v1/modpacks/${modpackId}/versions`, {
    method: 'POST',
    body: JSON.stringify(versionData),
  });
  return json.data.attributes;
}

// Define a type for the data allowed in version updates, matching backend expectations
export interface UpdateModpackVersionData {
  mcVersion?: string;
  forgeVersion?: string | null;
  changelog?: string;
}

export async function updateModpackVersion(versionId: string, versionData: UpdateModpackVersionData): Promise<ModpackVersion> {
  const json = await requestWithErrorHandling<{ data: any }>(`/v1/versions/${versionId}`, {
    method: 'PATCH',
    body: JSON.stringify(versionData),
  });
  return json.data.attributes;
}

export async function publishModpackVersion(versionId: string): Promise<ModpackVersion> {
  const json = await requestWithErrorHandling<{ data: any }>(`/v1/versions/${versionId}/publish`, {
    method: 'POST', // No body needed, just the action
  });
  return json.data.attributes;
}

/**
 * Upload a file for a modpack version
 * @param versionId The ID of the version to upload the file for
 * @param file The file to upload
 * @param fileType The type of file being uploaded (mods, configs, resources)
 * @returns The updated ModpackVersion object
 */
export async function uploadModpackVersionFile(versionId: string, file: File, fileType: string = 'mods'): Promise<ModpackVersion> {
  const formData = new FormData();
  
  // Set the endpoint and field name based on the file type
  let endpoint = `/v1/versions/${versionId}/file`;
  let fieldName = 'versionFile';
  
  if (fileType === 'config') {
    endpoint = `/v1/versions/${versionId}/config`;
    fieldName = 'configFile';
  } else if (fileType === 'resourcepacks') {
    endpoint = `/v1/versions/${versionId}/resourcepacks`;
    fieldName = 'resourcepacksFile';
  } else if (fileType === 'shaderpacks') {
    endpoint = `/v1/versions/${versionId}/shaderpacks`;
    fieldName = 'shaderpacksFile';
  } else if (fileType === 'extras') {
    endpoint = `/v1/versions/${versionId}/extras`;
    fieldName = 'extrasFile';
  }
  
  formData.append(fieldName, file);
  
  const json = await requestWithErrorHandling<{ data: any }>(endpoint, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header, let the browser set it with the boundary
  });
  
  return json.data.attributes;
}
