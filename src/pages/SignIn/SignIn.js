import BasePage from '../BasePage.js';
import './SignIn.precompiled.js';

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
    }
}