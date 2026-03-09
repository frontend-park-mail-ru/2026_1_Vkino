import BasePage from '../BasePage.js';
import './SignIn.precompiled.js';

import { attachPageStyles } from '../../utils/pageStyles.js';
import { initPasswordToggle } from '../../js/password/eye-btn.js';
import { initAuthValidation, setError } from '../../js/password/validation.js';
import { authService } from '../../js/AuthService.js';

export default class SignInPage extends BasePage {
    constructor(context = {}, parent = null, el = null) {
        if (!el) {
            throw new Error('SignIn: не передан корневой элемент для SignIn');
        }

        super(
            context,
            Handlebars.templates['SignIn.hbs'],
            parent,
            el,
            'SignInPage'
        );

        this._detachStyles = null;
        this._destroyPasswordToggle = null;
        this._destroyValidation = null;
    }

    init() {
        this._detachStyles = attachPageStyles(
            ['/css/main.css', '/css/auth.css', '/css/login.css'],
            'sign-in'
        );

        return super.init();
    }

    addEventListeners() {
        this._destroyPasswordToggle = initPasswordToggle(this.el);

        const form = this.el.querySelector('form[data-auth-form="login"]');

        this._destroyValidation = initAuthValidation(form, {
            onSubmit: this.handleSubmit.bind(this),
        });
    }

    removeEventListeners() {
        if (this._destroyPasswordToggle) {
            this._destroyPasswordToggle();
            this._destroyPasswordToggle = null;
        }

        if (this._destroyValidation) {
            this._destroyValidation();
            this._destroyValidation = null;
        }
    }

    async handleSubmit(authUserData) {
        try {
            const response = await authService.signIn(authUserData);
            console.log('SignIn success:', response);

            if (typeof this.context.onSuccess === 'function') {
                this.context.onSuccess(response);
            }
        } catch (error) {
            console.error('SignIn error:', error);

            const password = this.el.querySelector('#password');
            const passwordError = this.el.querySelector('#password-error');
            setError(password, passwordError, 'Не удалось выполнить вход');
        }
    }

    beforeDestroy() {
        if (this._detachStyles) {
            this._detachStyles();
            this._detachStyles = null;
        }
    }
}