import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe } from '@/features/auth/authApi';
import { getUsers } from '@/features/auth/usersApi';
import type { UserSummary } from '@/features/auth/authTypes';
import { createDirectChat, getChats } from '@/features/chats/api/chatsApi';
import type { Chat } from '@/features/chats/api/chatTypes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';

export function ChatsPage() {
  const queryClient = useQueryClient();

  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const [search, setSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const rawSearch = search.trim();
  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const hasSearch = rawSearch.length > 0;
  const isDebounceSettled = rawSearch === debouncedSearch;
  const canShowSearchState = hasSearch && isDebounceSettled;

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
    staleTime: 30_000
  });

  const createDirectChatMutation = useMutation({
    mutationFn: createDirectChat,
    onSuccess: async (chat) => {
      setSelectedChatId(chat.id);
      setSearch('');
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
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
    if (!selectedChatId && chatsQuery.data && chatsQuery.data.length > 0) {
      setSelectedChatId(chatsQuery.data[0].id);
    }
  }, [chatsQuery.data, selectedChatId]);

  const chats = chatsQuery.data ?? [];
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;

  const users = canShowSearchState ? usersQuery.data ?? [] : [];

  const showSearchHint = !hasSearch;
  const showSearching =
    hasSearch &&
    (!isDebounceSettled || usersQuery.isFetching || usersQuery.isPending);

  const showEmptyState =
    canShowSearchState &&
    !usersQuery.isFetching &&
    !usersQuery.isPending &&
    !usersQuery.isError &&
    users.length === 0;

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
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div className="avatar">
                  {getChatTitle(chat).slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <strong>{getChatTitle(chat)}</strong>
                  <span>{getChatSubtitle(chat)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="chat-panel">
        {selectedChat ? (
          <div className="chat-empty-state">
            <p className="eyebrow">Direct chat</p>
            <h1>{getChatTitle(selectedChat)}</h1>
            <p className="muted">
              Чат создан. На следующем этапе добавим историю сообщений и отправку сообщений.
            </p>
          </div>
        ) : (
          <div className="chat-empty-state">
            <h1>Выбери чат</h1>
            <p className="muted">
              Найди пользователя слева и создай личный чат.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}