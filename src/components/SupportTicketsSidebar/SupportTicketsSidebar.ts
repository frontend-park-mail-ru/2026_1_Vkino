import { BaseComponent } from "@/components/BaseComponent.ts";
import "./SupportTicketsSidebar.precompiled.js";

export default class SupportTicketsSidebarComponent extends BaseComponent {
  constructor(
    context: AnyRecord = {},
    parent: BaseComponent | null = null,
    el: Element | null = null,
  ) {
    if (!el) {
      throw new Error(
        "SupportTicketsSidebarComponent: не передан корневой элемент компонента",
      );
    }

    super(
      context,
      Handlebars.templates["SupportTicketsSidebar.hbs"],
      parent,
      el,
    );
  }

  addEventListeners() {}

  removeEventListeners() {}
}
