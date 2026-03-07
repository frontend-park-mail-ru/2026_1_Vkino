import BasePage from '../BasePage.js';
import './SignUp.precompiled.js';

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
    }
}