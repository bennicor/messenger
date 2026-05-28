import { http } from '@/api/http';
import type { Chat, CreateDirectChatRequest, CreateMessageRequest, Message } from './chatTypes';

export async function getChats(): Promise<Chat[]> {
  const response = await http.get<Chat[]>('/chats');
  return response.data;
}

export async function createDirectChat(request: CreateDirectChatRequest): Promise<Chat> {
  const response = await http.post<Chat>('/chats/direct', request);
  return response.data;
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const response = await http.get<Message[]>(`/chats/${chatId}/messages`);
  return response.data;
}

export async function createMessage(chatId: string, request: CreateMessageRequest): Promise<Message> {
  const response = await http.post<Message>(`/chats/${chatId}/messages`, request);
  return response.data;
}