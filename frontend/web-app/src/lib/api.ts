import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor: add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    org_name: string;
  }) => api.post('/api/v1/auth/register', data),
  me: () => api.get('/api/v1/auth/me'),
  logout: () => api.post('/api/v1/auth/logout'),
};

// Projects API
export const projectsApi = {
  list: () => api.get('/api/v1/projects'),
  get: (id: string) => api.get('/api/v1/projects/' + id),
  create: (data: any) => api.post('/api/v1/projects', data),
  update: (id: string, data: any) => api.put('/api/v1/projects/' + id, data),
  delete: (id: string) => api.delete('/api/v1/projects/' + id),
  getBacklog: (id: string, params?: any) =>
    api.get('/api/v1/projects/' + id + '/backlog', { params }),
  createBacklogItem: (id: string, data: any) =>
    api.post('/api/v1/projects/' + id + '/backlog', data),
  updateBacklogItem: (id: string, itemId: string, data: any) =>
    api.put('/api/v1/projects/' + id + '/backlog/' + itemId, data),
  generateBacklog: (id: string) =>
    api.post('/api/v1/projects/' + id + '/backlog/generate', {}),
  getSprints: (id: string) => api.get('/api/v1/projects/' + id + '/sprints'),
  createSprint: (id: string, data: any) =>
    api.post('/api/v1/projects/' + id + '/sprints', data),
  planSprint: (id: string, data: any) =>
    api.post('/api/v1/projects/' + id + '/sprints/plan', data),
  getTraceability: (id: string) =>
    api.get('/api/v1/projects/' + id + '/traceability'),
};

// Requirements API
export const requirementsApi = {
  list: (projectId: string) =>
    api.get('/api/v1/requirements', { params: { project_id: projectId } }),
  create: (data: any) => api.post('/api/v1/requirements', data),
  update: (id: string, data: any) =>
    api.put('/api/v1/requirements/' + id, data),
  delete: (id: string) => api.delete('/api/v1/requirements/' + id),
  approve: (id: string) =>
    api.post('/api/v1/requirements/' + id + '/approve', {}),
  fromText: (text: string, projectId: string) =>
    api.post('/api/v1/requirements/from-text', {
      text,
      project_id: projectId,
    }),
  analyzeConflicts: (projectId: string) =>
    api.post('/api/v1/requirements/analyze-conflicts', {
      project_id: projectId,
    }),
};

// Design API
export const designApi = {
  recommendTechStack: (data: any) =>
    api.post('/api/v1/design/tech-stack/recommend', data),
  generateArchitecture: (data: any) =>
    api.post('/api/v1/design/architecture/generate', data),
  generateApiContract: (data: any) =>
    api.post('/api/v1/design/api-contract/generate', data),
  generateDbSchema: (data: any) =>
    api.post('/api/v1/design/database-schema/generate', data),
  review: (data: any) => api.post('/api/v1/design/review', data),
  getArtifacts: (projectId: string) =>
    api.get('/api/v1/design/artifacts/' + projectId),
};

// AI Orchestration API
export const aiApi = {
  listJobs: (projectId: string) =>
    api.get('/api/v1/ai/jobs', { params: { project_id: projectId } }),
  getJob: (id: string) => api.get('/api/v1/ai/jobs/' + id),
  triggerApix: (data: any) => api.post('/api/v1/ai/apix/trigger', data),
  triggerUix: (data: any) => api.post('/api/v1/ai/uix/trigger', data),
  triggerIntegrationX: (data: any) =>
    api.post('/api/v1/ai/integrationx/trigger', data),
  triggerMobile: (data: any) => api.post('/api/v1/ai/mobile/trigger', data),
  getStats: (projectId: string) =>
    api.get('/api/v1/ai/stats/' + projectId),
};

// Test Management API
export const testApi = {
  listCases: (projectId: string) =>
    api.get('/api/v1/tests/cases', { params: { project_id: projectId } }),
  generateTests: (data: any) => api.post('/api/v1/tests/generate', data),
  executeTests: (data: any) => api.post('/api/v1/tests/execute', data),
  listRuns: (projectId: string) =>
    api.get('/api/v1/tests/runs', { params: { project_id: projectId } }),
  getCoverage: (projectId: string) =>
    api.get('/api/v1/tests/coverage/' + projectId),
};

// DevOps API
export const devopsApi = {
  listPipelines: (projectId: string) =>
    api.get('/api/v1/devops/pipelines', { params: { project_id: projectId } }),
  createPipeline: (data: any) => api.post('/api/v1/devops/pipelines', data),
  runPipeline: (pipelineId: string) =>
    api.post('/api/v1/devops/pipelines/' + pipelineId + '/run', {}),
  listDeployments: (projectId: string) =>
    api.get('/api/v1/devops/deployments', {
      params: { project_id: projectId },
    }),
  createDeployment: (data: any) =>
    api.post('/api/v1/devops/deployments', data),
  rollback: (depId: string) =>
    api.post('/api/v1/devops/deployments/' + depId + '/rollback', {}),
  getReleaseNotes: (projectId: string) =>
    api.get('/api/v1/devops/releases/' + projectId + '/notes'),
};

// MEE API
export const meeApi = {
  getActivityFeed: (params?: any) =>
    api.get('/api/v1/mee/activity-feed', { params }),
  getEvidence: (projectId: string) =>
    api.get('/api/v1/mee/evidence/' + projectId),
  getMetrics: (params?: any) =>
    api.get('/api/v1/mee/metrics', { params }),
  getAnomalies: (params?: any) =>
    api.get('/api/v1/mee/anomalies', { params }),
  logEvent: (data: any) => api.post('/api/v1/mee/events', data),
  getComparison: (projectId: string) =>
    api.get('/api/v1/mee/comparison/' + projectId),
};

// Analytics API
export const analyticsApi = {
  getDashboard: (projectId: string) =>
    api.get('/api/v1/analytics/dashboard/' + projectId),
  getKpis: (projectId: string) =>
    api.get('/api/v1/analytics/kpis/' + projectId),
  getVelocity: (projectId: string) =>
    api.get('/api/v1/analytics/velocity/' + projectId),
  getBurndown: (sprintId: string) =>
    api.get('/api/v1/analytics/burndown/' + sprintId),
  getPlatformSummary: () => api.get('/api/v1/analytics/platform-summary'),
  getSdlcProgress: (projectId: string) =>
    api.get('/api/v1/analytics/sdlc-progress/' + projectId),
};

// Agents API
export const agentsApi = {
  list: () => api.get('/api/v1/agents'),
  create: (data: any) => api.post('/api/v1/agents', data),
  generate: (data: any) => api.post('/api/v1/agents/generate', data),
  deploy: (id: string) => api.post('/api/v1/agents/' + id + '/deploy', {}),
  test: (id: string) => api.post('/api/v1/agents/' + id + '/test', {}),
  getRegistry: () => api.get('/api/v1/agents/registry'),
};

// Legacy API
export const legacyApi = {
  listJobs: (projectId?: string) =>
    api.get('/api/v1/legacy/jobs', {
      params: projectId ? { project_id: projectId } : {},
    }),
  ingest: (data: any) => api.post('/api/v1/legacy/ingest', data),
  convert: (data: any) => api.post('/api/v1/legacy/convert', data),
  getJob: (id: string) => api.get('/api/v1/legacy/jobs/' + id),
  getReport: (id: string) =>
    api.get('/api/v1/legacy/jobs/' + id + '/report'),
  getSupportedLanguages: () =>
    api.get('/api/v1/legacy/supported-languages'),
};

// Extraction API
export const extractionApi = {
  analyze: (data: any) => api.post('/api/v1/extraction/analyze', data),
  getBrd: (projectId: string) =>
    api.get('/api/v1/extraction/brd/' + projectId),
  getProcessFlows: (projectId: string) =>
    api.get('/api/v1/extraction/process-flows/' + projectId),
  getWiki: (projectId: string) =>
    api.get('/api/v1/extraction/wiki/' + projectId),
  getReport: (projectId: string) =>
    api.get('/api/v1/extraction/report/' + projectId),
};

export default api;
