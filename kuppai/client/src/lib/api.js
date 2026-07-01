import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('kuppai_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;
