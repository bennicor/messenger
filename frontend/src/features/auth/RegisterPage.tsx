import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { register } from './authApi';
import { useAuthStore } from '@/stores/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo =
    typeof from?.pathname === 'string'
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : '/chats';

  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitRegister() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await register({ username, email, password });
      setAuth(response.accessToken, response.user);
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Не удалось зарегистрироваться. Возможно, username или email уже заняты.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="card form-card">
        <p className="eyebrow">Register</p>
        <h1>Регистрация</h1>

        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRegister();
          }}
        >
          <label>
            Username
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={32}
              required
            />
          </label>

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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="muted auth-link">
          Уже есть аккаунт? <Link to="/login" state={{ from }}>Войти</Link>
        </p>
      </section>
    </main>
  );
}