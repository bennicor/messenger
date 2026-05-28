import { http } from '@/api/http';
import type { UserSummary } from './authTypes';

export async function getUsers(search: string): Promise<UserSummary[]> {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return [];
  }

  const response = await http.get<UserSummary[]>('/users', {
    params: {
      search: trimmedSearch
    }
  });

  return response.data;
}