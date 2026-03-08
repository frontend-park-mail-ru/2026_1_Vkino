import BasePage from '../BasePage.js';
import './Main.precompiled.js';

import { ApiService } from '../../js/api.js';
import { MovieService } from '../../js/MovieService.js';

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

    init() {
        super.init()
        this.loadContext()
    }

    async loadContext() {
        const apiService = new ApiService("http://localhost:3000")
        const movieService = new MovieService(apiService)

        const [top, newmovies, popular] = await Promise.all([
            movieService.GetSelectionByTitle("new"),
            movieService.GetSelectionByTitle("new"),
            movieService.GetSelectionByTitle("popular")
        ])
        console.log(top)
        const newContext = {
            ...this.context,
            top,
            newmovies,
            popular
        }

        this.refresh(newContext)
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
                    ...this.context.userData,
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