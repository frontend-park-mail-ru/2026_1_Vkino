import { BaseComponent } from "@/components/BaseComponent.js";

/**
 * Базовый класс для создания страниц.
 * Расширяет функциональность BaseComponent.
 * @class
 * @extends BaseComponent
 * @abstract
 */
export default class BasePage extends BaseComponent {
  /**
   * Создает экземпляр базовой страницы.
   * @constructor
   * @param {Object} [context={}] - Контекст данных для рендеринга шаблона.
   * @param {Function} template - Функция для рендеринга Handlebars-шаблона.
   * @param {BaseComponent|null} [parent=null] - Родительский компонент.
   * @param {Element|null} [el=null] - Корневой DOM-элемент страницы.
   * @param {string|null} [title=null] - Заголовок страницы.
   */
  constructor(context = {}, template, parent = null, el = null, title = null) {
    super(context, template, parent, el);

    /**
     * Заголовок страницы.
     * @type {string|null}
     */
    this.title = title;
  }

  /**
   * Функция, вызываемая при показе страницы.
   * Должна быть переопределена в дочерних классах.
   * @abstract
   */
  onShow() {}

  /**
   * Функция, вызываемая при скрытии страницы.
   * Должная быть переопределен в дочерних классах.
   * @abstract
   */
  onHide() {}

  /**
   * Функция, вызываемая при обновлении страницы.
   * Должна быть переопределен в дочерних классах.
   * @abstract
   */
  onRefresh() {}

  /**
   * Показывает страницу и вызывает функцию onShow.
   * @returns {this} Текущий экземпляр страницы для цепочки вызовов.
   */
  show() {
    this.onShow();
    return this;
  }

  /**
   * Скрывает страницу и вызывает функцию onHide.
   * @returns {this} Текущий экземпляр страницы для цепочки вызовов.
   */
  hide() {
    this.onHide();
    return this;
  }

  /**
   * Обновляет страницу с новым контекстом и вызывает функцию onRefresh.
   * @override
   * @param {Object} [newContext={}] - Новый контекст данных для обновления страницы.
   * @returns {this} Текущий экземпляр страницы для цепочки вызовов.
   */
  refresh(newContext = {}) {
    super.refresh(newContext);
    this.onRefresh();
    return this;
  }
}
