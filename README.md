# Мессенджер с возможностью текстового и голосового общения

Стек используемых технологий:

- Java 21
- Spring Boot
- PostgreSQL
- React
- TypeScript
- Vite
- WebSocket
- WebRTC
- Docker Compose
- Nginx reverse proxy

## Сервисы

| Service | URL |
|---|---|
| App through Nginx | http://localhost |
| Backend direct | http://localhost:8080 |
| Frontend direct | http://localhost:5173 |
| pgAdmin | http://localhost:5050 |
| Backend health | http://localhost/api/health |
| Actuator health | http://localhost/actuator/health |

## Запуск

```bash
cp .env.example .env
docker compose up --build