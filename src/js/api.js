export class ApiService {
    constructor(baseUrl, namespace = '', accessTokenKey = 'vkino_access_token') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.namespace = namespace;
        this.accessTokenKey = accessTokenKey;
    }

    withNamespace(namespace) {
        return new ApiService(this.baseUrl, namespace, this.accessTokenKey);
    }

    getAccessToken() {
        return localStorage.getItem(this.accessTokenKey);
    }

    setAccessToken(token) {
        if (!token) {
            this.clearAccessToken();
            return;
        }

        localStorage.setItem(this.accessTokenKey, token);
    }

    clearAccessToken() {
        localStorage.removeItem(this.accessTokenKey);
    }

    buildUrl(endpoint = '') {
        const normalizedNamespace = this.namespace
            ? `/${String(this.namespace).replace(/^\/+|\/+$/g, '')}`
            : '';

        const normalizedEndpoint = endpoint
            ? `/${String(endpoint).replace(/^\/+/, '')}`
            : '';

        return `${this.baseUrl}${normalizedNamespace}${normalizedEndpoint}`;
    }

    async request(endpoint, { method = 'GET', data = null, headers = {} } = {}) {
        const url = this.buildUrl(endpoint);
        const accessToken = this.getAccessToken();

        const fetchParams = {
            method,
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                ...headers,
            },
        };

        if (data !== null) {
            fetchParams.headers['Content-Type'] = 'application/json';
            fetchParams.body = JSON.stringify(data);
        }

        if (accessToken) {
            fetchParams.headers.Authorization = `Bearer ${accessToken}`;
        }

        let response;

        try {
            response = await fetch(url, fetchParams);
        } catch (error) {
            return {
                ok: false,
                status: 0,
                resp: null,
                error: error.message || 'Network error',
            };
        }

        const rawText = await response.text();

        let parsedBody = null;

        if (rawText) {
            try {
                parsedBody = JSON.parse(rawText);
            } catch {
                parsedBody = { raw: rawText };
            }
        }

        return {
            ok: response.ok,
            status: response.status,
            resp: parsedBody,
            error: extractErrorMessage(parsedBody),
        };
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data = null) {
        return this.request(endpoint, { method: 'POST', data });
    }

    put(endpoint, data = null) {
        return this.request(endpoint, { method: 'PUT', data });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

function extractErrorMessage(resp) {
    if (!resp || typeof resp !== 'object') return '';
    return resp.Error || resp.error || resp.message || '';
}

// читаем baseUrl из .env (с сервера)
const baseUrl = window.APP_CONFIG?.BASE_URL || 'http://localhost:8080';
export const apiService = new ApiService(baseUrl);