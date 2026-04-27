import { apiService } from "./api.js";

const SUPPORT_WS_BASE_PATH = "/support/tickets";

export class SupportRealtimeService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance;
    this.socket = null;
    this.handlers = {};
    this.currentTicketId = "";
  }

  connect(handlers = {}) {
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
    this._openSocket(normalizedTicketId);
  }

  unsubscribe(ticketId = this.currentTicketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId || normalizedTicketId !== this.currentTicketId) {
      return;
    }

    this.currentTicketId = "";
    this._teardownSocket({ notifyClose: false });
  }

  disconnect() {
    this.currentTicketId = "";
    this._teardownSocket({ notifyClose: false });
  }

  _handleOpen = (event) => {
    if (event.currentTarget !== this.socket) {
      return;
    }

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

  _teardownSocket({ notifyClose = false } = {}) {
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

function resolveWsBaseUrl(explicitUrl, fallbackUrl, ticketId) {
  if (!explicitUrl) {
    return fallbackUrl;
  }

  if (explicitUrl.includes("{ticketId}")) {
    return explicitUrl.replaceAll("{ticketId}", encodeURIComponent(ticketId));
  }

  if (/\/support\/tickets\/[^/]+\/subscribe/i.test(explicitUrl)) {
    return explicitUrl;
  }

  return `${explicitUrl.replace(/\/+$/, "")}/support/tickets/${encodeURIComponent(ticketId)}/subscribe`;
}

export const supportRealtimeService = new SupportRealtimeService(apiService);
