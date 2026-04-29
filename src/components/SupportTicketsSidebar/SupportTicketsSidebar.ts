// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import { BaseComponent } from "@/components/BaseComponent.ts";
import "./SupportTicketsSidebar.precompiled.js";

export default class SupportTicketsSidebarComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
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
