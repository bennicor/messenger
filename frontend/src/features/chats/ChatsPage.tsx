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
import { Check, LogOut, Pencil, Trash2, Users, X } from 'lucide-react';

import type {
  Chat,
  ChatListEvent,
  ChatMessageEvent,
  Message,
  TypingEvent
} from '@/features/chats/api/chatTypes';

import {
  createDirectChat,
  createGroupChat,
  createMessage,
  deleteMessage,
  getChats,
  getMessages,
  leaveGroupChat,
  markChatAsRead,
  updateMessage
} from '@/features/chats/api/chatsApi';

type MessagesPageParam =
  | { before: string }
  | { after: string }
  | { around: string }
  | undefined;


export function ChatsPage() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const isLoadingOlderMessagesRef = useRef(false);

  const firstUnreadTargetMessageIdRef = useRef<string | null>(null);
  const shouldScrollToFirstUnreadRef = useRef(false);
  const initialAroundMessageIdRef = useRef<string | null>(null);


  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [initialAroundMessageId, setInitialAroundMessageId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    return localStorage.getItem('messenger:selectedChatId:anonymous');
  });

  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [, setIsRealtimeConnected] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingOriginalText, setEditingOriginalText] = useState('');

  const [typingUsersByChat, setTypingUsersByChat] = useState<Record<string, Record<string, string>>>({});

  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);

  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);

  const rawSearch = search.trim();
  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const hasSearch = rawSearch.length > 0;
  const isDebounceSettled = rawSearch === debouncedSearch;
  const canShowSearchState = hasSearch && isDebounceSettled;

  const applyChatListEvent = useCallback(
    (event: ChatListEvent) => {
      if (event.type === 'REMOVED') {
        queryClient.setQueryData<Chat[]>(['chats'], (oldChats = []) =>
          oldChats.filter((chat) => chat.id !== event.chatId)
        );

        setSelectedChatId((currentSelectedChatId) =>
          currentSelectedChatId === event.chatId ? null : currentSelectedChatId
        );

        const storageKey = currentUser
          ? `messenger:selectedChatId:${currentUser.id}`
          : 'messenger:selectedChatId:anonymous';

        if (localStorage.getItem(storageKey) === event.chatId) {
          localStorage.removeItem(storageKey);
        }

        return;
      }

      if (event.type !== 'UPDATED' || event.chat === null) {
        return;
      }

      const updatedChat = event.chat;

      queryClient.setQueryData<Chat[]>(['chats'], (oldChats = []) => {
        const exists = oldChats.some((chat) => chat.id === updatedChat.id);

        const nextChats: Chat[] = exists
          ? oldChats.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat))
          : [updatedChat, ...oldChats];

        return nextChats.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
          const bTime = b.lastMessage?.createdAt ?? b.updatedAt;

          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      });
    },
    [queryClient, currentUser]
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
      queryClient.setQueriesData<InfiniteData<Message[]>>(
        {
          queryKey: ['messages', event.message.chatId]
        },
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

  const messagesQueryKey = ['messages', selectedChatId, initialAroundMessageId] as const;

  const messagesQuery = useInfiniteQuery<
    Message[],
    Error,
    InfiniteData<Message[]>,
    typeof messagesQueryKey,
    MessagesPageParam
  >({
    queryKey: messagesQueryKey,
    queryFn: ({ pageParam }) => {
      if (!selectedChatId) {
        return Promise.resolve([]);
      }

      return getMessages(selectedChatId, pageParam ?? {});
    },
    initialPageParam: initialAroundMessageId
      ? { around: initialAroundMessageId }
      : undefined,

    getPreviousPageParam: (firstPage) => {
      if (firstPage.length < 30) {
        return undefined;
      }

      const firstMessage = firstPage[0];

      return firstMessage ? { before: firstMessage.createdAt } : undefined;
    },

    getNextPageParam: (lastPage) => {
      if (!initialAroundMessageId || lastPage.length < 30) {
        return undefined;
      }

      const lastMessage = lastPage.at(-1);

      return lastMessage ? { after: lastMessage.createdAt } : undefined;
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

  const selectedChatUnreadCount = selectedChat?.unreadCount ?? 0;

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
      selectChat(chat);
      setSearch('');
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  });

  const markChatAsReadMutation = useMutation({
    mutationFn: markChatAsRead,
    onSuccess: (updatedChat) => {
      queryClient.setQueryData<Chat[]>(['chats'], (oldChats = []) =>
        oldChats.map((chat) =>
          chat.id === updatedChat.id ? updatedChat : chat
        )
      );
    }
  });

  const { mutate: markChatAsReadMutate } = markChatAsReadMutation;

  const markSelectedChatAsRead = useCallback(
    (chatId: string) => {
      markChatAsReadMutate(chatId);
    },
    [markChatAsReadMutate]
  );

  const createGroupChatMutation = useMutation({
    mutationFn: async () => {
      return createGroupChat({
        title: groupTitle.trim(),
        memberIds: selectedGroupMemberIds
      });
    },
    onSuccess: (chat) => {
      applyChatListEvent({
        type: 'UPDATED',
        chat,
        chatId: chat.id
      });

      selectChat(chat);
      resetGroupCreator();
      setSearch('');
    }
  });

  const createMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId) {
        throw new Error('Chat is not selected');
      }

      return createMessage(selectedChatId, {
        content: normalizedMessageText
      });
    },
    onSuccess: (message) => {
      shouldScrollToBottomRef.current = true;

      applyMessageEvent({
        type: 'CREATED',
        message
      });

      clearCurrentMessageText();
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

  const selectChat = useCallback(
    (chat: Chat) => {
      setSelectedChatId(chat.id);

      const storageKey = currentUser
        ? `messenger:selectedChatId:${currentUser.id}`
        : 'messenger:selectedChatId:anonymous';

      localStorage.setItem(storageKey, chat.id);

      if (chat.unreadCount > 0 && chat.firstUnreadMessageId) {
        setInitialAroundMessageId(chat.firstUnreadMessageId);
        firstUnreadTargetMessageIdRef.current = chat.firstUnreadMessageId;
        shouldScrollToFirstUnreadRef.current = true;
        shouldScrollToBottomRef.current = false;
        return;
      }

      setInitialAroundMessageId(null);
      firstUnreadTargetMessageIdRef.current = null;
      shouldScrollToFirstUnreadRef.current = false;
      shouldScrollToBottomRef.current = true;
    },
    [currentUser]
  );


  const leaveGroupChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      await leaveGroupChat(chatId);
      return chatId;
    },
    onSuccess: (chatId) => {
      queryClient.setQueryData<Chat[]>(['chats'], (oldChats = []) =>
        oldChats.filter((chat) => chat.id !== chatId)
      );

      setSelectedChatId((currentSelectedChatId) =>
        currentSelectedChatId === chatId ? null : currentSelectedChatId
      );

      const storageKey = currentUser
        ? `messenger:selectedChatId:${currentUser.id}`
        : 'messenger:selectedChatId:anonymous';

      if (localStorage.getItem(storageKey) === chatId) {
        localStorage.removeItem(storageKey);
      }

      setIsChatInfoOpen(false);
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

    const selectedChatExists = selectedChatId
      ? chatsQuery.data.some((chat) => chat.id === selectedChatId)
      : false;

    if (selectedChatExists) {
      return;
    }

    const savedChatId = localStorage.getItem(storageKey);
    const savedChat = savedChatId
      ? chatsQuery.data.find((chat) => chat.id === savedChatId)
      : null;

    if (savedChat) {
      selectChat(savedChat);
      return;
    }

    selectChat(chatsQuery.data[0]);
  }, [chatsQuery.data, selectedChatId, meQuery.data, selectChat]);

  useLayoutEffect(() => {
    const panel = messagesPanelRef.current;

    if (!panel) {
      return;
    }

    if (
      shouldScrollToFirstUnreadRef.current &&
      firstUnreadTargetMessageIdRef.current
    ) {
      const target = panel.querySelector<HTMLElement>(
        `[data-message-id="${firstUnreadTargetMessageIdRef.current}"]`
      );

      if (target) {
        const comfortableOffset = Math.round(panel.clientHeight * 0.28);

        panel.scrollTop = Math.max(
          target.offsetTop - comfortableOffset,
          0
        );

        shouldScrollToFirstUnreadRef.current = false;
        firstUnreadTargetMessageIdRef.current = null;
        initialAroundMessageIdRef.current = null;

        if (selectedChatId) {
          markSelectedChatAsRead(selectedChatId);
        }

        return;
      }
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
  }, [messages.length, selectedChatId, markSelectedChatAsRead]);

  useEffect(() => {
    shouldScrollToBottomRef.current = true;
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || messages.length === 0) {
      return;
    }

    if (!selectedChat || selectedChat.unreadCount === 0) {
      return;
    }

    if (
      selectedChat.firstUnreadMessageId &&
      shouldScrollToFirstUnreadRef.current
    ) {
      return;
    }

    const panel = messagesPanelRef.current;

    if (!panel) {
      return;
    }

    const distanceFromBottom =
      panel.scrollHeight - panel.scrollTop - panel.clientHeight;

    if (distanceFromBottom <= 80) {
      markSelectedChatAsRead(selectedChatId);
    }
  }, [
    selectedChatId,
    messages.length,
    selectedChat,
    markSelectedChatAsRead
  ]);

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

  function resetGroupCreator() {
    setIsGroupMode(false);
    setGroupTitle('');
    setSelectedGroupMemberIds([]);
  }

  function toggleGroupMember(userId: string) {
    setSelectedGroupMemberIds((currentIds) => {
      if (currentIds.includes(userId)) {
        return currentIds.filter((id) => id !== userId);
      }

      return [...currentIds, userId];
    });
  }

  function handleUserClick(user: UserSummary) {
    if (isGroupMode) {
      toggleGroupMember(user.id);
      return;
    }

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

          <div className="sidebar-actions">
            <button type="button" className="small-button logout-button" onClick={logout}>
              Выйти
            </button>

            <button
              type="button"
              className={isGroupMode ? 'group-mode-button active' : 'group-mode-button'}
              onClick={() => {
                if (isGroupMode) {
                  resetGroupCreator();
                } else {
                  setIsGroupMode(true);
                }
              }}
            >
              <Users size={16} />
              <span>Группа</span>
            </button>
          </div>
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

        {isGroupMode ? (
          <div className="group-creator">
            <label>
              Название группы
              <input
                type="text"
                placeholder="Например: Курсач"
                value={groupTitle}
                maxLength={80}
                onChange={(event) => setGroupTitle(event.target.value)}
              />
            </label>

            <div className="group-creator-footer">
              <span>
                Выбрано: {selectedGroupMemberIds.length}
              </span>

              <button
                type="button"
                disabled={
                  !groupTitle.trim() ||
                  selectedGroupMemberIds.length === 0 ||
                  createGroupChatMutation.isPending
                }
                onClick={() => createGroupChatMutation.mutate()}
              >
                {createGroupChatMutation.isPending ? 'Создаём...' : 'Создать'}
              </button>
            </div>

            <p className="muted group-hint">
              Найди пользователей через поиск и выбери участников группы.
            </p>
          </div>
        ) : null}

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

          {users.map((user) => {
            const isSelectedForGroup = selectedGroupMemberIds.includes(user.id);

            return (
              <button
                key={user.id}
                type="button"
                className={[
                  'user-card',
                  isSelectedForGroup ? 'selected' : ''
                ].filter(Boolean).join(' ')}
                disabled={
                  createDirectChatMutation.isPending ||
                  createGroupChatMutation.isPending
                }
                onClick={() => handleUserClick(user)}
              >
                <div className="avatar">
                  {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <strong>{user.displayName ?? user.username}</strong>
                  <span>@{user.username}</span>
                </div>

                {isGroupMode ? (
                  <span className="user-select-indicator">
                    {isSelectedForGroup ? <Check size={15} /> : '+'}
                  </span>
                ) : null}
              </button>
            );}
          )}
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
                onClick={() => selectChat(chat)}
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
              <p className="eyebrow">
                {selectedChat.type === 'GROUP' ? 'Group chat' : 'Direct chat'}
              </p>
              <h1>{selectedChatTitle}</h1>
              <p className="muted">{getChatSubtitle(selectedChat)}</p>
            </div>

            {selectedChat.type === 'GROUP' ? (
              <button
                type="button"
                className="chat-info-button"
                onClick={() => setIsChatInfoOpen((isOpen) => !isOpen)}
              >
                <Users size={17} />
                Участники
              </button>
            ) : null}
          </header>

          {isChatInfoOpen && selectedChat.type === 'GROUP' ? (
            <section className="chat-info-panel">
              <div className="chat-info-header">
                <div>
                  <h2>Участники</h2>
                  <p className="muted">{selectedChat.members.length} участников</p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsChatInfoOpen(false)}
                  aria-label="Закрыть"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="member-list">
                {selectedChat.members.map((member) => (
                  <div key={member.id} className="member-card">
                    <div className="avatar">
                      {(member.displayName ?? member.username).slice(0, 1).toUpperCase()}
                    </div>

                    <div>
                      <strong>{member.displayName ?? member.username}</strong>
                      <span>@{member.username}</span>
                    </div>

                    <span className="member-role">
                      {member.role === 'OWNER'
                        ? 'Владелец'
                        : member.role === 'ADMIN'
                          ? 'Админ'
                          : 'Участник'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="leave-group-button"
                disabled={leaveGroupChatMutation.isPending}
                onClick={() => {
                  if (selectedChat?.type === 'GROUP') {
                    leaveGroupChatMutation.mutate(selectedChat.id);
                  }
                }}
              >
                <LogOut size={16} />
                {leaveGroupChatMutation.isPending ? 'Выходим...' : 'Выйти из группы'}
              </button>
            </section>
          ) : null}

            <div
              ref={messagesPanelRef}
              className="messages-panel"
              onScroll={() => {
                const panel = messagesPanelRef.current;

                if (!panel) {
                  return;
                }

                const distanceFromBottom =
                  panel.scrollHeight - panel.scrollTop - panel.clientHeight;

                if (
                  selectedChatId &&
                  selectedChatUnreadCount > 0 &&
                  distanceFromBottom <= 80
                ) {
                  markSelectedChatAsRead(selectedChatId);
                }

                if (
                  panel.scrollTop <= 80 &&
                  !messagesQuery.isFetchingPreviousPage &&
                  messagesQuery.hasPreviousPage
                ) {
                  previousScrollHeightRef.current = panel.scrollHeight;
                  isLoadingOlderMessagesRef.current = true;
                  void messagesQuery.fetchPreviousPage();
                  return;
                }

                if (
                  distanceFromBottom <= 80 &&
                  !messagesQuery.isFetchingNextPage &&
                  messagesQuery.hasNextPage
                ) {
                  void messagesQuery.fetchNextPage();
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
                const isFirstUnread = message.id === firstUnreadTargetMessageIdRef.current;

                return (
                      <article
                        key={message.id}
                        data-message-id={message.id}
                        className={[
                          'message-bubble',
                          isOwn ? 'own' : '',
                          isFirstUnread ? 'first-unread' : ''
                        ].filter(Boolean).join(' ')}
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
              
              {messagesQuery.isFetchingNextPage ? (
                <p className="older-messages-loader">Загружаем новые сообщения...</p>
              ) : null}

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