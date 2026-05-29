import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Projects
export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}

export async function createProject(title: string) {
  const res = await api.post('/projects', { title });
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

// AI
export async function aiGenerate(
  projectId: string,
  context: any,
  instruction: string,
  promptTemplate?: string
) {
  const res = await api.post('/ai/generate', {
    project_id: projectId,
    context,
    instruction,
    prompt_template: promptTemplate || undefined,
  });
  return res.data;
}

export default api;
