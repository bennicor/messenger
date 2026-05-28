import { http } from '@/api/http';
import type { Chat, CreateDirectChatRequest } from './chatTypes';

export async function getChats(): Promise<Chat[]> {
  const response = await http.get<Chat[]>('/chats');
  return response.data;
}

export async function createDirectChat(request: CreateDirectChatRequest): Promise<Chat> {
  const response = await http.post<Chat>('/chats/direct', request);
  return response.data;
}