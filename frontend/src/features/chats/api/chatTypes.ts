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
  createdAt: string;
  updatedAt: string;
};

export type CreateDirectChatRequest = {
  userId: string;
};