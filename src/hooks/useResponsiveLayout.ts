import { useSyncExternalStore } from 'react';

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    listener => {
      const media = window.matchMedia(query);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => window.matchMedia(query).matches,
  );
}

export function useResponsiveLayout() {
  return {
    // 300px navigation + 480px task list + 400px comfortable detail width.
    compactNavigation: useMediaQuery('(max-width: 1179px)'),
    // Keep the 60px navigation rail alongside the 480px list and 350px details.
    drawerDetails: useMediaQuery('(max-width: 889px)'),
  };
}
