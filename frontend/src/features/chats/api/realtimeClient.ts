import { Client } from '@stomp/stompjs';

export function createRealtimeClient(accessToken: string): Client {
  const wsUrl = import.meta.env.VITE_WS_BASE_URL;

  return new Client({
    brokerURL: wsUrl,
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`
    },
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: import.meta.env.DEV ? console.debug : undefined
  });
}