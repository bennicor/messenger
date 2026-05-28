import { http } from '@/api/http';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './authTypes';

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const response = await http.post<AuthResponse>('/auth/register', request);
  return response.data;
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await http.post<AuthResponse>('/auth/login', request);
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await http.get<User>('/users/me');
  return response.data;
}