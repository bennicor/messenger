import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/features/auth/authApi';
import { getUsers } from '@/features/auth/usersApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/stores/authStore';

export function ChatsPage() {
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const [search, setSearch] = useState('');

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

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => getUsers(debouncedSearch),
    enabled: isAuthenticated && debouncedSearch.length > 0,
    retry: false,
    staleTime: 30_000
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
            <button key={user.id} type="button" className="user-card">
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
      </aside>

      <section className="chat-panel">
        <h1>Найди пользователя</h1>
        <p className="muted">
          Введи username или email слева. На следующем этапе при клике будем создавать личный чат.
        </p>
      </section>
    </main>
  );
}