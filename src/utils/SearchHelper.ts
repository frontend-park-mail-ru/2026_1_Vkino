export function createDebouncedSearch<TArgs extends unknown[]>(
  handler: (...args: TArgs) => void,
  delay = 300,
) {
  let timeoutId: number | null = null;

  return (...args: TArgs) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      handler(...args);
    }, delay);
  };
}
