import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { meta = false, ctrl = false, shift = false } = options;

      if (meta && !event.metaKey) return;
      if (ctrl && !event.ctrlKey) return;
      if (shift && !event.shiftKey) return;
      if (!event.key || event.key.toLowerCase() !== key.toLowerCase()) return;

      event.preventDefault();
      callback();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}
