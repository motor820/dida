import { useLayoutEffect, type RefObject } from 'react';

/** Fit all text on entry, while typing, and when the available width changes. */
export function useAutoGrowTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, active: boolean) {
  useLayoutEffect(() => {
    const input = ref.current;
    if (!active || !input) return;
    const resize = () => {
      input.style.height = 'auto';
      const style = getComputedStyle(input);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      input.style.height = `${input.scrollHeight + border}px`;
    };
    resize();
    let previousWidth = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== previousWidth) {
        previousWidth = input.clientWidth;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [ref, value, active]);
}
