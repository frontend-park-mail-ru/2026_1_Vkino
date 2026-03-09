import BasePage from '../BasePage.js';
import './SignUp.precompiled.js';

import { attachPageStyles } from '../../utils/pageStyles.js';
import { initPasswordToggle } from '../../js/password/eye-btn.js';
import { initAuthValidation, setError } from '../../js/password/validation.js';
import { initRegisterBottleEffect } from '../../js/register.js';
import { authService } from '../../js/AuthService.js';

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
        try {
            const { passwordRepeat, ...signUpData } = authUserData;

            const response = await authService.signUp(signUpData);
            console.log('SignUp success:', response);

            if (typeof this.context.onSuccess === 'function') {
                this.context.onSuccess(response);
            }
        } catch (error) {
            console.error('SignUp error:', error);

            const email = this.el.querySelector('input[type="email"]');
            const emailError = this.el.querySelector('#email-error');

            setError(email, emailError, 'Не удалось выполнить регистрацию');
        }
    }

    beforeDestroy() {
        if (this._detachStyles) {
            this._detachStyles();
            this._detachStyles = null;
        }
    }
}