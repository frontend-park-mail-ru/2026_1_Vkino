// Делаем класс MainPage
// метод render
// импорт предкомпилированный шаблон из precompiled.hbs
// Вызываем handlebars.templates["index.hbs"](data from api)
// go to innerHtml of root element
// импорт предкомпилированный шаблон header из precompiled.hbs
// Вызываем handlebars.templates["header.hbs"](data from api)
// go to innerHtml of current element

// Было
// import './Main.precompiled.js'
// const rootEl = document.getElementById('root');
// rootEl.innerHTML = Handlebars.templates['Main.hbs']();

// import '../../components/Header/Header.precompiled.js'
// const header = document.getElementById('header');
// header.innerHTML = Handlebars.templates['Header.hbs']();


import BasePage from '../BasePage.js';
import './Main.precompiled.js';

import HeaderComponent from '../../components/Header/Header.js';

export default class MainPage extends BasePage {
    constructor(context = {}, parent = null, el = null) {
        if (!el) {
            throw new Error('Main: не передан корневой элемент для MainPage');
        }

        super(
            context,
            Handlebars.templates['Main.hbs'],
            parent,
            el,
            'MainPage'
        );
    }

    setupChildren() {
        const header = this.el.querySelector('#header');

        if (!header) {
            throw new Error('Main: не найден header в шаблоне Main.hbs');
        }

        this.addChild(
            'header',
            new HeaderComponent(
                // context
                {
                    isAuthorized: this.context.isAuthorized,
                    userName: this.context.userName,
                    onSignIn: this.context.onSignIn,
                    onSignUp: this.context.onSignUp,
                },
                // template - указан в конструкторе Header
                // parent
                this,
                // el
                header
            )
        );
    }
}