// BaseComponent.js
export class BaseComponent {

    // Конструктор базового компонента
    constructor(context = {}, template, parent = null, el = null) {
        // У наследников должен быть свой render
        if (!template) {
            throw new Error('Не задан шаблон компонента');
        }

        if (!el) {
            throw new Error('Не передан корневой DOM-элемент компонента');
        }
        
        this._id = crypto.randomUUID?.() ?? String(Date.now());
        // Непосредственно наш компонент
        this.el = el;
        // Шаблон .hbs
        this.template = template;
        // JSON 
        this.context = context;
        // Родительский компонент, вызвавший наше окно
        this.parent = parent;
        // Вложенные компоненты (механизм для страниц и компонентов)
        this.children = new Map();
    }

    // Универсальная функция render
    render() {
        const html = this.template({
            //распаковка
            ...this.context,
            // служебные данные
            _componentId: this._id,
            _timestamp: Date.now()
        });
        // подставляем компонент
        this.el.innerHTML = html;
        return this;
    }

    // Метод, добавляющий обработчики событий для компонента.
    addEventListeners() {}

    // Метод, удаляющий обработчики событий для компонента.
    removeEventListeners() {}

    // 
    beforeDestroy() {}

    // Инициализация
    init() {
        // Рендер
        this.render();

        this.setupChildren();
        this.initChildren();

        this.addEventListeners();
        return this;
    }

    // Деструктор
    destroy() {
        this.removeEventListeners();
        this.destroyChildren();
        this.beforeDestroy();

        if (this.el) {
            this.el.innerHTML = '';
        }

        this.el = null;
        this.context = null;
        this.template = null;
        this.parent = null;
    }

    // Rerender
    refresh(newContext) {
        this.removeEventListeners();
        this.destroyChildren();
        this.context = {
            ...this.context,
            ...newContext
        };
        this.render();

        this.setupChildren();
        this.initChildren();

        this.addEventListeners();
        return this;
    }

    // Работа с вложенным компонентами

    // указываем дочерние объекты
    setupChildren() {}

    initChildren() {
        for (const [, child] of this.children) {
            child.init();
        }
    }

    refreshChildren(newContext = {}) {
        for (const [, child] of this.children) {
            child.refresh(newContext);
        }
    }

    destroyChildren() {
        for (const [, child] of this.children) {
            child.destroy();
        }
        this.children.clear();
    }

    addChild(name, component) {
        if (!name) {
            throw new Error('Не указано имя дочернего компонента');
        }
        if (!component) {
            throw new Error(`Не передан дочерний компонент "${name}"`);
        }
        if (this.children.has(name)) {
            this.children.get(name).destroy();
        }
        this.children.set(name, component);
        return component;
    }

    getChild(name) {
        return this.children.get(name) ?? null;
    }

    removeChild(name) {
        const child = this.children.get(name);
        if (!child) {
            return;
        }
        child.destroy();
        this.children.delete(name);
    }

}