import { BaseComponent } from "@/components/BaseComponent.ts";
import "./Pagination.precompiled.js";

export default class PaginationComponent extends BaseComponent {
  constructor(
    context: AnyRecord = {},
    parent: BaseComponent | null = null,
    el: Element | null = null,
  ) {
    if (!parent) {
      throw new Error(
        "Pagination: не передан parent для PaginationComponent",
      );
    }

    if (!el) {
      throw new Error("Pagination: не передан el для PaginationComponent");
    }

    super(context, Handlebars.templates["Pagination.hbs"], parent, el);
  }
}
