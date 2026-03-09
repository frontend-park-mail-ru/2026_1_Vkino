import { createStore } from './createStore.js';
import { authService } from '../js/AuthService.js';

const initialState = {
    status: 'idle',
    user: null,
    error: null,
};

class AuthStore {
    constructor() {
        this.store = createStore(initialState);
    }

    getState() {
        return this.store.getState();
    }

    subscribe(listener) {
        return this.store.subscribe(listener);
    }

    _setState(patch) {
        this.store.setState(patch);
    }

    _setGuest(error = null) {
        this._setState({
            status: 'guest',
            user: null,
            error,
        });
    }

    _setAuthenticated(user) {
        this._setState({
            status: 'authenticated',
            user,
            error: null,
        });
    }

    async init() {
        this._setState({
            status: 'loading',
            error: null,
        });

        const token = authService.getAccessToken();

        if (!token) {
            this._setGuest();
            return;
        }

        let meResult = await authService.me();

        if (meResult.ok) {
            this._setAuthenticated(meResult.resp);
            return;
        }

        if (meResult.status === 401) {
            const refreshResult = await authService.refresh();

            if (refreshResult.ok) {
                meResult = await authService.me();

                if (meResult.ok) {
                    this._setAuthenticated(meResult.resp);
                    return;
                }
            }
        }

        authService.clearAccessToken();
        this._setGuest('Не удалось восстановить сессию');
    }

    async signIn(credentials) {
        this._setState({
            status: 'loading',
            error: null,
        });

        const signInResult = await authService.signIn(credentials);

        if (!signInResult.ok) {
            this._setGuest(signInResult.resp?.Error || 'Не удалось выполнить вход');
            return signInResult;
        }

        const meResult = await authService.me();

        if (meResult.ok) {
            this._setAuthenticated(meResult.resp);
            return signInResult;
        }

        this._setGuest('Вход выполнен, но не удалось получить данные пользователя');
        return {
            ok: false,
            status: meResult.status,
            resp: {
                Error: 'Не удалось получить данные пользователя',
            },
        };
    }

    async signUp(data) {
        this._setState({
            status: 'loading',
            error: null,
        });

        const signUpResult = await authService.signUp(data);

        if (!signUpResult.ok) {
            this._setGuest(signUpResult.resp?.Error || 'Не удалось выполнить регистрацию');
            return signUpResult;
        }

        const meResult = await authService.me();

        if (meResult.ok) {
            this._setAuthenticated(meResult.resp);
            return signUpResult;
        }

        this._setGuest('Регистрация выполнена, но не удалось получить данные пользователя');
        return {
            ok: false,
            status: meResult.status,
            resp: {
                Error: 'Не удалось получить данные пользователя',
            },
        };
    }

    async logout() {
        await authService.logout();
        this._setGuest();
    }
}

export const authStore = new AuthStore();