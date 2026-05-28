import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { IMessage } from '@stomp/stompjs';
import type { Client } from '@stomp/stompjs';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { getMe } from '@/features/auth/authApi';
import { getUsers } from '@/features/auth/usersApi';
import type { UserSummary } from '@/features/auth/authTypes';
import { createRealtimeClient } from '@/features/chats/api/realtimeClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';
import { Check, Pencil, Trash2, X } from 'lucide-react';

import type {
  Chat,
  ChatListEvent,
  ChatMessageEvent,
  Message,
  TypingEvent
} from '@/features/chats/api/chatTypes';

import {
  createDirectChat,
  createMessage,
  deleteMessage,
  getChats,
  getMessages,
  markChatAsRead,
  updateMessage
} from '@/features/chats/api/chatsApi';

export function ChatsPage() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const isLoadingOlderMessagesRef = useRef(false);

  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [search, setSearch] = useState('');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    return localStorage.getItem('messenger:selectedChatId:anonymous');
  });

  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingOriginalText, setEditingOriginalText] = useState('');

  const [typingUsersByChat, setTypingUsersByChat] = useState<Record<string, Record<string, string>>>({});

  const rawSearch = search.trim();
  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const hasSearch = rawSearch.length > 0;
  const isDebounceSettled = rawSearch === debouncedSearch;
  const canShowSearchState = hasSearch && isDebounceSettled;

  const applyChatListEvent = useCallback(
    (event: ChatListEvent) => {
      if (event.type !== 'UPDATED') {
        return;
      }

      queryClient.setQueryData<Chat[]>(['chats'], (oldChats = []) => {
        const exists = oldChats.some((chat) => chat.id === event.chat.id);

        const nextChats = exists
          ? oldChats.map((chat) => (chat.id === event.chat.id ? event.chat : chat))
          : [event.chat, ...oldChats];

        return nextChats.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
          const bTime = b.lastMessage?.createdAt ?? b.updatedAt;

          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      });
    },
    [queryClient]
  );

  function appendMessageToInfiniteData(
    data: InfiniteData<Message[]> | undefined,
    message: Message
  ): InfiniteData<Message[]> {
    if (!data) {
      return {
        pages: [[message]],
        pageParams: [undefined]
      };
    }

    const alreadyExists = data.pages.some((page) =>
      page.some((oldMessage) => oldMessage.id === message.id)
    );

    if (alreadyExists) {
      return data;
    }

    const nextPages = data.pages.map((page) => [...page]);
    const lastPageIndex = nextPages.length - 1;

    nextPages[lastPageIndex] = [...nextPages[lastPageIndex], message];

    return {
      ...data,
      pages: nextPages
    };
  }

  function updateMessageInInfiniteData(
    data: InfiniteData<Message[]> | undefined,
    message: Message
  ): InfiniteData<Message[]> | undefined {
    if (!data) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) =>
        page.map((oldMessage) => (oldMessage.id === message.id ? message : oldMessage))
      )
    };
  }

  function deleteMessageFromInfiniteData(
    data: InfiniteData<Message[]> | undefined,
    messageId: string
  ): InfiniteData<Message[]> | undefined {
    if (!data) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) =>
        page.filter((message) => message.id !== messageId)
      )
    };
  }

  const applyMessageEvent = useCallback(
    (event: ChatMessageEvent) => {
      queryClient.setQueryData<InfiniteData<Message[]>>(
        ['messages', event.message.chatId],
        (oldData) => {
          if (event.type === 'CREATED') {
            return appendMessageToInfiniteData(oldData, event.message);
          }

          if (event.type === 'UPDATED') {
            return updateMessageInInfiniteData(oldData, event.message);
          }

          if (event.type === 'DELETED') {
            return deleteMessageFromInfiniteData(oldData, event.message.id);
          }

          return oldData;
        }
      );
    },
    [queryClient]
  );

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: false
  });

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: getChats,
    enabled: isAuthenticated,
    retry: false
  });

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => getUsers(debouncedSearch),
    enabled: isAuthenticated && debouncedSearch.length > 0,
    retry: false,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', selectedChatId],
    queryFn: ({ pageParam }) => getMessages(selectedChatId!, pageParam),
    initialPageParam: undefined as string | undefined,

    getPreviousPageParam: (firstPage) => {
      if (firstPage.length < 30) {
        return undefined;
      }

      return firstPage[0]?.createdAt;
    },

    getNextPageParam: () => {
      return undefined;
    },

    enabled: isAuthenticated && Boolean(selectedChatId),
    retry: false
  });

  const messageText = selectedChatId ? messageDrafts[selectedChatId] ?? '' : '';

  const normalizedMessageText = messageText.trim();
  const normalizedEditingOriginalText = editingOriginalText.trim();

  const hasMessageChanged =
    !editingMessageId || normalizedMessageText !== normalizedEditingOriginalText;

  const chats = chatsQuery.data ?? [];
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const messages = messagesQuery.data?.pages.flat() ?? [];

  useEffect(() => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!isAuthenticated || !accessToken || !selectedChatId) {
      return;
    }

    setIsRealtimeConnected(false);

    const client = createRealtimeClient(accessToken);
    stompClientRef.current = client;

    client.onConnect = () => {
      setIsRealtimeConnected(true);

      if (currentUser?.id) {
        client.subscribe(`/topic/users/${currentUser.id}/chats/events`, (frame: IMessage) => {
          const event = JSON.parse(frame.body) as ChatListEvent;
          applyChatListEvent(event);
        });
      }

      client.subscribe(`/topic/chats/${selectedChatId}/messages/events`, (frame: IMessage) => {
        const event = JSON.parse(frame.body) as ChatMessageEvent;
        applyMessageEvent(event);
      });

      client.subscribe(`/topic/chats/${selectedChatId}/typing`, (frame: IMessage) => {
        const event = JSON.parse(frame.body) as TypingEvent;

        if (event.userId === currentUser?.id) {
          return;
        }

        setTypingUsersByChat((current) => {
          const chatTypingUsers = current[event.chatId] ?? {};
          const nextChatTypingUsers = { ...chatTypingUsers };

          if (event.typing) {
            nextChatTypingUsers[event.userId] = event.username;
          } else {
            delete nextChatTypingUsers[event.userId];
          }

          return {
            ...current,
            [event.chatId]: nextChatTypingUsers
          };
        });

        if (event.typing) {
          window.setTimeout(() => {
            setTypingUsersByChat((current) => {
              const chatTypingUsers = current[event.chatId] ?? {};
              const nextChatTypingUsers = { ...chatTypingUsers };
              delete nextChatTypingUsers[event.userId];

              return {
                ...current,
                [event.chatId]: nextChatTypingUsers
              };
            });
          }, 2500);
        }
      });
    };

    client.onDisconnect = () => {
      setIsRealtimeConnected(false);
    };

    client.onStompError = () => {
      setIsRealtimeConnected(false);
    };

    client.onWebSocketClose = () => {
      setIsRealtimeConnected(false);
    };

    client.activate();

    return () => {
      setIsRealtimeConnected(false);
      stompClientRef.current = null;
      void client.deactivate();
    };
  }, [
      isAuthenticated,
      selectedChatId,
      queryClient,
      currentUser?.id,
      applyMessageEvent,
      applyChatListEvent
    ]);

  const createDirectChatMutation = useMutation({
    mutationFn: createDirectChat,
    onSuccess: async (chat) => {
      selectChat(chat.id);
      setSearch('');
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  });

  const markChatAsReadMutation = useMutation({
    mutationFn: markChatAsRead,
    onSuccess: (updatedChat) => {
      applyChatListEvent({
        type: 'UPDATED',
        chat: updatedChat
      });
    }
  });

  const createMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId) {
        throw new Error('Chat is not selected');
      }

      return createMessage(selectedChatId, {
        content: messageText.trim()
      });
    },
    onSuccess: async (message) => {
      clearCurrentMessageText();
      shouldScrollToBottomRef.current = true;

      queryClient.setQueryData<Message[]>(
        ['messages', selectedChatId],
        (oldMessages = []) => {
          const alreadyExists = oldMessages.some((oldMessage) => oldMessage.id === message.id);

          if (alreadyExists) {
            return oldMessages;
          }

          return [...oldMessages, message];
        }
      );

      await queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  });

  const updateMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId || !editingMessageId) {
        throw new Error('Message is not selected');
      }

      return updateMessage(selectedChatId, editingMessageId, {
        content: normalizedMessageText
      });
    },
    onSuccess: (message) => {
      applyMessageEvent({
        type: 'UPDATED',
        message
      });

      setEditingMessageId(null);
      setEditingOriginalText('');
      clearCurrentMessageText();
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!selectedChatId) {
        throw new Error('Chat is not selected');
      }

      return deleteMessage(selectedChatId, messageId);
    },
    onSuccess: (message) => {
      applyMessageEvent({
        type: 'DELETED',
        message
      });
    }
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.isError) {
      logout();
    }
  }, [meQuery.isError, logout]);

  useEffect(() => {
    if (!chatsQuery.data || chatsQuery.data.length === 0) {
      return;
    }

    const storageKey = meQuery.data
      ? `messenger:selectedChatId:${meQuery.data.id}`
      : 'messenger:selectedChatId:anonymous';

    const savedChatId = localStorage.getItem(storageKey);
    const savedChatExists = savedChatId
      ? chatsQuery.data.some((chat) => chat.id === savedChatId)
      : false;

    if (savedChatExists && selectedChatId !== savedChatId) {
      setSelectedChatId(savedChatId);
      return;
    }

    const selectedChatExists = selectedChatId
      ? chatsQuery.data.some((chat) => chat.id === selectedChatId)
      : false;

    if (!selectedChatExists) {
      setSelectedChatId(chatsQuery.data[0].id);
    }
  }, [chatsQuery.data, selectedChatId, meQuery.data]);

  useLayoutEffect(() => {
    const panel = messagesPanelRef.current;

    if (!panel) {
      return;
    }

    if (isLoadingOlderMessagesRef.current) {
      const previousScrollHeight = previousScrollHeightRef.current;
      const newScrollHeight = panel.scrollHeight;
      panel.scrollTop = newScrollHeight - previousScrollHeight;
      isLoadingOlderMessagesRef.current = false;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      panel.scrollTop = panel.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages.length, selectedChatId]);

  useEffect(() => {
    shouldScrollToBottomRef.current = true;
  }, [selectedChatId]);

  const markSelectedChatAsRead = useCallback(
    (chatId: string) => {
      markChatAsReadMutation.mutate(chatId);
    },
    [markChatAsReadMutation]
  );

  useEffect(() => {
    if (!selectedChatId || messages.length === 0) {
      return;
    }

    const openedChat = chatsQuery.data?.find((chat) => chat.id === selectedChatId);

    if (!openedChat || openedChat.unreadCount === 0) {
      return;
    }

    markSelectedChatAsRead(selectedChatId);
  }, [selectedChatId, messages.length, chatsQuery.data, markChatAsRead]);

  useLayoutEffect(() => {
    const textarea = messageInputRef.current;

    if (!textarea) {
      return;
    }

    const maxHeight = 160;

    textarea.style.height = 'auto';

    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [messageText, selectedChatId]);

  const typingUsers = selectedChatId
  ? Object.values(typingUsersByChat[selectedChatId] ?? {})
  : [];

  const users = hasSearch ? usersQuery.data ?? [] : [];

  const showSearchHint = !hasSearch;

  const showSearching =
    hasSearch &&
    users.length === 0 &&
    (!isDebounceSettled || usersQuery.isFetching || usersQuery.isPending);

  const showEmptyState =
    canShowSearchState &&
    !usersQuery.isFetching &&
    !usersQuery.isPending &&
    !usersQuery.isError &&
    users.length === 0;

  const canSendMessage =
    Boolean(selectedChatId) &&
    normalizedMessageText.length > 0 &&
    hasMessageChanged;

  const selectedChatTitle = useMemo(() => {
    return selectedChat ? getChatTitle(selectedChat) : 'Выбери чат';
  }, [selectedChat]);

  function getChatTitle(chat: Chat): string {
    if (chat.type === 'GROUP') {
      return chat.title ?? 'Групповой чат';
    }

    const member = chat.members[0];
    return member?.displayName ?? member?.username ?? 'Личный чат';
  }

  function getChatSubtitle(chat: Chat): string {
    if (chat.type === 'GROUP') {
      return `${chat.members.length} участников`;
    }

    const member = chat.members[0];
    return member ? `@${member.username}` : 'Личный чат';
  }

  function handleUserClick(user: UserSummary) {
    createDirectChatMutation.mutate({
      userId: user.id
    });
  }

  function updateMessageText(value: string) {
    if (!selectedChatId) {
      return;
    }

    setMessageDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedChatId]: value
    }));

    publishTyping(value.trim().length > 0);
  }

  function clearCurrentMessageText() {
    if (!selectedChatId) {
      return;
    }

    setMessageDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[selectedChatId];
      return nextDrafts;
    });

    publishTyping(false);
  }

  function publishTyping(typing: boolean) {
    if (!selectedChatId) {
      return;
    }

    const client = stompClientRef.current;

    if (!client?.connected) {
      return;
    }

    client.publish({
      destination: `/app/chats/${selectedChatId}/typing`,
      body: JSON.stringify({ typing })
    });
  }

  function startEditingMessage(message: Message) {
    if (!selectedChatId) {
      return;
    }

    setEditingMessageId(message.id);
    setEditingOriginalText(message.content);

    setMessageDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedChatId]: message.content
    }));

    requestAnimationFrame(() => {
      const textarea = messageInputRef.current;
      textarea?.focus();

      if (textarea) {
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
      }
    });
  }

  function selectChat(chatId: string) {
    setSelectedChatId(chatId);

    const storageKey = currentUser
      ? `messenger:selectedChatId:${currentUser.id}`
      : 'messenger:selectedChatId:anonymous';

    localStorage.setItem(storageKey, chatId);
  }

  async function submitMessageEdit() {
    if (
      !selectedChatId ||
      !editingMessageId ||
      !normalizedMessageText ||
      !hasMessageChanged ||
      updateMessageMutation.isPending
    ) {
      return;
    }

    await updateMessageMutation.mutateAsync();
  }

  function cancelMessageEdit() {
    setEditingMessageId(null);
    setEditingOriginalText('');
    clearCurrentMessageText();
  }

  async function handleMessageSubmit() {
    const content = normalizedMessageText;

    if (!selectedChatId || !content || !hasMessageChanged) {
      return;
    }

    if (editingMessageId) {
      await submitMessageEdit();
      return;
    }

    if (createMessageMutation.isPending) {
      return;
    }

    const client = stompClientRef.current;

    if (client?.connected) {
      client.publish({
        destination: `/app/chats/${selectedChatId}/messages`,
        body: JSON.stringify({ content })
      });

      shouldScrollToBottomRef.current = true;
      clearCurrentMessageText();
      return;
    }

    shouldScrollToBottomRef.current = true;
    await createMessageMutation.mutateAsync();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h2>Чаты</h2>
            <p className="muted">
              {meQuery.isLoading
                ? 'Загружаем профиль...'
                : `Вы вошли как ${meQuery.data?.username ?? ''}`}
            </p>
          </div>

          <button type="button" className="small-button" onClick={logout}>
            Выйти
          </button>
        </div>

        <label className="search-label">
          Поиск пользователей
          <input
            type="search"
            placeholder="Начни вводить username или email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="user-list">
          {showSearchHint ? (
            <p className="muted">Начни вводить имя пользователя, чтобы найти человека.</p>
          ) : null}

          {showSearching ? (
            <p className="muted">Ищем пользователей...</p>
          ) : null}

          {usersQuery.isError && hasSearch ? (
            <p className="error">Не удалось загрузить пользователей.</p>
          ) : null}

          {showEmptyState ? (
            <p className="muted">Пользователи не найдены.</p>
          ) : null}

          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              className="user-card"
              disabled={createDirectChatMutation.isPending}
              onClick={() => handleUserClick(user)}
            >
              <div className="avatar">
                {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
              </div>

              <div>
                <strong>{user.displayName ?? user.username}</strong>
                <span>@{user.username}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <h3>Мои чаты</h3>
            {chatsQuery.isFetching ? <span>обновляем...</span> : null}
          </div>

          <div className="chat-list">
            {chatsQuery.isLoading ? (
              <p className="muted">Загружаем чаты...</p>
            ) : null}

            {chatsQuery.isError ? (
              <p className="error">Не удалось загрузить чаты.</p>
            ) : null}

            {!chatsQuery.isLoading && chats.length === 0 ? (
              <p className="muted">Чатов пока нет. Найди пользователя выше.</p>
            ) : null}

            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={chat.id === selectedChatId ? 'chat-card active' : 'chat-card'}
                onClick={() => selectChat(chat.id)}
              >
                <div className="avatar">
                  {getChatTitle(chat).slice(0, 1).toUpperCase()}
                </div>

                <div className="chat-card-content">
                  <strong>{getChatTitle(chat)}</strong>
                  <span>
                    {chat.lastMessage
                      ? chat.lastMessage.content
                      : getChatSubtitle(chat)}
                  </span>
                </div>

                {chat.unreadCount > 0 ? (
                  <span className="unread-badge">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="chat-workspace">
        {selectedChat ? (
          <>
            <header className="chat-header">
              <div>
                <p className="eyebrow">Direct Messages</p>
                <h1>{selectedChatTitle}</h1>
                <p className="muted">{getChatSubtitle(selectedChat)}</p>
                <p className={isRealtimeConnected ? 'connection-status online' : 'connection-status'}>
                  {isRealtimeConnected ? 'Realtime подключён' : 'Realtime подключается...'}
                </p>
              </div>
            </header>

            <div
              ref={messagesPanelRef}
              className="messages-panel"
              onScroll={() => {
                const panel = messagesPanelRef.current;

                if (
                  !panel ||
                  messagesQuery.isFetchingPreviousPage ||
                  !messagesQuery.hasPreviousPage
                ) {
                  return;
                }

                if (panel.scrollTop <= 80) {
                  previousScrollHeightRef.current = panel.scrollHeight;
                  isLoadingOlderMessagesRef.current = true;
                  void messagesQuery.fetchPreviousPage();
                }
              }}
            >
              {messagesQuery.isFetchingPreviousPage ? (
                <p className="older-messages-loader">Загружаем старые сообщения...</p>
              ) : null}

              {messagesQuery.isLoading ? (
                <p className="muted">Загружаем сообщения...</p>
              ) : null}

              {messagesQuery.isError ? (
                <p className="error">Не удалось загрузить сообщения.</p>
              ) : null}

              {!messagesQuery.isLoading && messages.length === 0 ? (
                <div className="empty-messages">
                  <h2>Сообщений пока нет</h2>
                  <p className="muted">Напиши первое сообщение в этот чат.</p>
                </div>
              ) : null}

              {messages.map((message) => {
                const isOwn = message.sender?.id === currentUser?.id;

                return (
                  <article
                    key={message.id}
                    className={isOwn ? 'message-bubble own' : 'message-bubble'}
                  >
                    <div className="message-meta">
                      <strong>
                        {message.sender?.displayName ??
                          message.sender?.username ??
                          'Удалённый пользователь'}
                      </strong>
                      <span>
                        {new Intl.DateTimeFormat('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(message.createdAt))}
                        {message.editedAt ? ' · изменено' : ''}
                      </span>
                    </div>

                    <p>{message.content}</p>

                    {isOwn ? (
                      <div className="message-actions floating">
                        <button
                          type="button"
                          className="icon-button"
                          title="Изменить сообщение"
                          aria-label="Изменить сообщение"
                          onClick={() => startEditingMessage(message)}
                        >
                          <Pencil size={14} strokeWidth={2.2} />
                        </button>

                        <button
                          type="button"
                          className="icon-button danger"
                          title="Удалить сообщение"
                          aria-label="Удалить сообщение"
                          disabled={deleteMessageMutation.isPending}
                          onClick={() => deleteMessageMutation.mutate(message.id)}
                        >
                          <Trash2 size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="typing-row">
              {typingUsers.length > 0 ? (
                <p className="typing-indicator">
                  {typingUsers.join(', ')} печатает...
                </p>
              ) : null}
            </div>

            <form
              className={editingMessageId ? 'message-form editing' : 'message-form'}
              onSubmit={(event) => {
                event.preventDefault();
                void handleMessageSubmit();
              }}
            >
              <textarea
                ref={messageInputRef}
                placeholder={editingMessageId ? 'Редактирование сообщения...' : 'Напиши сообщение...'}
                value={messageText}
                rows={1}
                onChange={(event) => updateMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleMessageSubmit();
                  }

                  if (event.key === 'Escape' && editingMessageId) {
                    event.preventDefault();
                    cancelMessageEdit();
                  }
                }}
              />

              <div className="message-form-actions">
                {editingMessageId ? (
                  <button
                    type="button"
                    className="icon-submit secondary"
                    title="Отменить редактирование"
                    aria-label="Отменить редактирование"
                    onClick={cancelMessageEdit}
                  >
                    <X size={18} />
                  </button>
                ) : null}

                  <button
                    type="submit"
                    className="icon-submit"
                    disabled={!canSendMessage || createMessageMutation.isPending || updateMessageMutation.isPending}
                    title={
                      editingMessageId && !hasMessageChanged
                        ? 'Сообщение не изменено'
                        : editingMessageId
                          ? 'Сохранить'
                          : 'Отправить'
                    }
                    aria-label={
                      editingMessageId && !hasMessageChanged
                        ? 'Сообщение не изменено'
                        : editingMessageId
                          ? 'Сохранить'
                          : 'Отправить'
                    }
                  >
                    {editingMessageId ? <Check size={18} /> : <span className="send-arrow">➤</span>}
                  </button>
              </div>
            </form>
          </>
        ) : (
          <div className="chat-panel">
            <div className="chat-empty-state">
              <h1>Выбери чат</h1>
              <p className="muted">
                Найди пользователя слева и создай личный чат.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}