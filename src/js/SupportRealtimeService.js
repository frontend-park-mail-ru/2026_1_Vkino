import { apiService } from "./api.js";

const WS_PATH = "/support/ws";

export class SupportRealtimeService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance;
    this.socket = null;
    this.handlers = {};
    this.pendingTicketId = "";
    this.currentTicketId = "";
  }

  connect(handlers = {}) {
    this.handlers = {
      ...this.handlers,
      ...handlers,
    };

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const socketUrl = this._buildSocketUrl();

    this.socket = new WebSocket(socketUrl);
    this.socket.addEventListener("open", this._handleOpen);
    this.socket.addEventListener("message", this._handleMessage);
    this.socket.addEventListener("error", this._handleError);
    this.socket.addEventListener("close", this._handleClose);
  }

  subscribe(ticketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return;
    }

    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.pendingTicketId = normalizedTicketId;
      this.connect();
      return;
    }

    if (
      this.currentTicketId &&
      this.currentTicketId !== normalizedTicketId &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      this._sendAction("unsubscribe", this.currentTicketId);
    }

    this.currentTicketId = normalizedTicketId;
    this.pendingTicketId = normalizedTicketId;

    if (this.socket.readyState === WebSocket.OPEN) {
      this._sendAction("subscribe", normalizedTicketId);
    }
  }

  unsubscribe(ticketId = this.currentTicketId) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this._sendAction("unsubscribe", normalizedTicketId);
    }

    if (this.currentTicketId === normalizedTicketId) {
      this.currentTicketId = "";
    }

    if (this.pendingTicketId === normalizedTicketId) {
      this.pendingTicketId = "";
    }
  }

  disconnect() {
    if (!this.socket) {
      return;
    }

    this.unsubscribe();

    this.socket.removeEventListener("open", this._handleOpen);
    this.socket.removeEventListener("message", this._handleMessage);
    this.socket.removeEventListener("error", this._handleError);
    this.socket.removeEventListener("close", this._handleClose);
    this.socket.close();
    this.socket = null;
    this.pendingTicketId = "";
    this.currentTicketId = "";
  }

  _handleOpen = () => {
    this.handlers.onStatusChange?.("open");

    if (this.pendingTicketId) {
      this.currentTicketId = this.pendingTicketId;
      this._sendAction("subscribe", this.pendingTicketId);
    }
  };

  _handleMessage = (event) => {
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
    this.handlers.onError?.(event);
  };

  _handleClose = () => {
    this.handlers.onStatusChange?.("closed");
    this.socket = null;
  };

  _sendAction(action, ticketId) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        action,
        ticket_id: ticketId,
        ticketId: ticketId,
      }),
    );
  }

  _buildSocketUrl() {
    const explicitUrl = String(
      import.meta.env.VITE_SUPPORT_WS_URL || "",
    ).trim();
    const fallbackUrl = apiService.buildUrl(WS_PATH);
    const baseUrl = explicitUrl || fallbackUrl;
    const wsUrl = baseUrl.replace(/^http/i, "ws");
    const url = new URL(wsUrl, window.location.origin);
    const accessToken = this.api.getAccessToken();

    if (accessToken) {
      url.searchParams.set("access_token", accessToken);
    }

    return url.toString();
  }
}

export const supportRealtimeService = new SupportRealtimeService(apiService);
