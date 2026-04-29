import type { AnyRecord, TemplateFunction } from "@/types/shared.ts";

/**
 * Базовый класс для создания компонентов приложения.
 */
export class BaseComponent<TContext extends object = AnyRecord> {
  [key: string]: any;
  protected _id: string;
  el: Element;
  template: TemplateFunction<TContext>;
  context: TContext;
  parent: BaseComponent<any> | null;
  children: Map<string, BaseComponent<any>>;

  constructor(
    context: TContext,
    template: TemplateFunction<TContext>,
    parent: BaseComponent<any> | null = null,
    el: Element | null = null,
  ) {
    if (!template) {
      throw new Error("Не задан шаблон компонента");
    }

    if (!el) {
      throw new Error("Не передан корневой DOM-элемент компонента");
    }

    this._id = crypto.randomUUID?.() ?? String(Date.now());
    this.el = el;
    this.template = template;
    this.context = context;
    this.parent = parent;
    this.children = new Map();
  }

  /**
   * Рендерит HTML компонента на основе шаблона и контекста.
   */
  render(): this {
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
  addEventListeners(): void {}

  /**
   * Удаляет обработчики событий для компонента.
   * Должен быть переопределен в дочерних классах.
   * @abstract
   */
  removeEventListeners(): void {}

  /**
   * Метод, вызываемый перед уничтожением компонента.
   * Может быть переопределен в дочерних классах.
   * @abstract
   */
  beforeDestroy(): void {}

  /**
   * Инициализирует компонент: рендерит, настраивает дочерние компоненты и добавляет обработчики.
   * @returns {this} Текущий экземпляр компонента для цепочки вызовов.
   */
  init(): this {
    this.render();
    this.setupChildren();
    this.initChildren();
    this.addEventListeners();
    return this;
  }

  /**
   * Деструктор. Уничтожает компонент и освобождает ресурсы.
   */
  destroy(): void {
    this.removeEventListeners();
    this.destroyChildren();
    this.beforeDestroy();

    if (this.el) {
      this.el.innerHTML = "";
    }

    // Компонент после destroy намеренно переводится в невалидное состояние.
    this.el = null as unknown as Element;
    this.context = null as unknown as TContext;
    this.template = null as unknown as TemplateFunction<TContext>;
    this.parent = null;
  }

  /**
   * Перерисовывает компонент с новым контекстом.
   */
  refresh(newContext: TContext): this {
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
  setupChildren(): void {}

  /**
   * Инициализирует все дочерние компоненты.
   * @private
   */
  initChildren(): void {
    for (const [, child] of this.children) {
      child.init();
    }
  }

  /**
   * Обновляет все дочерние компоненты с новым контекстом.
   */
  refreshChildren(newContext: TContext): void {
    for (const [, child] of this.children) {
      child.refresh(newContext as any);
    }
  }

  /**
   * Уничтожает все дочерние компоненты.
   * @private
   */
  destroyChildren(): void {
    for (const [, child] of this.children) {
      child.destroy();
    }
    this.children.clear();
  }

  /**
   * Добавляет дочерний компонент.
   * @throws {Error} Если не указано имя компонента.
   * @throws {Error} Если не передан компонент.
   */
  addChild<TChild extends BaseComponent<any>>(
    name: string,
    component: TChild,
  ): TChild {
    if (!name) {
      throw new Error("Не указано имя дочернего компонента");
    }
    if (!component) {
      throw new Error(`Не передан дочерний компонент "${name}"`);
    }
    if (this.children.has(name)) {
      this.children.get(name)?.destroy();
    }
    this.children.set(name, component);
    return component;
  }

  /**
   * Получает дочерний компонент по имени.
   */
  getChild<TChild extends BaseComponent<any>>(name: string): TChild | null {
    return (this.children.get(name) as TChild | undefined) ?? null;
  }

  /**
   * Удаляет дочерний компонент по имени.
   */
  removeChild(name: string): void {
    const child = this.children.get(name);
    if (!child) {
      return;
    }
    child.destroy();
    this.children.delete(name);
  }
}
