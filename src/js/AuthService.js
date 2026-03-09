import { apiService } from './api.js';

export class AuthService {
    constructor(apiService) {
        this.apiRoot = apiService;
        this.api = apiService.withNamespace('/auth');
    }

    _saveAccessToken(result) {
        const accessToken = result?.resp?.access_token;

        if (result?.ok && accessToken) {
            this.apiRoot.setAccessToken(accessToken);
        }
    }

    _clearSessionLocal() {
        this.apiRoot.clearAccessToken();
    }

    getAccessToken() {
        return this.apiRoot.getAccessToken();
    }

    clearAccessToken() {
        this._clearSessionLocal();
    }

    async signIn(authUserData) {
        const result = await this.api.post('/sign-in', authUserData);
        this._saveAccessToken(result);
        return result;
    }

    async signUp(authUserData) {
        const result = await this.api.post('/sign-up', authUserData);
        this._saveAccessToken(result);
        return result;
    }

    async refresh() {
        const result = await this.api.post('/refresh');
        this._saveAccessToken(result);

        if (!result.ok) {
            this._clearSessionLocal();
        }

        return result;
    }

    async me() {
        return this.api.get('/me');
    }

    async logout() {
        const result = await this.api.get('/logout');
        this._clearSessionLocal();
        return result;
    }
}

export const authService = new AuthService(apiService);