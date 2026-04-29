import { BaseComponent } from "@/components/BaseComponent.ts";
import type { AnyRecord, TemplateFunction } from "@/types/shared.ts";

/**
 * Базовый класс для создания страниц.
 * Расширяет функциональность BaseComponent.
 * @class
 * @extends BaseComponent
 * @abstract
 */
export default class BasePage extends BaseComponent {
  title: string | null;
  /**
   * Создает экземпляр базовой страницы.
   * @constructor
   * @param {Object} [context={}] - Контекст данных для рендеринга шаблона.
   * @param {Function} template - Функция для рендеринга Handlebars-шаблона.
   * @param {BaseComponent|null} [parent=null] - Родительский компонент.
   * @param {Element|null} [el=null] - Корневой DOM-элемент страницы.
   * @param {string|null} [title=null] - Заголовок страницы.
   */
  constructor(
    context: AnyRecord = {},
    template: TemplateFunction<AnyRecord>,
    parent: BaseComponent | null = null,
    el: Element | null = null,
    title: string | null = null,
  ) {
    super(context, template, parent, el);
    this.title = title;
  }

  /**
   * Функция, вызываемая при показе страницы.
   * Должна быть переопределена в дочерних классах.
   * @abstract
   */
  onShow(): void {}

  /**
   * Функция, вызываемая при скрытии страницы.
   * Должная быть переопределен в дочерних классах.
   * @abstract
   */
  onHide(): void {}

  /**
   * Функция, вызываемая при обновлении страницы.
   * Должна быть переопределен в дочерних классах.
   * @abstract
   */
  onRefresh(): void {}

  /**
   * Показывает страницу и вызывает функцию onShow.
   * @returns {this} Текущий экземпляр страницы для цепочки вызовов.
   */
  show(): this {
    this.onShow();
    return this;
  }

  /**
   * Скрывает страницу и вызывает функцию onHide.
   * @returns {this} Текущий экземпляр страницы для цепочки вызовов.
   */
  hide(): this {
    this.onHide();
    return this;
  }

  /**
   * Обновляет страницу с новым контекстом и вызывает функцию onRefresh.
   * @override
   */
  refresh(newContext: AnyRecord = {}): this {
    super.refresh(newContext);
    this.onRefresh();
    return this;
  }
}
