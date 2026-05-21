import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh/', { refresh });
          localStorage.setItem('access_token', data.access);
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return API(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (credentials) => API.post('/auth/login/', credentials),
  register: (data) => API.post('/auth/register/', data),
  profile: () => API.get('/auth/profile/'),
};

// Documents
export const documentsAPI = {
  list: () => API.get('/documents/'),
  upload: (formData) =>
    API.post('/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  get: (id) => API.get(`/documents/${id}/`),
  delete: (id) => API.delete(`/documents/${id}/`),
};

// Websites
export const websitesAPI = {
  list: () => API.get('/websites/'),
  submit: (data) => API.post('/websites/', data),
  get: (id) => API.get(`/websites/${id}/`),
  rescrape: (id) => API.post(`/websites/${id}/rescrape/`),
  delete: (id) => API.delete(`/websites/${id}/`),
  pages: (id) => API.get(`/websites/${id}/pages/`),
};

// Chat
export const chatAPI = {
  listConversations: () => API.get('/chat/conversations/'),
  createConversation: (data) => API.post('/chat/conversations/', data),
  getConversation: (id) => API.get(`/chat/conversations/${id}/`),
  deleteConversation: (id) => API.delete(`/chat/conversations/${id}/`),
  ask: (conversationId, data) =>
    API.post(`/chat/conversations/${conversationId}/ask/`, data),
};

export default API;
