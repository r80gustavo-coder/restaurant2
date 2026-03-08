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
  rpc: async (name: string, params: any) => {
    try {
      const res = await api.post(`/rpc/${name}`, params);
      return { data: res.data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error };
    }
  },
  from: (table: string) => {
    const chain: any = {
      select: (query?: string) => chain,
      eq: (column: string, value: any) => chain,
      neq: (column: string, value: any) => chain,
      in: (column: string, values: any[]) => chain,
      not: (column: string, operator: string, value: any) => chain,
      order: (column: string, options?: any) => chain,
      limit: (count: number) => chain,
      single: () => chain,
      insert: (data: any) => chain,
      update: (data: any) => chain,
      delete: () => chain,
      then: async (resolve: any, reject: any) => {
        try {
          // In a real implementation, we would build the query string based on the chain methods
          const res = await api.get(`/${table}`);
          if (resolve) resolve({ data: res.data, error: null });
          return { data: res.data, error: null };
        } catch (error: any) {
          if (resolve) resolve({ data: null, error: error.response?.data || error });
          return { data: null, error: error.response?.data || error };
        }
      }
    };

    // Override some methods to actually perform actions if they are terminal
    chain.single = async () => {
      try {
        const res = await api.get(`/${table}`);
        return { data: res.data[0] || null, error: null };
      } catch (error: any) {
        return { data: null, error: error.response?.data || error };
      }
    };

    chain.eq = (column: string, value: any) => {
      const originalThen = chain.then;
      chain.then = async (resolve: any) => {
        try {
          const res = await api.get(`/${table}?${column}=${value}`);
          if (resolve) resolve({ data: res.data, error: null });
          return { data: res.data, error: null };
        } catch (error: any) {
          if (resolve) resolve({ data: null, error: error.response?.data || error });
          return { data: null, error: error.response?.data || error };
        }
      };
      return chain;
    };

    chain.insert = (data: any) => {
      chain.then = async (resolve: any) => {
        try {
          const res = await api.post(`/${table}`, data);
          if (resolve) resolve({ data: res.data, error: null });
          return { data: res.data, error: null };
        } catch (error: any) {
          if (resolve) resolve({ data: null, error: error.response?.data || error });
          return { data: null, error: error.response?.data || error };
        }
      };
      return chain;
    };

    chain.update = (data: any) => {
      const originalEq = chain.eq;
      chain.eq = (column: string, value: any) => {
        chain.then = async (resolve: any) => {
          try {
            const res = await api.patch(`/${table}/${value}`, data);
            if (resolve) resolve({ data: res.data, error: null });
            return { data: res.data, error: null };
          } catch (error: any) {
            if (resolve) resolve({ data: null, error: error.response?.data || error });
            return { data: null, error: error.response?.data || error };
          }
        };
        return chain;
      };
      return chain;
    };

    chain.delete = () => {
      chain.eq = (column: string, value: any) => {
        chain.then = async (resolve: any) => {
          try {
            const res = await api.delete(`/${table}/${value}`);
            if (resolve) resolve({ data: res.data, error: null });
            return { data: res.data, error: null };
          } catch (error: any) {
            if (resolve) resolve({ data: null, error: error.response?.data || error });
            return { data: null, error: error.response?.data || error };
          }
        };
        return chain;
      };
      return chain;
    };

    return chain;
  },
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
          subscribe: (cb?: any) => { if (cb) cb('SUBSCRIBED'); }
        };
      },
      subscribe: (cb?: any) => { if (cb) cb('SUBSCRIBED'); }
    };
  },
  removeChannel: (channel: any) => {
    // Cleanup socket listeners if needed
  }
};
