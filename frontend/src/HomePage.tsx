import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Messenger</p>
        <h1>Realtime chat and calls</h1>
        <p className="muted">
          Full-stack мессенджер на Java, Spring Boot, React, WebSocket и WebRTC.
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