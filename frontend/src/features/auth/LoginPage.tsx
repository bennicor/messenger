import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from './authApi';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo =
    typeof from?.pathname === 'string'
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : '/chats';

  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login({ email, password });
      setAuth(response.accessToken, response.user);
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Не удалось войти. Проверь email и пароль.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="card form-card">
        <p className="eyebrow">Login</p>
        <h1>Вход</h1>

        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitLogin();
          }}
        >
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="muted auth-link">
          Нет аккаунта? <Link to="/register" state={{ from }}>Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}