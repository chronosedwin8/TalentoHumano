import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

export type RealtimeHandler = (event: string, payload: unknown) => void;

let socket: Socket | null = null;

/**
 * Connects to the API's realtime namespace with the current access token and
 * forwards every server event to `onEvent`. Access tokens rotate every few
 * minutes, so the token is re-read before each reconnection attempt.
 * Returns the function that closes the connection.
 */
export function connectRealtime(onEvent: RealtimeHandler): () => void {
  const token = getAccessToken();
  if (!token) return () => undefined;

  // Empty base means same origin: nginx (production) and the Vite dev server
  // proxy /socket.io to the API.
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  socket = io(`${base}/realtime`, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 30_000,
  });
  socket.io.on('reconnect_attempt', () => {
    if (socket) socket.auth = { token: getAccessToken() ?? '' };
  });
  socket.onAny(onEvent);

  return () => {
    socket?.offAny(onEvent);
    socket?.disconnect();
    socket = null;
  };
}
