'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from './actions';

/** Re-renders the page whenever the backend pushes a task or list change. */
export function LiveUpdates({ url }: { url: string }) {
  const router = useRouter();

  useEffect(() => {
    const socket = io(url, {
      transports: ['websocket'],
      // Called on every (re)connect, so each handshake gets a fresh token.
      // A failed token fetch still answers: the server then drops the socket
      // and the retry below tries again, instead of the handshake hanging.
      auth: (cb) =>
        void getAccessToken().then(
          (token) => cb({ token }),
          () => cb({}),
        ),
    });
    // Events sent before this (re)connect were missed, including those between
    // the page render and the first connect: catch up.
    socket.on('connect', () => router.refresh());
    // The server drops the socket when its token expires (or is rejected) and
    // socket.io won't retry that on its own; the delay stops a tight loop.
    let retry: ReturnType<typeof setTimeout> | undefined;
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        retry = setTimeout(() => socket.connect(), 1000);
      }
    });
    socket.onAny(() => router.refresh());
    return () => {
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [url, router]);

  return null;
}
