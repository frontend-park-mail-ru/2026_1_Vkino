import { Router } from "./Router.ts";

const rootEl = document.getElementById("root");

if (!(rootEl instanceof Element)) {
  throw new Error("router/index.ts: Не найден #root");
}

export const router = new Router(rootEl);
