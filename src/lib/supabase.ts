import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(window.location.origin);
  }
  return socket;
};

// Mock Supabase interface to minimize frontend changes during migration
export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        return { data: res.data, error: null };
      } catch (error: any) {
        return { data: null, error: error.response?.data || error };
      }
    },
    signUp: async ({ email, password, options }: any) => {
      try {
        const res = await api.post('/auth/register', { email, password, ...options?.data });
        localStorage.setItem('token', res.data.token);
        return { data: res.data, error: null };
      } catch (error: any) {
        return { data: null, error: error.response?.data || error };
      }
    },
    signOut: async () => {
      localStorage.removeItem('token');
      return { error: null };
    },
    getSession: async () => {
      const token = localStorage.getItem('token');
      return { data: { session: token ? { access_token: token } : null }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  },
  from: (table: string) => ({
    select: (query?: string) => {
      return {
        eq: async (column: string, value: any) => {
          // This is a very simplified mock. In a real migration, you'd replace all supabase.from() calls with api.get() calls.
          try {
            const res = await api.get(`/${table}?${column}=${value}`);
            return { data: res.data, error: null };
          } catch (error: any) {
            return { data: null, error: error.response?.data || error };
          }
        },
        order: async (column: string, options?: any) => {
          try {
            const res = await api.get(`/${table}?orderBy=${column}&ascending=${options?.ascending !== false}`);
            return { data: res.data, error: null };
          } catch (error: any) {
            return { data: null, error: error.response?.data || error };
          }
        },
        single: async () => {
           try {
            const res = await api.get(`/${table}`);
            return { data: res.data[0] || null, error: null };
          } catch (error: any) {
            return { data: null, error: error.response?.data || error };
          }
        },
        then: async (resolve: any, reject: any) => {
           try {
            const res = await api.get(`/${table}`);
            resolve({ data: res.data, error: null });
          } catch (error: any) {
            resolve({ data: null, error: error.response?.data || error });
          }
        }
      };
    },
    insert: (data: any) => {
      return {
        select: () => {
          return {
            single: async () => {
              try {
                const res = await api.post(`/${table}`, data);
                return { data: res.data, error: null };
              } catch (error: any) {
                return { data: null, error: error.response?.data || error };
              }
            }
          }
        },
        then: async (resolve: any) => {
           try {
            const res = await api.post(`/${table}`, data);
            resolve({ data: res.data, error: null });
          } catch (error: any) {
            resolve({ data: null, error: error.response?.data || error });
          }
        }
      };
    },
    update: (data: any) => {
      return {
        eq: async (column: string, value: any) => {
           try {
            const res = await api.patch(`/${table}/${value}`, data);
            return { data: res.data, error: null };
          } catch (error: any) {
            return { data: null, error: error.response?.data || error };
          }
        }
      };
    },
    delete: () => {
      return {
        eq: async (column: string, value: any) => {
           try {
            const res = await api.delete(`/${table}/${value}`);
            return { data: res.data, error: null };
          } catch (error: any) {
            return { data: null, error: error.response?.data || error };
          }
        }
      };
    }
  }),
  channel: (name: string) => {
    const s = getSocket();
    return {
      on: (event: string, filter: any, callback: any) => {
        // Mocking postgres_changes with socket.io events
        if (event === 'postgres_changes') {
           if (filter.table === 'orders') {
             s.on('order-updated', (data) => callback({ new: data, old: {} }));
             s.on('new-order', (data) => callback({ new: data, old: {} }));
           }
           if (filter.table === 'tables') {
             s.on('table-updated', (data) => callback({ new: data, old: {} }));
           }
        }
        return {
          on: (e: string, f: any, cb: any) => supabase.channel(name).on(e, f, cb),
          subscribe: () => {}
        };
      },
      subscribe: () => {}
    };
  },
  removeChannel: (channel: any) => {
    // Cleanup socket listeners if needed
  }
};
