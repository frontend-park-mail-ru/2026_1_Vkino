import Handlebars from "handlebars/runtime";
import { registerServiceWorker } from "./js/serviceWorker.js";

window.Handlebars = Handlebars;

registerServiceWorker();

await import("./main.js");
