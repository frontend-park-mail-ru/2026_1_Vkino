export function createDebouncedSearch(handler, delay = 300) {
  let timeoutId: number | null = null;

  return (...args) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      handler(...args);
    }, delay);
  };
}
