// useKeyboardShortcuts.js
import { useEffect } from 'react';

export default function useKeyboardShortcuts({
  onStar,
  onNext,
  onPrev,
  onDone,
  onFlip,
  readActiveElement = () => null
}) {
  useEffect(() => {
    function handler(e) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const code = e.code || '';
      const key = e.key || '';

      if (code === 'Space' || key === ' ') {
        e.preventDefault();
        onStar && onStar();
        return;
      }
      if (code === 'ArrowRight' || key === 'ArrowRight') {
        e.preventDefault();
        onNext && onNext();
        return;
      }
      if (code === 'ArrowLeft' || key === 'ArrowLeft') {
        e.preventDefault();
        onPrev && onPrev();
        return;
      }
      if (code === 'ArrowDown' || key === 'ArrowDown') {
        e.preventDefault();
        onDone && onDone();
        return;
      }
      if (code === 'ArrowUp' || key === 'ArrowUp') {
        e.preventDefault();
        onFlip && onFlip();
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onStar, onNext, onPrev, onDone, onFlip, readActiveElement]);
}
