import type { AnyRecord } from "@/types/shared.ts";

export interface SupportTicket extends AnyRecord {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  attachmentFileKey: string;
  attachmentName: string;
  rating: number;
  categoryPrimary: string;
  categorySecondary: string;
  categoryKey: string;
}

export interface SupportMessage extends AnyRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  sentAt: string;
  text: string;
  attachmentFileKey: string;
  attachmentName: string;
  isFromAdmin: boolean;
  isFromCurrentUser: boolean;
}

export interface SupportStatistics extends AnyRecord {
  total: number;
  openCount: number;
  inProgressCount: number;
  waitingUserCount: number;
  resolvedCount: number;
  closedCount: number;
  averageRating: number;
}

export interface SupportSelectOption extends AnyRecord {
  value: string;
  label: string;
  selectedAttr?: string;
}

export interface SupportCurrentUser extends AnyRecord {
  id: string;
  email: string;
  role: string;
  displayName: string;
  isStaff: boolean;
  isAdmin: boolean;
}

export interface SupportViewSnapshot extends AnyRecord {
  searchQuery: string;
  statusFilter: string;
  categoryFilter: string;
  statusOptions: SupportSelectOption[];
  categoryOptions: SupportSelectOption[];
  filteredTickets: SupportTicket[];
  selectedTicketId: string;
  selectedTicket: SupportTicket | null;
  selectedMessages: SupportMessage[];
  allTickets: SupportTicket[];
  statistics: SupportStatistics;
  statisticsCards: AnyRecord[];
  currentUser: SupportCurrentUser;
}

export interface SupportUiState extends AnyRecord {
  noticeTone?: string;
  noticeMessage?: string;
  replyDraft?: string;
  replyError?: string;
  replyFileMeta?: string;
  ratingError?: string;
  ratingValue?: string | number;
}

export interface SupportActionResult extends AnyRecord {
  ok: boolean;
  status: number;
  error: string;
  aborted: boolean;
  blocked: boolean;
  snapshot: SupportViewSnapshot;
  message?: string;
}
