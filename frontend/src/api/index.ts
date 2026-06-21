import axios from 'axios';

// Use env var if set (for deployed server), otherwise default to relative path (works with Vite proxy or nginx)
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Auth token management ---

const TOKEN_KEY = 'script_platform_token';
const USER_KEY = 'script_platform_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): { username: string; displayName: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: { username: string; displayName: string }): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      // Dispatch custom event so App.tsx can show login
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

// --- Auth ---

export async function login(username: string, password: string) {
  const res = await api.post('/auth/login', { username, password });
  return res.data; // { token, username, displayName }
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data; // { username, displayName }
}

// --- Projects ---

export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}

export async function createProject(title: string) {
  const res = await api.post('/projects', { title });
  return res.data;
}

export async function importProject(data: any) {
  const res = await api.post('/projects/import', { data });
  return res.data;
}

export async function getProject(projectId: string) {
  const res = await api.get(`/projects/${projectId}`);
  return res.data;
}

export async function updateProject(projectId: string, data: any) {
  const res = await api.put(`/projects/${projectId}`, data);
  return res.data;
}

export async function patchProject(projectId: string, data: any) {
  const res = await api.patch(`/projects/${projectId}`, data);
  return res.data;
}

export async function deleteProject(projectId: string) {
  const res = await api.delete(`/projects/${projectId}`);
  return res.data;
}

// --- AI ---

export async function aiGenerate(
  projectId: string,
  context: any,
  instruction: string,
  promptTemplate?: string,
) {
  const res = await api.post('/ai/generate', {
    project_id: projectId,
    context,
    instruction,
    prompt_template: promptTemplate || undefined,
  });
  return res.data;
}

export async function getAIHistory(projectId: string) {
  const res = await api.get(`/ai/history/${projectId}`);
  return res.data;
}

export async function aiFillField(data: {
  project_id: string;
  field_name: string;
  existing_content: string;
  node_type: string;
}) {
  const res = await api.post('/ai/fill-field', data);
  return res.data;
}

// ========================================
//  Game API
// ========================================

export async function listScripts(params?: {
  page?: number;
  pageSize?: number;
  tag?: string;
  sort?: 'hot' | 'new' | 'rating';
  keyword?: string;
}) {
  const res = await api.get('/game/scripts', { params });
  return res.data;
}

export async function getScriptDetail(scriptId: string) {
  const res = await api.get(`/game/scripts/${scriptId}`);
  return res.data;
}

export async function getScriptCover(scriptId: string) {
  const res = await api.get(`/game/scripts/${scriptId}/cover`);
  return res.data;
}

export async function publishScript(projectId: string) {
  const res = await api.post('/game/scripts', { projectId });
  return res.data;
}

export async function createGameRoom(data: {
  mode: 'script' | 'sandbox' | 'import' | 'create';
  scriptId?: string;
  editorJson?: any;
  worldview?: string;
  rolePrefs?: string;
  totalRounds?: number;
}) {
  const res = await api.post('/game/rooms', data);
  return res.data;
}

export async function getRoomStatus(roomId: string) {
  const res = await api.get(`/game/rooms/${roomId}`);
  return res.data;
}

export async function joinRoomApi(roomId: string, nickname: string) {
  const res = await api.post(`/game/rooms/${roomId}/join`, { nickname });
  return res.data;
}

export async function importRoom(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post('/game/rooms/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
}

export default api;
