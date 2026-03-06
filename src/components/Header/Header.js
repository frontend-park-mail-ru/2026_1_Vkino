import { BaseComponent } from '../BaseComponent.js';
import './Header.precompiled.js';
import './Header.scss';

export default class HeaderComponent extends BaseComponent {
    constructor(context = {}, parent = null, el = null) {
        if (!parent) {
            throw new Error('Не передан parent для HeaderComponent');
        }

        if (!el) {
            throw new Error('Не передан el для HeaderComponent');
        }

        super(context, Handlebars.templates['Header.hbs'], parent, el);

        this.handleSignInClick = this.handleSignInClick.bind(this);
        this.handleSignUpClick = this.handleSignUpClick.bind(this);
    }

    addEventListeners() {
        const signInButton = this.el.querySelector('[data-action="sign-in"]');
        const signUpButton = this.el.querySelector('[data-action="sign-up"]');

        if (signInButton) {
            signInButton.addEventListener('click', this.handleSignInClick);
        }

        if (signUpButton) {
            signUpButton.addEventListener('click', this.handleSignUpClick);
        }
    }

    removeEventListeners() {
        const signInButton = this.el?.querySelector('[data-action="sign-in"]');
        const signUpButton = this.el?.querySelector('[data-action="sign-up"]');

        if (signInButton) {
            signInButton.removeEventListener('click', this.handleSignInClick);
        }

        if (signUpButton) {
            signUpButton.removeEventListener('click', this.handleSignUpClick);
        }
    }

    handleSignInClick(event) {
        event.preventDefault();

        if (typeof this.context.onSignIn === 'function') {
            this.context.onSignIn();
            return;
        }

        window.location.href = '/sign-in';
    }

    handleSignUpClick(event) {
        event.preventDefault();

        if (typeof this.context.onSignUp === 'function') {
            this.context.onSignUp();
            return;
        }

        window.location.href = '/sign-up';
    }
}