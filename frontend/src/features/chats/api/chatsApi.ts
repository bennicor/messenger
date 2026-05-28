import { http } from '@/api/http';
import type {
  Chat,
  CreateDirectChatRequest,
  CreateMessageRequest,
  Message,
  UpdateMessageRequest
} from './chatTypes';

export async function getChats(): Promise<Chat[]> {
  const response = await http.get<Chat[]>('/chats');
  return response.data;
}

export async function createDirectChat(request: CreateDirectChatRequest): Promise<Chat> {
  const response = await http.post<Chat>('/chats/direct', request);
  return response.data;
}

export async function getMessages(
  chatId: string,
  before?: string
): Promise<Message[]> {
  const response = await http.get<Message[]>(`/chats/${chatId}/messages`, {
    params: {
      limit: 30,
      before
    }
  });

  return response.data;
}

export async function createMessage(chatId: string, request: CreateMessageRequest): Promise<Message> {
  const response = await http.post<Message>(`/chats/${chatId}/messages`, request);
  return response.data;
}

export async function updateMessage(
  chatId: string,
  messageId: string,
  request: UpdateMessageRequest
): Promise<Message> {
  const response = await http.patch<Message>(`/chats/${chatId}/messages/${messageId}`, request);
  return response.data;
}

export async function deleteMessage(chatId: string, messageId: string): Promise<Message> {
  const response = await http.delete<Message>(`/chats/${chatId}/messages/${messageId}`);
  return response.data;
}

export async function markChatAsRead(chatId: string): Promise<Chat> {
  const response = await http.post<Chat>(`/chats/${chatId}/read`);
  return response.data;
}