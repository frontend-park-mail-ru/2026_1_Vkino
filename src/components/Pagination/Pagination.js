import { BaseComponent } from "@/components/BaseComponent.js";
import "./Pagination.precompiled.js";

export default class PaginationComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
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
