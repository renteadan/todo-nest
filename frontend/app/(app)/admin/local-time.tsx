'use client';

import { useSyncExternalStore } from 'react';
import { formatLocal } from '../tasks/date-picker';
import { utcToLocal } from '../tasks/local-time';

const noSubscribe = () => () => {};

/** A UTC time in the viewer's time zone; empty in the server render. */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => formatLocal(utcToLocal(iso)),
    () => '',
  );
  return <time dateTime={iso}>{text}</time>;
}
