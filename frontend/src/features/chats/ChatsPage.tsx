import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getMe } from '@/features/auth/authApi';
import { useAuthStore } from '@/stores/authStore';

export function ChatsPage() {
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: false
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    setUser(user);
  }

  if (isError) {
    logout();
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h2>Чаты</h2>
            <p className="muted">
              {isLoading ? 'Загружаем профиль...' : `Вы вошли как ${user?.username ?? ''}`}
            </p>
          </div>

          <button type="button" className="small-button" onClick={logout}>
            Выйти
          </button>
        </div>

        <p className="muted">
          На следующем этапе здесь появятся пользователи и создание личных чатов.
        </p>
      </aside>

      <section className="chat-panel">
        <h1>Auth работает</h1>
        <p className="muted">
          Пользователь авторизован, JWT сохранён, запрос /users/me проходит.
        </p>
      </section>
    </main>
  );
}