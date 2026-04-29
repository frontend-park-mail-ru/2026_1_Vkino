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
    checked?: boolean;
    dataset: DOMStringMap;
    disabled?: boolean;
    files?: FileList | null;
    hidden?: boolean | "until-found";
    height?: number;
    style: CSSStyleDeclaration;
    width?: number;
    offsetWidth: number;
    offsetHeight: number;
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
    clientHeight: number;
    scrollTop: number;
    scrollHeight: number;
    selectionStart?: number | null;
    selectionEnd?: number | null;
    contentWindow?: WindowProxy | null;
    onload?: ((this: GlobalEventHandlers, ev: Event) => any) | null;
    src?: string;
    focus(options?: FocusOptions): void;
    blur(): void;
    reset(): void;
    scrollTo(options: ScrollToOptions): void;
    setSelectionRange(
      start: number,
      end: number,
      direction?: "forward" | "backward" | "none",
    ): void;
    getContext?(contextId: "2d"): CanvasRenderingContext2D | null;
  }

  interface Window {
    Handlebars: RuntimeHandlebars & {
      templates: Record<string, (context: Record<string, any>) => string>;
    };
  }

  const Handlebars: Window["Handlebars"];
}

export {};
