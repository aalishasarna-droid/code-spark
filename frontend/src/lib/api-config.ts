/**
 * API Configuration for MCP-IDE Frontend
 * Uses environment variable or falls back to localhost for development
 */

// Get API URL from environment or use localhost for development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper function to build API URLs
export const getApiUrl = (path: string): string => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// Export commonly used endpoints
export const API_ENDPOINTS = {
  // Tutor endpoints
  tutorAsk: () => getApiUrl('/api/v1/tutor/ask'),
  tutorModels: () => getApiUrl('/api/v1/tutor/models'),
  tutorSessionStart: () => getApiUrl('/api/v1/tutor/session/start'),
  tutorSessionUpdateContext: () => getApiUrl('/api/v1/tutor/session/update-context'),
  
  // File endpoints
  filesProjects: () => getApiUrl('/api/v1/files/projects'),
  filesProjectFiles: (projectId: string) => getApiUrl(`/api/v1/files/projects/${projectId}/files`),
  filesCreate: () => getApiUrl('/api/v1/files/files'),
  filesGet: (fileId: string) => getApiUrl(`/api/v1/files/files/${fileId}`),
  filesUpdate: (fileId: string) => getApiUrl(`/api/v1/files/files/${fileId}`),
  filesDelete: (fileId: string) => getApiUrl(`/api/v1/files/files/${fileId}`),
  filesActivate: (fileId: string, projectId: string) => 
    getApiUrl(`/api/v1/files/files/${fileId}/activate?project_id=${projectId}`),
  
  // Executor endpoints
  executorRun: () => getApiUrl('/api/v1/executor/run'),
  
  // Terminal endpoints
  terminalCreate: () => getApiUrl('/api/v1/terminal/create'),
  terminalExecute: (sessionId: string) => getApiUrl(`/api/v1/terminal/${sessionId}/execute`),
  
  // Smart Assistant (Agent) endpoints
  agentFixError: () => getApiUrl('/api/v1/agent/fix-error'),
  agentEdit: () => getApiUrl('/api/v1/agent/edit'),
  agentCreate: () => getApiUrl('/api/v1/agent/create'),
  agentApply: () => getApiUrl('/api/v1/agent/apply'),
  agentStatus: () => getApiUrl('/api/v1/agent/status'),

  // Knowledge Hub endpoints
  knowledgeUpload: () => getApiUrl('/api/v1/knowledge/upload'),
  knowledgeDocuments: (projectId?: string) => getApiUrl(`/api/v1/knowledge/documents${projectId ? `?project_id=${projectId}` : ''}`),
  knowledgeDocumentDelete: (id: string) => getApiUrl(`/api/v1/knowledge/documents/${id}`),
  knowledgeSearch: () => getApiUrl('/api/v1/knowledge/search'),
  knowledgeChat: () => getApiUrl('/api/v1/knowledge/chat'),
  knowledgeHealth: () => getApiUrl('/api/v1/knowledge/health'),
};
