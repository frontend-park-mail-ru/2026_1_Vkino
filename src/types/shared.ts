export type EntityId = string | number;

export type LooseRecord = Record<string, unknown>;

// Legacy UI state and backend normalizers in this project are intentionally open-ended.
// `AnyRecord` is limited to those dynamic boundaries to keep the migration tractable.
export type AnyRecord = Record<string, any>;

export type Cleanup = () => void;

export type TemplateFunction<TContext extends AnyRecord = AnyRecord> = (
  context: TContext,
) => string;

export interface AuthUser extends LooseRecord {
  id?: EntityId;
  email?: string;
  role?: string;
  name?: string;
  birthdate?: string;
  avatar_url?: string;
  avatarUrl?: string;
  avatar_file_key?: string;
  avatarFileKey?: string;
}

export type AuthStatus = "idle" | "loading" | "guest" | "authenticated";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
}

export interface HandlebarsRuntime {
  templates: Record<string, TemplateFunction>;
  template: (...args: unknown[]) => TemplateFunction;
}

export function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
