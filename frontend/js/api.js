/* Central API helper. Update API_BASE if your backend runs elsewhere. */
const API_BASE = 'http://localhost:5000/api';
const Api = {
  token(){ return localStorage.getItem('library_token'); },
  async request(path, options = {}) {
    const headers = { 'Content-Type':'application/json', ...(options.headers || {}) };
    if (this.token()) headers.Authorization = `Bearer ${this.token()}`;
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (_) {
      throw new Error('Cannot connect to backend. Start the backend server on port 5000.');
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') {
      Auth.logout(false);
      throw new Error(data.message || 'Your session expired. Please sign in again.');
    }
    if (!response.ok || data.success === false) {
      const validation = data.errors?.map(e => e.msg).join(', ');
      throw new Error(data.message || validation || `Request failed (${response.status})`);
    }
    return data;
  },
  get(path){ return this.request(path); },
  post(path, body){ return this.request(path,{method:'POST',body:JSON.stringify(body)}); },
  put(path, body){ return this.request(path,{method:'PUT',body:JSON.stringify(body)}); },
  delete(path){ return this.request(path,{method:'DELETE'}); }
};
window.Api = Api;
