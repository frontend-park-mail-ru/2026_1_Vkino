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

            listeners.forEach((listener) => listener(state));
        },

        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        reset(nextState) {
            state = structuredClone(nextState);
            listeners.forEach((listener) => listener(state));
        },
    };
}