declare module "*.scss";

declare module "*.precompiled.js" {
  const ignored: unknown;
  export default ignored;
}

declare global {
  type RuntimeHandlebars = typeof import("handlebars/runtime");
  type AnyRecord = Record<string, any>;

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_MEDIA_BASE_URL?: string;
    readonly VITE_SUPPORT_WS_URL?: string;
    readonly VITE_APP_BUILD_ID?: string;
  }

  interface Element {
    value?: string;
    style: CSSStyleDeclaration;
    offsetWidth: number;
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
    scrollTop: number;
    scrollHeight: number;
  }

  interface Window {
    Handlebars: RuntimeHandlebars & {
      templates: Record<string, (context: Record<string, any>) => string>;
    };
  }

  const Handlebars: Window["Handlebars"];
}

export {};
