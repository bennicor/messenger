export type ChatType = 'DIRECT' | 'GROUP';

export type ChatMember = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Chat = {
  id: string;
  type: ChatType;
  title: string | null;
  members: ChatMember[];
  lastMessage: Message | null;
  firstUnreadMessageId: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateDirectChatRequest = {
  userId: string;
};

export type MessageSender = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Message = {
  id: string;
  chatId: string;
  sender: MessageSender | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type CreateMessageRequest = {
  content: string;
};

export type UpdateMessageRequest = {
  content: string;
};

export type ChatMessageEventType = 'CREATED' | 'UPDATED' | 'DELETED';

export type ChatMessageEvent = {
  type: ChatMessageEventType;
  message: Message;
};

export type TypingEvent = {
  chatId: string;
  userId: string;
  username: string;
  typing: boolean;
};

export type ChatListEventType = 'UPDATED';

export type ChatListEvent = {
  type: ChatListEventType;
  chat: Chat;
};