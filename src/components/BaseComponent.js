// BaseComponent.js

/**
 * Базовый класс для создания компонентов приложения.
 * @class
 * @abstract
 */
export class BaseComponent {
  /**
   * Создает экземпляр базового компонента.
   * @constructor
   * @param {Object} [context={}] - Контекст данных для рендеринга шаблона.
   * @param {Function} template - Прекомпилированная функция шаблона Handlebars. 
   * @param {BaseComponent|null} [parent=null] - Родительский компонент.
   * @param {Element|null} [el=null] - Корневой DOM-элемент компонента.
   * @throws {Error} Если не задан шаблон компонента.
   * @throws {Error} Если не передан корневой DOM-элемент.
   */
  constructor(context = {}, template, parent = null, el = null) {
    if (!template) {
      throw new Error("Не задан шаблон компонента");
    }

    if (!el) {
      throw new Error("Не передан корневой DOM-элемент компонента");
    }

    /**
     * Уникальный идентификатор компонента.
     * @private
     * @type {string}
     */
    this._id = crypto.randomUUID?.() ?? String(Date.now());
    
    /**
     * Корневой DOM-элемент компонента.
     * @type {Element}
     */
    this.el = el;
    
    /**
     * Прекомпилированная функция шаблона Handlebars.
     * @type {Function}
     */
    this.template = template;
    
    /**
     * Контекст данных для рендеринга.
     * @type {Object}
     */
    this.context = context;
    
    /**
     * Родительский компонент.
     * @type {BaseComponent|null}
     */
    this.parent = parent;
    
    /**
     * Коллекция дочерних компонентов.
     * @type {Map<string, BaseComponent>}
     */
    this.children = new Map();
  }

  /**
   * Рендерит HTML компонента на основе шаблона и контекста.
   * @returns {this} Текущий экземпляр компонента для цепочки вызовов.
   */
  render() {
    const html = this.template({
      ...this.context,
    });
    this.el.innerHTML = html;
    return this;
  }

  /**
   * Добавляет обработчики событий для компонента.
   * Должен быть переопределен в дочерних классах.
   * @abstract
   */
  addEventListeners() {}

  /**
   * Удаляет обработчики событий для компонента.
   * Должен быть переопределен в дочерних классах.
   * @abstract
   */
  removeEventListeners() {}

  /**
   * Метод, вызываемый перед уничтожением компонента.
   * Может быть переопределен в дочерних классах.
   * @abstract
   */
  beforeDestroy() {}

  /**
   * Инициализирует компонент: рендерит, настраивает дочерние компоненты и добавляет обработчики.
   * @returns {this} Текущий экземпляр компонента для цепочки вызовов.
   */
  init() {
    this.render();
    this.setupChildren();
    this.initChildren();
    this.addEventListeners();
    return this;
  }

  /**
   * Деструктор. Уничтожает компонент и освобождает ресурсы.
   */
  destroy() {
    this.removeEventListeners();
    this.destroyChildren();
    this.beforeDestroy();

    if (this.el) {
      this.el.innerHTML = "";
    }

    this.el = null;
    this.context = null;
    this.template = null;
    this.parent = null;
  }

  /**
   * Перерисовывает компонент с новым контекстом.
   * @param {Object} newContext - Новый контекст данных.
   * @returns {this} Текущий экземпляр компонента для цепочки вызовов.
   */
  refresh(newContext) {
    this.removeEventListeners();
    this.destroyChildren();
    this.context = {
      ...newContext,
    };
    this.init();
    return this;
  }

  /**
   * Настраивает (добавляет) дочерние компоненты.
   * Должен быть переопределен в дочерних классах.
   * @abstract
   */
  setupChildren() {}

  /**
   * Инициализирует все дочерние компоненты.
   * @private
   */
  initChildren() {
    for (const [, child] of this.children) {
      child.init();
    }
  }

  /**
   * Обновляет все дочерние компоненты с новым контекстом.
   * @param {Object} [newContext={}] - Новый контекст для дочерних компонентов.
   */
  refreshChildren(newContext = {}) {
    for (const [, child] of this.children) {
      child.refresh(newContext);
    }
  }

  /**
   * Уничтожает все дочерние компоненты.
   * @private
   */
  destroyChildren() {
    for (const [, child] of this.children) {
      child.destroy();
    }
    this.children.clear();
  }

  /**
   * Добавляет дочерний компонент.
   * @param {string} name - Имя дочернего компонента.
   * @param {BaseComponent} component - Экземпляр дочернего компонента.
   * @returns {BaseComponent} Добавленный дочерний компонент.
   * @throws {Error} Если не указано имя компонента.
   * @throws {Error} Если не передан компонент.
   */
  addChild(name, component) {
    if (!name) {
      throw new Error("Не указано имя дочернего компонента");
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

  /**
   * Получает дочерний компонент по имени.
   * @param {string} name - Имя дочернего компонента.
   * @returns {BaseComponent|null} Найденный компонент или null.
   */
  getChild(name) {
    return this.children.get(name) ?? null;
  }

  /**
   * Удаляет дочерний компонент по имени.
   * @param {string} name - Имя дочернего компонента для удаления.
   */
  removeChild(name) {
    const child = this.children.get(name);
    if (!child) {
      return;
    }
    child.destroy();
    this.children.delete(name);
  }
}
