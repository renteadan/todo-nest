'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * An input that warns once its value passes `max` characters, mirroring the
 * backend's zod limits (`trim` when the backend trims before counting).
 */
export function LimitedInput({
  max,
  trim = false,
  noun,
  className,
  ...props
}: React.ComponentProps<'input'> & {
  max: number;
  trim?: boolean;
  noun: string;
}) {
  const [length, setLength] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const warningId = useId();
  const over = length > max;

  // Form actions reset the form after submitting; start counting from 0 again.
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => setLength(0);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <input
        {...props}
        ref={ref}
        onInput={(e) => {
          const value = e.currentTarget.value;
          setLength((trim ? value.trim() : value).length);
        }}
        aria-invalid={over || undefined}
        aria-describedby={over ? warningId : undefined}
        className="field w-full aria-invalid:border-danger"
      />
      {/* Always rendered: a live region must exist before its text changes. */}
      <p
        id={warningId}
        aria-live="polite"
        className="text-sm text-danger empty:hidden"
      >
        {over &&
          `${noun} can be at most ${max} characters (${length - max} too many).`}
      </p>
    </div>
  );
}
