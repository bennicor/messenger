import { create } from 'zustand';
import type { User } from '@/features/auth/authTypes';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, user: User) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
};

const storedToken = localStorage.getItem('accessToken');

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: storedToken,
  isAuthenticated: Boolean(storedToken),

  setAuth: (accessToken, user) => {
    localStorage.setItem('accessToken', accessToken);

    set({
      accessToken,
      user,
      isAuthenticated: true
    });
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: Boolean(user)
    });
  },

  logout: () => {
    localStorage.removeItem('accessToken');

    set({
      accessToken: null,
      user: null,
      isAuthenticated: false
    });
  }
}));