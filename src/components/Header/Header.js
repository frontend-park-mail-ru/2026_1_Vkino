import { BaseComponent } from '../BaseComponent.js';
import './Header.precompiled.js';
import { authStore } from '../../store/authStore.js';

export default class HeaderComponent extends BaseComponent {
    constructor(context = {}, parent = null, el = null) {
        if (!parent) {
            throw new Error('Header: не передан parent для HeaderComponent');
        }

        if (!el) {
            throw new Error('Header: не передан el для HeaderComponent');
        }

        super(context, Handlebars.templates['Header.hbs'], parent, el);

        this._unsubscribe = null;
    }

    init() {
        const state = authStore.getState();

        this.context = {
            ...this.context,
            isAuthorized: state.status === 'authenticated',
            userName: getDisplayNameFromEmail(state.user?.email),
        };

        return super.init();
    }

    addEventListeners() {
        this._unsubscribe = authStore.subscribe((state) => {
            this.refresh({
                ...this.context,
                isAuthorized: state.status === 'authenticated',
                userName: getDisplayNameFromEmail(state.user?.email),
            });
        });
    }

    removeEventListeners() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }
}

function getDisplayNameFromEmail(email = '') {
    const normalized = String(email).trim();
    if (!normalized) return '';

    const atIndex = normalized.indexOf('@');
    if (atIndex === -1) return normalized;

    return normalized.slice(0, atIndex);
}