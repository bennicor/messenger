import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom';
import './styles.css';

const queryClient = new QueryClient();

function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Messenger</p>
        <h1>Realtime chat and calls</h1>
        <p className="muted">
          Полноценный full-stack проект: Java, Spring Boot, React, WebSocket и WebRTC.
        </p>

        <div className="actions">
          <Link to="/login">Войти</Link>
          <Link to="/register" className="secondary">
            Создать аккаунт
          </Link>
        </div>
      </section>
    </main>
  );
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  return (
    <main className="page">
      <section className="card form-card">
        <p className="eyebrow">{mode === 'login' ? 'Login' : 'Register'}</p>
        <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>

        <form className="form">
          {mode === 'register' ? (
            <label>
              Username
              <input type="text" name="username" autoComplete="username" />
            </label>
          ) : null}

          <label>
            Email
            <input type="email" name="email" autoComplete="email" />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button type="button">{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
      </section>
    </main>
  );
}

function ChatsPage() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h2>Чаты</h2>
        <p className="muted">Список чатов появится после подключения auth и API.</p>
      </aside>

      <section className="chat-panel">
        <h1>Выбери чат</h1>
        <p className="muted">Здесь будут сообщения, WebSocket-события и кнопки звонка.</p>
      </section>
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />
  },
  {
    path: '/login',
    element: <AuthPage mode="login" />
  },
  {
    path: '/register',
    element: <AuthPage mode="register" />
  },
  {
    path: '/chats',
    element: <ChatsPage />
  }
]);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found');
}

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);