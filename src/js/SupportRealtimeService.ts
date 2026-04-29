import { ApiService, apiService } from "./api.ts";
import type { AnyRecord } from "@/types/shared.ts";

const SUPPORT_WS_BASE_PATH = "/support/tickets";
const SUPPORT_WS_RECONNECT_DELAY_MS = 3000;

export class SupportRealtimeService {
  [key: string]: any;

  constructor(apiServiceInstance: ApiService) {
    this.api = apiServiceInstance;
    this.socket = null;
    this.handlers = {};
    this.currentTicketId = "";
    this._reconnectTimerId = 0;
    this._shouldReconnect = false;
  }

  connect(handlers: AnyRecord = {}) {
    this.handlers = {
      ...this.handlers,
      ...handlers,
    };

    if (
      this.currentTicketId &&
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.currentTicketId) {
      this._openSocket(this.currentTicketId);
    }
  }

  subscribe(ticketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return;
    }

    if (
      this.currentTicketId === normalizedTicketId &&
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.currentTicketId = normalizedTicketId;
    this._shouldReconnect = true;
    this._openSocket(normalizedTicketId);
  }

  unsubscribe(ticketId = this.currentTicketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId || normalizedTicketId !== this.currentTicketId) {
      return;
    }

    this.currentTicketId = "";
    this._shouldReconnect = false;
    this._teardownSocket({ notifyClose: false });
  }

  disconnect() {
    this.currentTicketId = "";
    this._shouldReconnect = false;
    this._teardownSocket({ notifyClose: false });
  }

  _handleOpen = (event) => {
    if (event.currentTarget !== this.socket) {
      return;
    }

    window.clearTimeout(this._reconnectTimerId);
    this._reconnectTimerId = 0;
    this.handlers.onStatusChange?.("open");
  };

  _handleMessage = (event) => {
    if (event.currentTarget !== this.socket) {
      return;
    }

    let payload = event.data;

    if (typeof event.data === "string" && event.data.trim()) {
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = { raw: event.data };
      }
    }

    this.handlers.onMessage?.(payload);
  };

  _handleError = (event) => {
    if (event.currentTarget !== this.socket) {
      return;
    }

    this.handlers.onError?.(event);
  };

  _handleClose = (event) => {
    if (event.currentTarget !== this.socket) {
      return;
    }

    this.socket = null;
    this.handlers.onStatusChange?.("closed");

    if (this._shouldReconnect && this.currentTicketId) {
      this._scheduleReconnect();
    }
  };

  _openSocket(ticketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return;
    }

    const socketUrl = this._buildSocketUrl(normalizedTicketId);

    this._teardownSocket({ notifyClose: false });

    this.socket = new WebSocket(socketUrl);
    this.socket.addEventListener("open", this._handleOpen);
    this.socket.addEventListener("message", this._handleMessage);
    this.socket.addEventListener("error", this._handleError);
    this.socket.addEventListener("close", this._handleClose);
  }

  _teardownSocket({ notifyClose = false }: { notifyClose?: boolean } = {}) {
    window.clearTimeout(this._reconnectTimerId);
    this._reconnectTimerId = 0;

    if (!this.socket) {
      return;
    }

    const previousSocket = this.socket;

    previousSocket.removeEventListener("open", this._handleOpen);
    previousSocket.removeEventListener("message", this._handleMessage);
    previousSocket.removeEventListener("error", this._handleError);
    previousSocket.removeEventListener("close", this._handleClose);

    if (
      previousSocket.readyState === WebSocket.OPEN ||
      previousSocket.readyState === WebSocket.CONNECTING
    ) {
      previousSocket.close();
    }

    this.socket = null;

    if (notifyClose) {
      this.handlers.onStatusChange?.("closed");
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimerId || !this.currentTicketId) {
      return;
    }

    this.handlers.onStatusChange?.("reconnecting");
    this._reconnectTimerId = window.setTimeout(() => {
      this._reconnectTimerId = 0;

      if (!this._shouldReconnect || !this.currentTicketId) {
        return;
      }

      this._openSocket(this.currentTicketId);
    }, SUPPORT_WS_RECONNECT_DELAY_MS);
  }

  _buildSocketUrl(ticketId) {
    const explicitUrl = String(
      import.meta.env.VITE_SUPPORT_WS_URL || "",
    ).trim();
    const fallbackUrl = apiService.buildUrl(
      `${SUPPORT_WS_BASE_PATH}/${encodeURIComponent(ticketId)}/subscribe`,
    );
    const baseUrl = resolveWsBaseUrl(explicitUrl, fallbackUrl, ticketId);
    const wsUrl = baseUrl.replace(/^http/i, "ws");
    const url = new URL(wsUrl, window.location.origin);
    const accessToken = this.api.getAccessToken();

    if (accessToken) {
      url.searchParams.set("access_token", accessToken);
    }

    return url.toString();
  }
}

function resolveWsBaseUrl(
  explicitUrl: string,
  fallbackUrl: string,
  ticketId: string,
) {
  if (!explicitUrl) {
    return fallbackUrl;
  }

  if (explicitUrl.includes("{ticketId}")) {
    return explicitUrl.replace(
      /\{ticketId\}/g,
      encodeURIComponent(ticketId),
    );
  }

  if (/\/support\/tickets\/[^/]+\/subscribe/i.test(explicitUrl)) {
    return explicitUrl;
  }

  return `${explicitUrl.replace(/\/+$/, "")}/support/tickets/${encodeURIComponent(ticketId)}/subscribe`;
}

export const supportRealtimeService = new SupportRealtimeService(apiService);
