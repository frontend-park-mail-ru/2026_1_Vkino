import type { Cleanup } from "@/types/shared.ts";

export type StoreListener<TState extends object> = (state: TState) => void;

export interface Store<TState extends object> {
  getState(): TState;
  setState(patch: Partial<TState>): void;
  subscribe(listener: StoreListener<TState>): Cleanup;
  reset(nextState: TState): void;
}

export function createStore<TState extends object>(
  initialState: TState,
): Store<TState> {
  let state = structuredClone(initialState);
  const listeners = new Set<StoreListener<TState>>();

  return {
    getState(): TState {
      return state;
    },

    setState(patch: Partial<TState>): void {
      state = {
        ...state,
        ...patch,
      };

      const listenersSnapshot = [...listeners];
      listenersSnapshot.forEach((listener) => listener(state));
    },

    subscribe(listener: StoreListener<TState>): Cleanup {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    reset(nextState: TState): void {
      state = structuredClone(nextState);

      const listenersSnapshot = [...listeners];
      listenersSnapshot.forEach((listener) => listener(state));
    },
  };
}
