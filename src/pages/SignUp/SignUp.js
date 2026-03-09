import BasePage from '../BasePage.js';
import './SignUp.precompiled.js';

import { attachPageStyles } from '../../utils/pageStyles.js';
import { initPasswordToggle } from '../../js/password/eye-btn.js';
import { initAuthValidation, setError } from '../../js/password/validation.js';
import { initRegisterBottleEffect } from '../../js/register.js';
import { authStore } from '../../store/authStore.js';

export default class SignUpPage extends BasePage {
    constructor(context = {}, parent = null, el = null) {
        if (!el) {
            throw new Error('SignUp: не передан корневой элемент для SignUp');
        }

        super(
            context,
            Handlebars.templates['SignUp.hbs'],
            parent,
            el,
            'SignUpPage'
        );

        this._detachStyles = null;
        this._destroyPasswordToggle = null;
        this._destroyValidation = null;
        this._destroyBottleEffect = null;
    }

    init() {
        this._detachStyles = attachPageStyles(
            [
                '/css/main.css',
                '/css/auth.css',
                '/css/register.css',
            ],
            'sign-up'
        );

        return super.init();
    }

    addEventListeners() {
        this._destroyPasswordToggle = initPasswordToggle(this.el);

        const form = this.el.querySelector('form[data-auth-form="register"]');
        this._destroyValidation = initAuthValidation(form, {
            onSubmit: this.handleSubmit.bind(this),
        });

        this._destroyBottleEffect = initRegisterBottleEffect(this.el);
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

        if (this._destroyBottleEffect) {
            this._destroyBottleEffect();
            this._destroyBottleEffect = null;
        }
    }

    async handleSubmit(authUserData) {
        const result = await authStore.signUp(authUserData);

        if (!result.ok) {
            const password = this.el.querySelector('#password');
            const passwordError = this.el.querySelector('#password-error');

            setError(
                password,
                passwordError,
                result.resp?.Error || result.resp?.message || result.error || 'Не удалось зарегистрироваться'
            );
            return;
        }

        if (typeof this.context.onSuccess === 'function') {
            this.context.onSuccess(result.resp);
        }
    }

    beforeDestroy() {
        if (this._detachStyles) {
            this._detachStyles();
            this._detachStyles = null;
        }
    }
}