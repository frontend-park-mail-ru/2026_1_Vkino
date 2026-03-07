import { BaseComponent } from '../BaseComponent.js';
import './Header.precompiled.js';

export default class HeaderComponent extends BaseComponent {
    constructor(context = {}, parent = null, el = null) {
        if (!parent) {
            throw new Error('Header: не передан parent для HeaderComponent');
        }

        if (!el) {
            throw new Error('Header: не передан el для HeaderComponent');
        }

        super(context, Handlebars.templates['Header.hbs'], parent, el);
    }
}