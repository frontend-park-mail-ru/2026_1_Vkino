/**
 * Создает экземпляр хранилища.
 *
 * @template T
 * @param {T} initialState - Начальный объект состояния.
 * @returns {Store<T>} Объект с методами управления состоянием.
 *
 * @example
 * const store = createStore({ count: 0 });
 * const unsubscribe = store.subscribe(state => console.log(state.count));
 * store.setState({ count: 1 }); // В консоле: 1
 * unsubscribe(); // Отписка
 */
export function createStore(initialState) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    setState(patch) {
      state = {
        ...state,
        ...patch,
      };

      const listenersSnapshot = [...listeners];
      listenersSnapshot.forEach((listener) => listener(state));
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    reset(nextState) {
      state = structuredClone(nextState);

      const listenersSnapshot = [...listeners];
      listenersSnapshot.forEach((listener) => listener(state));
    },
  };
}
