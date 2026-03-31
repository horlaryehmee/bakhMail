"use client";

import {
  BellDot,
  CalendarDays,
  CornerDownLeft,
  Download,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessagesSquare,
  Mic,
  Moon,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  Square,
  Sun,
  Trash2,
  Users,
  UserPlus,
  X
} from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";

import { apiBaseUrl, apiRequest, assetUrl } from "@/lib/api";
import type {
  Attachment,
  BrandingSettings,
  Comment,
  DemoDataStatus,
  NotificationPreferences,
  NotificationItem,
  PendingInvite,
  Priority,
  Project,
  ProjectPreviewType,
  ProjectStatus,
  RequestItem,
  RequestStatus,
  Session,
  Summary,
  Task,
  TaskStatus,
  User,
  UserRole
} from "@/lib/types";
import { cn, formatShortDate, initials, isOverdue, labelize, relativeDate } from "@/lib/utils";
import { AuthScreen } from "./auth-screen";
import { BrandMark } from "./brand-mark";
import { DeadlineCalendar } from "./deadline-calendar";
import { KanbanBoard } from "./kanban-board";
import {
  AvatarStack,
  Button,
  EmptyState,
  FieldLabel,
  Modal,
  SectionCard,
  SelectField,
  StatCard,
  StatusPill,
  TextArea,
  TextField,
  ToastItem,
  ToastViewport
} from "./ui";

const priorities: Priority[] = ["low", "medium", "high", "urgent"];
const projectStatuses: ProjectStatus[] = ["not_started", "in_progress", "completed"];
const taskStatuses: TaskStatus[] = ["todo", "in_progress", "review", "completed"];
const requestStatuses: RequestStatus[] = ["open", "planned", "in_progress", "completed"];
type WorkspaceView = "overview" | "projects" | "tasks" | "collaboration" | "timeline" | "users" | "account";
const desktopPreviewWidth = 1280;
const desktopPreviewHeight = 760;
const desktopPreviewChrome = 52;
const defaultNotificationPreferences: NotificationPreferences = {
  comments: true,
  requests: true,
  deadlines: true,
  activity: true
};
const defaultBranding: BrandingSettings = {
  brandName: "Bakhtech Solutions",
  logoUrl: "",
  logoSize: 1
};
const voiceNoteMimeTypeOptions = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg", "audio/mpeg"];

function resolveInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("bakhtech.theme");

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return "light";
}

function applyThemeToDocument(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = "only light";
  document.documentElement.dataset.theme = theme;
}

function useInviteToken() {
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setInviteToken(params.get("invite"));
  }, []);

  return inviteToken;
}

function WorkspaceNavButton({
  active,
  label,
  icon: Icon,
  onClick,
  badge
}: {
  active: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
        active
          ? "bg-accent-500 text-white dark:bg-lime-500 dark:text-ink"
          : "ui-hover-surface text-slate-600 dark:text-slate-300"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {badge !== undefined ? (
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-bold",
            active ? "bg-white/20 text-white dark:bg-ink/10 dark:text-ink" : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-300"
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function WorkspaceTabButton({
  active,
  label,
  icon: Icon,
  onClick,
  badge
}: {
  active: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-[18px] border px-2.5 py-2 text-left text-xs font-semibold transition",
        active
          ? "border-accent-400 bg-accent-500 text-white dark:border-lime-400 dark:bg-lime-500 dark:text-ink"
          : "ui-hover-surface border-slate-200/70 bg-white/70 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl",
          active ? "bg-white/20 text-white dark:bg-ink/10 dark:text-ink" : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-300"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
      {badge !== undefined ? (
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-bold",
            active ? "bg-white/20 text-white dark:bg-ink/10 dark:text-ink" : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-300"
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function MobileDockButton({
  active,
  label,
  icon: Icon,
  onClick,
  badge
}: {
  active: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  onClick: () => void;
  badge?: string | number;
}) {
  const showBadge = badge !== undefined && badge !== 0 && badge !== "0";
  const badgeLabel = typeof badge === "number" && badge > 9 ? "9+" : badge;

  return (
    <button
      aria-label={label}
      className={cn(
        "relative flex h-9 shrink-0 items-center justify-center rounded-[16px] transition-all duration-200",
        active
          ? "w-auto gap-2 bg-accent-500 px-3 text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] dark:bg-lime-500 dark:text-ink dark:shadow-[0_12px_28px_rgba(132,204,22,0.18)]"
          : "ui-hover-icon w-9 text-slate-500 dark:text-slate-300"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span
        className={cn(
          "whitespace-nowrap text-[11px] font-semibold transition-all duration-200",
          active ? "max-w-[72px] opacity-100" : "max-w-0 opacity-0"
        )}
      >
        {label}
      </span>
      {showBadge ? (
        <span className="absolute right-0 top-0 min-w-[18px] translate-x-[28%] -translate-y-[28%] rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-900">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}

function UserDirectoryList({
  users,
  projectCounts,
  canEdit,
  onEdit
}: {
  users: User[];
  projectCounts: Record<string, number>;
  canEdit?: boolean;
  onEdit?: (user: User) => void;
}) {
  return (
    <div className="space-y-3">
      {users.length ? (
        users.map((user) => {
          const projectCount = projectCounts[user._id] ?? 0;
          const accountTypeLabel = user.role === "client" ? "Client account" : "Internal account";

          return (
            <div key={user._id} className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_190px_120px_180px] xl:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="avatar-token flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700 dark:bg-lime-500/15 dark:text-lime-300">
                      {initials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{user.name}</p>
                      <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{user.email || "Private email"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={labelize(user.role)}
                    tone={user.role === "master_admin" ? "success" : user.role === "admin" ? "info" : "default"}
                  />
                  <StatusPill label={accountTypeLabel} tone={user.role === "client" ? "default" : "info"} />
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Projects</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">{projectCount}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Account</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">Own login</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.title || "No job title yet"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={user.isActive === false ? "Inactive" : "Active"} tone={user.isActive === false ? "warning" : "success"} />
                </div>

                {canEdit && onEdit ? (
                  <Button onClick={() => onEdit(user)} variant="secondary">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit user
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })
      ) : (
        <EmptyState description="No people match the current search or filter." title="No users found" />
      )}
    </div>
  );
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function matchesUserSearch(user: User, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  return [user.name, user.email, user.title ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function mapSelectedUsers(users: User[], selectedIds: string[]) {
  const userMap = new Map(users.map((user) => [user._id, user]));
  return selectedIds.map((id) => userMap.get(id)).filter(Boolean) as User[];
}

function filterProjectPickerUsers(users: User[], selectedIds: string[], query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return users.filter((user) => !selectedIds.includes(user._id) && matchesUserSearch(user, normalizedQuery)).slice(0, 8);
}

function ProjectPeoplePicker({
  title,
  description,
  searchPlaceholder,
  users,
  totalCount,
  selectedUsers,
  searchValue,
  onSearchChange,
  onSelect,
  onRemove,
  results,
  inviteRole,
  inviteLabel,
  canInvite,
  onInvite,
  onResend,
  pendingInvites,
  lockedInviteMessage,
  actionsDisabled
}: {
  title: string;
  description: string;
  searchPlaceholder: string;
  users: User[];
  totalCount: number;
  selectedUsers: User[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (userId: string) => void;
  onRemove: (userId: string) => void;
  results: User[];
  inviteRole?: UserRole;
  inviteLabel?: string;
  canInvite?: boolean;
  onInvite?: (email: string, role: UserRole) => void;
  onResend?: (inviteId: string) => void;
  pendingInvites: GeneratedInviteState[];
  lockedInviteMessage?: string;
  actionsDisabled?: boolean;
}) {
  const normalizedSearch = searchValue.trim();
  const normalizedSearchEmail = normalizedSearch.toLowerCase();
  const exactMatch = users.some((user) => user.email.toLowerCase() === normalizedSearchEmail);
  const canInviteEmail = Boolean(inviteRole && canInvite && looksLikeEmail(normalizedSearch) && !exactMatch);

  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <StatusPill label={`${selectedUsers.length} selected`} tone={selectedUsers.length ? "info" : "default"} />
      </div>

      <div className="mt-4">
        <FieldLabel>Search accounts</FieldLabel>
        <TextField onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} value={searchValue} />
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Selected</p>
        {selectedUsers.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <button
                key={user._id}
                className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-600 dark:bg-lime-500 dark:text-ink dark:hover:bg-lime-400"
                onClick={() => onRemove(user._id)}
                type="button"
              >
                <span className="max-w-[180px] truncate">{user.name}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[20px] border border-dashed border-slate-300/70 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Search by name, email, or title to add from {totalCount} account{totalCount === 1 ? "" : "s"}.
          </div>
        )}
      </div>

      {normalizedSearch ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Matches</p>
          {results.length ? (
            <div className="scrollbar-thin mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {results.map((user) => {
                const disabled = user.isActive === false;

                return (
                  <button
                    key={user._id}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition",
                      disabled
                        ? "cursor-not-allowed border-slate-200/70 bg-slate-50/70 text-slate-400 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-500"
                        : "border-slate-200/70 bg-white/70 hover:border-accent-300 hover:bg-accent-500/[0.04] dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-lime-400/50 dark:hover:bg-lime-500/[0.06]"
                    )}
                    disabled={disabled}
                    onClick={() => onSelect(user._id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{user.name}</p>
                      <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                      {user.title ? <p className="mt-1 truncate text-xs text-slate-400">{user.title}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill label={labelize(user.role)} tone={user.role === "client" ? "default" : "info"} />
                      {disabled ? <StatusPill label="Inactive" tone="warning" /> : null}
                      <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">Add</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-[20px] border border-dashed border-slate-300/70 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No matching accounts yet. {canInviteEmail ? "You can generate an invite for this email below." : "Try another name or email."}
            </div>
          )}
        </div>
      ) : null}

      {inviteRole ? (
        canInvite ? (
          canInviteEmail ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-accent-300/70 bg-accent-500/[0.05] p-4 dark:border-lime-400/50 dark:bg-lime-500/[0.08]">
              <p className="font-semibold text-slate-900 dark:text-white">Invite a new {inviteLabel}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {normalizedSearch} is not in the workspace yet. Generate a direct invite link now and share it while you finish setting up the project.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={() => onInvite?.(normalizedSearch, inviteRole)} variant="secondary">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite {inviteLabel}
                </Button>
              </div>
            </div>
          ) : null
        ) : lockedInviteMessage ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-slate-300/70 bg-slate-50/70 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300">
            {lockedInviteMessage}
          </div>
        ) : null
      ) : null}

      {pendingInvites.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Pending invites from this setup</p>
          {pendingInvites.map((invite) => (
            <div key={`${invite.role}:${invite.email}`} className="rounded-[20px] border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{invite.email}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Invite ready for {labelize(invite.role)}. They will appear in search after they register.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {onResend ? (
                    <Button disabled={actionsDisabled} onClick={() => onResend(invite.id)} variant="ghost">
                      <CornerDownLeft className="mr-2 h-4 w-4" />
                      Resend
                    </Button>
                  ) : null}
                  <Button
                    disabled={actionsDisabled}
                    onClick={() => void navigator.clipboard.writeText(invite.inviteLink).catch(() => undefined)}
                    variant="secondary"
                  >
                    Copy link
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DesktopReviewFrame({
  title,
  previewType,
  url,
  imageUrl,
  videoUrl
}: {
  title: string;
  previewType?: ProjectPreviewType;
  url?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateViewport = () => {
      setViewportWidth(node.clientWidth);
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }

    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const effectivePreviewType =
    previewType && previewType !== "none"
      ? previewType
      : videoUrl
        ? "video"
        : imageUrl
          ? "image"
          : url
            ? "website"
            : "none";
  const scale = Math.min((viewportWidth || desktopPreviewWidth) / desktopPreviewWidth, 1);
  let addressLabel = "desktop review";

  if (url) {
    try {
      addressLabel = new URL(url).host.replace(/^www\./, "");
    } catch {
      addressLabel = url;
    }
  }

  if (effectivePreviewType === "image") {
    return (
      <div className="w-full">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-3 shadow-[0_22px_50px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[28px]">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Preview</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Image review</p>
            </div>
            <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Screenshot
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200/70 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            {imageUrl ? (
              <img alt={title} className="block h-[250px] w-full object-cover object-top sm:h-[300px] xl:h-[340px]" src={assetUrl(imageUrl)} />
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-slate-500 dark:text-slate-300 sm:h-[300px] xl:h-[340px]">
                Preview image not configured yet
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (effectivePreviewType === "video") {
    return (
      <div className="w-full">
        <div className="rounded-[24px] border border-slate-200/70 bg-white p-3 shadow-[0_22px_50px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[28px]">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Preview</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Video review</p>
            </div>
            <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Motion
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200/70 bg-slate-950 dark:border-slate-800">
            {videoUrl ? (
              <video
                className="block h-[250px] w-full bg-black object-cover sm:h-[300px] xl:h-[340px]"
                controls
                preload="metadata"
                src={assetUrl(videoUrl)}
              />
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-slate-300 sm:h-[300px] xl:h-[340px]">
                Preview video not configured yet
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (effectivePreviewType === "none") {
    return (
      <div className="w-full rounded-[24px] border border-dashed border-slate-300/70 bg-white/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-950/35">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Preview</p>
        <h3 className="mt-3 font-display text-3xl text-slate-900 dark:text-white">No preview added</h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This project can still be managed normally even without a website or media preview.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-[24px] border border-slate-200/70 bg-white p-2 shadow-[0_22px_50px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[28px] sm:p-3">
        <div ref={containerRef} className="relative h-[190px] overflow-hidden rounded-[20px] border border-slate-200/70 bg-white sm:h-[220px] lg:h-[250px] xl:h-[280px] dark:border-slate-800 dark:bg-slate-950">
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${desktopPreviewWidth}px`
            }}
          >
            <div className="flex h-[52px] items-center justify-between border-b border-slate-200/80 bg-slate-50 px-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="min-w-0 max-w-[420px] rounded-full border border-slate-200/80 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <span className="block truncate">{addressLabel}</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Desktop</div>
            </div>
            <div className="bg-white">
              {url ? (
                <iframe className="block h-[760px] w-[1280px] bg-white" loading="lazy" referrerPolicy="no-referrer" src={url} title={`${title} desktop review`} />
              ) : imageUrl ? (
                <img alt={title} className="block h-[760px] w-[1280px] object-cover object-top" src={assetUrl(imageUrl)} />
              ) : (
                <div className="flex h-[760px] w-[1280px] items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                  Preview not configured yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function taskProjectId(task: Task) {
  return typeof task.project === "string" ? task.project : task.project._id;
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function inferProjectPreviewType(project?: Pick<Project, "previewType" | "previewUrl" | "previewImageUrl" | "previewVideoUrl"> | null): ProjectPreviewType {
  if (!project) return "website";
  if (project.previewType) return project.previewType;
  if (project.previewVideoUrl) return "video";
  if (project.previewImageUrl) return "image";
  if (project.previewUrl) return "website";
  return "none";
}

function attachmentMatchesPreviewType(attachment: Pick<Attachment, "mimeType" | "name">, previewType: ProjectPreviewType) {
  const mimeType = attachment.mimeType.toLowerCase();
  const fileName = attachment.name.toLowerCase();

  if (previewType === "image") {
    return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(fileName);
  }

  if (previewType === "video") {
    return mimeType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(fileName);
  }

  return false;
}

function resolveProjectPreviewFields(form: ProjectFormState, attachments: Attachment[]) {
  const previewImageUrl =
    form.previewImageUrl.trim() ||
    attachments.find((attachment) => attachmentMatchesPreviewType(attachment, "image"))?.url ||
    "";
  const previewVideoUrl =
    form.previewVideoUrl.trim() ||
    attachments.find((attachment) => attachmentMatchesPreviewType(attachment, "video"))?.url ||
    "";

  if (form.previewType === "website") {
    return {
      previewType: "website" as const,
      previewUrl: form.previewUrl.trim(),
      previewImageUrl: "",
      previewVideoUrl: ""
    };
  }

  if (form.previewType === "image") {
    return {
      previewType: "image" as const,
      previewUrl: "",
      previewImageUrl,
      previewVideoUrl: ""
    };
  }

  if (form.previewType === "video") {
    return {
      previewType: "video" as const,
      previewUrl: "",
      previewImageUrl: "",
      previewVideoUrl
    };
  }

  return {
    previewType: "none" as const,
    previewUrl: "",
    previewImageUrl: "",
    previewVideoUrl: ""
  };
}

function getProjectPreviewAction(project?: Pick<Project, "previewType" | "previewUrl" | "previewImageUrl" | "previewVideoUrl"> | null) {
  const previewType = inferProjectPreviewType(project);

  if (previewType === "website" && project?.previewUrl) {
    return { href: project.previewUrl, label: "Open website" };
  }

  if (previewType === "image" && project?.previewImageUrl) {
    return { href: assetUrl(project.previewImageUrl), label: "Open image" };
  }

  if (previewType === "video" && project?.previewVideoUrl) {
    return { href: assetUrl(project.previewVideoUrl), label: "Open video" };
  }

  return null;
}

function dueDateTime(value?: string | null) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatChatTimestamp(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isAudioLikeFile(item: { mimeType?: string; name: string }) {
  const mimeType = item.mimeType?.toLowerCase() ?? "";
  if (mimeType) {
    return mimeType.startsWith("audio/");
  }

  return /\.(mp3|ogg|wav|m4a|aac|webm)$/i.test(item.name);
}

function summarizeChatMessage(content: string, attachments: Array<{ mimeType?: string; name: string }> = []) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized) {
    return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
  }

  if (attachments.some((attachment) => isAudioLikeFile(attachment))) {
    return "Voice note";
  }

  if (attachments.length === 1) {
    return attachments[0].name;
  }

  if (attachments.length > 1) {
    return `${attachments.length} attachments`;
  }

  return "Message";
}

function sameFile(left: File, right: File) {
  return left.name === right.name && left.size === right.size && left.lastModified === right.lastModified;
}

function mergeSelectedFiles(existing: File[], incoming: File[]) {
  const next = [...existing];

  for (const file of incoming) {
    if (!next.some((current) => sameFile(current, file))) {
      next.push(file);
    }
  }

  return next.slice(0, 10);
}

function resolveVoiceNoteExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("aac")) return "aac";
  return "webm";
}

function canPlayRecordedMimeType(mimeType: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const audio = document.createElement("audio");
  if (audio.canPlayType(mimeType) !== "") {
    return true;
  }

  const baseMimeType = mimeType.split(";")[0] ?? mimeType;
  return audio.canPlayType(baseMimeType) !== "";
}

function mergeFloat32AudioChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function encodeWavBlobFromSamples(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeWavString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeWavString(view, 8, "WAVE");
  writeWavString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeWavString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;

  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function encodeWavBlob(chunks: Float32Array[], sampleRate: number) {
  return encodeWavBlobFromSamples(mergeFloat32AudioChunks(chunks), sampleRate);
}

function mixAudioBufferToMono(audioBuffer: AudioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return new Float32Array(audioBuffer.getChannelData(0));
  }

  const mixed = new Float32Array(audioBuffer.length);

  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channelData = audioBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex += 1) {
      mixed[sampleIndex] += channelData[sampleIndex] / audioBuffer.numberOfChannels;
    }
  }

  return mixed;
}

function writeWavString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function AudioMessagePlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.load();
  }, [src]);

  return <audio key={src} ref={audioRef} className={className} controls preload="metadata" src={src} />;
}

function commentMatchesClientFocus(comment: Comment, clientId: string) {
  if (clientId === "all") {
    return true;
  }

  const authorId = comment.author._id || comment.author.id || "";
  const mentionIds = comment.mentions.map((user) => user._id || user.id || "");
  const replyAuthorId = comment.replyTo?.author?._id || comment.replyTo?.author?.id || "";

  return authorId === clientId || mentionIds.includes(clientId) || replyAuthorId === clientId;
}

function requestMatchesClientFocus(request: RequestItem, clientId: string) {
  if (clientId === "all") {
    return true;
  }

  const createdById = request.createdBy._id || request.createdBy.id || "";
  const sourceAuthorId = request.sourceComment?.author?._id || request.sourceComment?.author?.id || "";

  return createdById === clientId || sourceAuthorId === clientId;
}

function isCollaborationNotification(notification: NotificationItem) {
  return notification.entityType === "comment" || notification.entityType === "request";
}

function buildRequestTitleFromComment(comment: Pick<Comment, "content">) {
  const plainText = comment.content
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) {
    return "Follow-up request";
  }

  const trimmed = plainText.length > 72 ? `${plainText.slice(0, 72).trim()}...` : plainText;
  return trimmed;
}

function projectTone(status: ProjectStatus) {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  return "default";
}

function priorityTone(priority: Priority) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "default";
}

type ProjectFormState = {
  name: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  type: string;
  startDate: string;
  deadline: string;
  previewType: ProjectPreviewType;
  previewUrl: string;
  previewImageUrl: string;
  previewVideoUrl: string;
  tags: string;
  teamMembers: string[];
  clients: string[];
  attachments: Attachment[];
};

type TaskFormState = {
  project: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  dueDate: string;
  milestone: boolean;
  tags: string;
  subtasks: string;
  attachments: Attachment[];
};

type ProfileFormState = {
  name: string;
  email: string;
  title: string;
  notificationPreferences: NotificationPreferences;
};

type UserEditFormState = {
  name: string;
  email: string;
  title: string;
  role: UserRole;
  isActive: boolean;
};

type UserPasswordResetFormState = {
  newPassword: string;
  confirmPassword: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type BrandingFormState = {
  brandName: string;
  logoUrl: string;
  logoSize: number;
};

type GeneratedInviteState = {
  id: string;
  email: string;
  role: UserRole;
  inviteLink: string;
  expiresAt?: string;
  createdAt?: string;
};

const emptyProjectForm = (): ProjectFormState => ({
  name: "",
  summary: "",
  description: "",
  status: "not_started",
  priority: "medium",
  type: "Website",
  startDate: "",
  deadline: "",
  previewType: "website",
  previewUrl: "",
  previewImageUrl: "",
  previewVideoUrl: "",
  tags: "",
  teamMembers: [],
  clients: [],
  attachments: []
});

const emptyTaskForm = (): TaskFormState => ({
  project: "",
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee: "",
  dueDate: "",
  milestone: false,
  tags: "",
  subtasks: "",
  attachments: []
});

const emptyProfileForm = (): ProfileFormState => ({
  name: "",
  email: "",
  title: "",
  notificationPreferences: { ...defaultNotificationPreferences }
});

const emptyUserEditForm = (): UserEditFormState => ({
  name: "",
  email: "",
  title: "",
  role: "client",
  isActive: true
});

const emptyUserPasswordResetForm = (): UserPasswordResetFormState => ({
  newPassword: "",
  confirmPassword: ""
});

const emptyPasswordForm = (): PasswordFormState => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const emptyBrandingForm = (): BrandingFormState => ({
  brandName: defaultBranding.brandName,
  logoUrl: "",
  logoSize: defaultBranding.logoSize
});

type WorkspaceNavItem = {
  id: WorkspaceView;
  label: string;
  icon: typeof LayoutDashboard;
};

const workspaceNav: WorkspaceNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "collaboration", label: "Chat & Requests", icon: MessagesSquare },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "users", label: "Users", icon: Users },
  { id: "account", label: "Account", icon: Settings2 }
];

const clientWorkspaceNav: WorkspaceNavItem[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Project", icon: FolderKanban },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "collaboration", label: "Chat & Requests", icon: MessagesSquare },
  { id: "timeline", label: "Updates", icon: BellDot },
  { id: "account", label: "Account", icon: Settings2 }
];

const workspaceViewCopy: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Workspace Snapshot",
    title: "See what needs attention first",
    description: "Start with progress, workload, and deadline risk before deciding where to drill in."
  },
  projects: {
    eyebrow: "Project Hub",
    title: "Browse one client delivery at a time",
    description: "Project details, website previews, and uploaded media stay together so clients and admins are not juggling separate sections."
  },
  tasks: {
    eyebrow: "Delivery Board",
    title: "Move active work without leaving the board",
    description: "Focus on one selected task while the realtime board stays visible for fast execution."
  },
  collaboration: {
    eyebrow: "Chat & Requests",
    title: "Chat and client requests in one place",
    description: "Project chat, approvals, change requests, and team notes stay grouped around the active project."
  },
  timeline: {
    eyebrow: "Deadlines & Alerts",
    title: "Track what changed and what is due next",
    description: "Notifications, activity, and deadlines share one planning view instead of being buried lower in the page."
  },
  users: {
    eyebrow: "People Directory",
    title: "See every client and internal user clearly",
    description: "Master admins and admins can review the people in the workspace without digging through invites or project assignments."
  },
  account: {
    eyebrow: "Account",
    title: "Update profile and preferences",
    description: "Manage personal details, notification preferences, and password settings."
  }
};

const clientWorkspaceViewCopy: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Client Dashboard",
    title: "Everything your team needs at a glance",
    description: "See project status, progress, deadlines, and the next actions without digging through internal delivery tools."
  },
  projects: {
    eyebrow: "Project Overview",
    title: "Review the latest preview and track delivery",
    description: "See the latest website, image, or video preview alongside project summary, assigned team, and milestone progress."
  },
  tasks: {
    eyebrow: "Tasks & Milestones",
    title: "Follow work that matters to your project",
    description: "Read task status clearly, focus on milestone deadlines, and filter the work that needs your attention."
  },
  collaboration: {
    eyebrow: "Chat & Requests",
    title: "Chat clearly and track requests when needed",
    description: "Use chat for normal back-and-forth updates, then turn important messages into tracked requests when action is needed."
  },
  timeline: {
    eyebrow: "Notifications & Activity",
    title: "Stay informed in real time",
    description: "See fresh updates, completed milestones, and upcoming deadlines as they happen."
  },
  users: {
    eyebrow: "Users",
    title: "People connected to your workspace",
    description: "This view is only available to internal admins."
  },
  account: {
    eyebrow: "Profile & Settings",
    title: "Manage your account",
    description: "Update your profile, change your password, and choose which notifications you want to receive."
  }
};

const notificationPreferenceOptions: Array<{
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}> = [
  {
    key: "comments",
    title: "Comments",
    description: "Get notified when your team responds with feedback or approvals."
  },
  {
    key: "requests",
    title: "Requests",
    description: "Stay updated when a submitted request changes status."
  },
  {
    key: "deadlines",
    title: "Deadlines",
    description: "Receive alerts before key tasks or milestones are due."
  },
  {
    key: "activity",
    title: "Activity feed",
    description: "See broader project activity beyond direct comments and requests."
  }
];

export function DashboardApp() {
  const inviteToken = useInviteToken();

  const [theme, setTheme] = useState<"light" | "dark">(() => resolveInitialTheme());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: UserRole; status: "pending" | "accepted" | "expired" } | null>(null);
  const [demoDataStatus, setDemoDataStatus] = useState<DemoDataStatus | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditing, setProjectEditing] = useState<Project | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskEditing, setTaskEditing] = useState<Task | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userEditing, setUserEditing] = useState<User | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("client");
  const [projectTeamSearch, setProjectTeamSearch] = useState("");
  const [projectClientSearch, setProjectClientSearch] = useState("");
  const [selectedAdminClientId, setSelectedAdminClientId] = useState<string>("all");
  const [projectSetupInvites, setProjectSetupInvites] = useState<GeneratedInviteState[]>([]);
  const [userEditForm, setUserEditForm] = useState<UserEditFormState>(emptyUserEditForm);
  const [userPasswordResetForm, setUserPasswordResetForm] = useState<UserPasswordResetFormState>(emptyUserPasswordResetForm);
  const [commentDraft, setCommentDraft] = useState("");
  const [feedbackComposerMode, setFeedbackComposerMode] = useState<"comment" | "request">("comment");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [requestSourceCommentId, setRequestSourceCommentId] = useState<string | null>(null);
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [voiceNotePreviewUrl, setVoiceNotePreviewUrl] = useState<string | null>(null);
  const [voiceNoteFileName, setVoiceNoteFileName] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("open");
  const [requestPriority, setRequestPriority] = useState<Priority>("medium");
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [brandingForm, setBrandingForm] = useState<BrandingFormState>(emptyBrandingForm);
  const [brandingFiles, setBrandingFiles] = useState<File[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<string>("all");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceRecorderModeRef = useRef<"media_recorder" | "wav" | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceAudioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceMonitorGainRef = useRef<GainNode | null>(null);
  const voiceAudioChunksRef = useRef<Float32Array[]>([]);
  const voiceSampleRateRef = useRef(44100);
  const voiceNoteSaveOnStopRef = useRef(false);
  const hasAutoPromptedMicrophoneRef = useRef(false);
  const microphonePermissionInFlightRef = useRef(false);

  const currentRole = session?.user.role ?? "client";
  const deferredProjectTeamSearch = useDeferredValue(projectTeamSearch);
  const deferredProjectClientSearch = useDeferredValue(projectClientSearch);
  const isClientWorkspace = currentRole === "client";
  const isAdminWorkspace = currentRole === "master_admin" || currentRole === "admin";
  const isMasterAdminWorkspace = currentRole === "master_admin";
  const canManageProjects = isAdminWorkspace;
  const canManageTasks = isAdminWorkspace;
  const canManageRequests = isAdminWorkspace;
  const canInviteUsers = isAdminWorkspace;

  function pushToast(title: string, description?: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, title, description }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }

  function persistSession(nextSession: Session | null) {
    setSession(nextSession);
    if (typeof window === "undefined") return;
    if (nextSession) {
      window.localStorage.setItem("bakhtech.session", JSON.stringify(nextSession));
    } else {
      window.localStorage.removeItem("bakhtech.session");
    }
  }

  async function fetchBranding() {
    try {
      const response = await apiRequest<{ branding: BrandingSettings }>("/settings/branding");
      setBranding(response.branding);
      setBrandingForm({
        brandName: response.branding.brandName ?? defaultBranding.brandName,
        logoUrl: response.branding.logoUrl ?? "",
        logoSize: response.branding.logoSize ?? defaultBranding.logoSize
      });
    } catch {
      setBranding(defaultBranding);
      setBrandingForm(emptyBrandingForm());
    }
  }

  async function refreshWorkspace(token: string, silent = false) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const me = await apiRequest<{ user: User }>("/auth/me", { token });
      const canViewPendingInvites = me.user.role === "master_admin" || me.user.role === "admin";
      const canManageDemoData = me.user.role === "master_admin";
      const [usersData, summaryData, projectsData, tasksData, commentsData, requestsData, notificationsData, pendingInvitesData, demoDataStatusData] =
        await Promise.all([
          apiRequest<{ users: User[] }>("/auth/users", { token }),
          apiRequest<Summary>("/dashboard/summary", { token }),
          apiRequest<{ projects: Project[] }>("/projects", { token }),
          apiRequest<{ tasks: Task[] }>("/tasks", { token }),
          apiRequest<{ comments: Comment[] }>("/comments", { token }),
          apiRequest<{ requests: RequestItem[] }>("/requests", { token }),
          apiRequest<{ notifications: NotificationItem[] }>("/notifications", { token }),
          canViewPendingInvites ? apiRequest<{ invites: PendingInvite[] }>("/auth/pending-invites", { token }) : Promise.resolve({ invites: [] }),
          canManageDemoData ? apiRequest<{ demoData: DemoDataStatus }>("/settings/demo-data", { token }) : Promise.resolve({ demoData: null as DemoDataStatus | null })
        ]);

      startTransition(() => {
        persistSession({ token, user: me.user });
        setPendingInvites(pendingInvitesData.invites);
        setUsers(usersData.users);
        setSummary(summaryData);
        setProjects(projectsData.projects);
        setTasks(tasksData.tasks);
        setComments(commentsData.comments);
        setRequests(requestsData.requests);
        setNotifications(notificationsData.notifications);
        setDemoDataStatus(canManageDemoData ? demoDataStatusData.demoData : null);
        setSelectedProjectId((current) => {
          if (current && projectsData.projects.some((project) => project._id === current)) {
            return current;
          }
          return projectsData.projects[0]?._id ?? null;
        });
      });
      setError(null);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Unable to load workspace";
      setError(message);
      setDemoDataStatus(null);
      setPendingInvites([]);
      persistSession(null);
    } finally {
      setLoading(false);
      setWorking(false);
    }
  }

  async function uploadAttachments(files: File[]) {
    if (!session?.token || files.length === 0) return [];
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await apiRequest<{ attachments: Attachment[] }>("/uploads", {
      method: "POST",
      token: session.token,
      body: formData
    });
    return response.attachments;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextTheme = resolveInitialTheme();
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);
    void fetchBranding();

    const storedSession = window.localStorage.getItem("bakhtech.session");
    if (storedSession) {
      const parsed = JSON.parse(storedSession) as Session;
      void refreshWorkspace(parsed.token);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    applyThemeToDocument(theme);
    window.localStorage.setItem("bakhtech.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const brandTitle = branding.brandName?.trim() || defaultBranding.brandName;
    document.title = `${brandTitle} Workspace`;
  }, [branding.brandName]);

  useEffect(() => {
    if (!inviteToken || session?.token) return;
    void apiRequest<{ invite: { email: string; role: UserRole; status: "pending" | "accepted" | "expired" } }>(`/auth/invites/${inviteToken}`)
      .then((response) => setInviteInfo(response.invite))
      .catch(() => setInviteInfo(null));
  }, [inviteToken, session?.token]);

  useEffect(() => {
    if (!session?.user) return;

    setProfileForm({
      name: session.user.name,
      email: session.user.email,
      title: session.user.title ?? "",
      notificationPreferences: session.user.notificationPreferences ?? { ...defaultNotificationPreferences }
    });
  }, [session?.user]);

  useEffect(() => {
    if (session?.token) return;
    hasAutoPromptedMicrophoneRef.current = false;
  }, [session?.token]);

  useEffect(() => {
    const allowedRoles: UserRole[] = currentRole === "master_admin" ? ["master_admin", "admin", "client"] : ["client"];
    if (allowedRoles.includes(inviteRole)) return;
    setInviteRole(allowedRoles[0] ?? "client");
  }, [currentRole, inviteRole]);

  useEffect(() => {
    if (!session?.token) return;

    const refresh = () => void refreshWorkspace(session.token!, true);
    const interval = window.setInterval(refresh, 30000);
    const handleFocus = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.token]);

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task._id === selectedTaskId && taskProjectId(task) === selectedProjectId)) {
      setSelectedTaskId(null);
    }
  }, [selectedProjectId, selectedTaskId, tasks]);

  useEffect(() => {
    if (replyToCommentId && !comments.some((comment) => comment._id === replyToCommentId)) {
      setReplyToCommentId(null);
    }
  }, [comments, replyToCommentId]);

  useEffect(() => {
    if (requestSourceCommentId && !comments.some((comment) => comment._id === requestSourceCommentId)) {
      setRequestSourceCommentId(null);
    }
  }, [comments, requestSourceCommentId]);

  useEffect(() => {
    if (requestSourceCommentId && selectedProjectId) {
      const sourceComment = comments.find((comment) => comment._id === requestSourceCommentId);
      if (sourceComment && sourceComment.project !== selectedProjectId) {
        setRequestSourceCommentId(null);
      }
    }
  }, [comments, requestSourceCommentId, selectedProjectId]);

  useEffect(() => {
    if (feedbackComposerMode !== "comment") return;
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [comments.length, feedbackComposerMode, selectedProjectId, selectedTaskId]);

  useEffect(() => {
    if (selectedAdminClientId === "all") return;
    const projectHasClient = projects.some(
      (project) => project._id === selectedProjectId && project.clients.some((client) => client._id === selectedAdminClientId)
    );
    if (!projectHasClient) {
      setSelectedAdminClientId("all");
    }
  }, [projects, selectedAdminClientId, selectedProjectId]);

  useEffect(() => {
    if (activeView !== "collaboration") return;
    const unreadCollaborationIds = notifications
      .filter((notification) => !notification.readAt && isCollaborationNotification(notification))
      .map((notification) => notification._id);
    if (!unreadCollaborationIds.length) return;
    void markNotificationsRead(unreadCollaborationIds);
  }, [activeView, notifications]);

  useEffect(() => {
    if (activeView !== "collaboration" || !session?.token || hasAutoPromptedMicrophoneRef.current) return;
    hasAutoPromptedMicrophoneRef.current = true;
    void ensureMicrophonePermission({ auto: true });
  }, [activeView, session?.token]);

  useEffect(() => {
    if (!isRecordingVoiceNote || activeView === "collaboration") return;
    stopVoiceNoteRecording(false);
  }, [activeView, isRecordingVoiceNote]);

  useEffect(() => {
    return () => {
      if (voiceNotePreviewUrl) {
        URL.revokeObjectURL(voiceNotePreviewUrl);
      }
    };
  }, [voiceNotePreviewUrl]);

  useEffect(() => {
    return () => {
      voiceNoteSaveOnStopRef.current = false;
      const recorder = voiceRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    };
  }, []);

  const selectedProject = projects.find((project) => project._id === selectedProjectId) ?? null;
  const selectedTask = tasks.find((task) => task._id === selectedTaskId) ?? null;
  const showWorkspaceHero = activeView === "overview";
  const showWorkspaceFilters = activeView === "projects" || activeView === "tasks";
  const showWorkspaceLead = false;
  const appliedSearch = showWorkspaceFilters ? search.trim().toLowerCase() : "";
  const appliedProjectFilter = !isClientWorkspace || activeView === "projects" ? projectFilter : "all";
  const appliedTaskStatusFilter = activeView === "tasks" ? taskStatusFilter : "all";
  const appliedPriorityFilter = showWorkspaceFilters ? priorityFilter : "all";
  const searchPlaceholder =
    activeView === "tasks"
      ? "Search tasks or milestones"
      : isClientWorkspace
        ? "Search your projects"
        : "Search projects or tasks";
  const visibleProjects = projects.filter((project) => {
    const matchesSearch = !appliedSearch || `${project.name} ${project.summary}`.toLowerCase().includes(appliedSearch);
    const matchesStatus = appliedProjectFilter === "all" || project.status === appliedProjectFilter;
    const matchesPriority = appliedPriorityFilter === "all" || project.priority === appliedPriorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const visibleTasks = tasks
    .filter((task) => (selectedProjectId ? taskProjectId(task) === selectedProjectId : true))
    .filter((task) => (!appliedSearch ? true : `${task.title} ${task.description}`.toLowerCase().includes(appliedSearch)))
    .filter((task) => (appliedTaskStatusFilter === "all" ? true : task.status === appliedTaskStatusFilter))
    .filter((task) => (appliedPriorityFilter === "all" ? true : task.priority === appliedPriorityFilter));
  const relevantComments = comments.filter((comment) =>
    selectedTaskId
      ? comment.task === selectedTaskId
      : selectedProjectId
        ? comment.project === selectedProjectId
        : false
  );
  const chatMessages = [...relevantComments].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const relevantRequests = requests.filter((request) => {
    const projectId = typeof request.project === "string" ? request.project : request.project._id;
    return selectedProjectId ? projectId === selectedProjectId : false;
  });
  const currentUserId = session?.user._id ?? session?.user.id ?? "";
  const selectedCollaborationClient =
    isAdminWorkspace && selectedAdminClientId !== "all"
      ? selectedProject?.clients.find((client) => client._id === selectedAdminClientId) ?? null
      : null;
  const collaborationChatMessages =
    isAdminWorkspace && selectedCollaborationClient
      ? chatMessages.filter((comment) => commentMatchesClientFocus(comment, selectedCollaborationClient._id))
      : chatMessages;
  const collaborationRequests =
    isAdminWorkspace && selectedCollaborationClient
      ? relevantRequests.filter((request) => requestMatchesClientFocus(request, selectedCollaborationClient._id))
      : relevantRequests;
  const feedbackParticipants = (selectedProject ? [...selectedProject.teamMembers, ...selectedProject.clients] : users).filter(
    (user, index, collection) => user._id !== currentUserId && collection.findIndex((candidate) => candidate._id === user._id) === index
  );
  const feedbackParticipantsForComposer =
    isAdminWorkspace && selectedCollaborationClient
      ? [selectedCollaborationClient, ...feedbackParticipants.filter((user) => user._id !== selectedCollaborationClient._id)]
      : feedbackParticipants;
  const feedbackContextLabel = selectedTask
    ? `${selectedTask.title} in ${selectedProject?.name ?? "this project"}`
    : selectedProject
      ? selectedCollaborationClient
        ? `${selectedProject.name} · ${selectedCollaborationClient.name}`
        : selectedProject.name
      : "Select a project";
  const replyTargetComment = replyToCommentId ? comments.find((comment) => comment._id === replyToCommentId) ?? null : null;
  const requestSourceComment = requestSourceCommentId ? comments.find((comment) => comment._id === requestSourceCommentId) ?? null : null;
  const userProjectCounts = projects.reduce<Record<string, number>>((accumulator, project) => {
    const participantIds = new Set<string>([
      ...(project.createdBy?._id ? [project.createdBy._id] : []),
      ...project.teamMembers.map((user) => user._id),
      ...project.clients.map((user) => user._id)
    ]);

    participantIds.forEach((id) => {
      accumulator[id] = (accumulator[id] ?? 0) + 1;
    });

    return accumulator;
  }, {});
  const directorySearchValue = directorySearch.trim().toLowerCase();
  const sortedDirectoryUsers = [...users].sort((left, right) => {
    const roleOrder = { master_admin: 0, admin: 1, client: 2 } satisfies Record<UserRole, number>;
    const roleDifference = roleOrder[left.role] - roleOrder[right.role];
    return roleDifference !== 0 ? roleDifference : left.name.localeCompare(right.name);
  });
  const visibleDirectoryUsers = sortedDirectoryUsers.filter((user) => {
    const matchesSearch =
      !directorySearchValue ||
      `${user.name} ${user.email} ${user.title ?? ""}`.toLowerCase().includes(directorySearchValue);

    if (!matchesSearch) return false;
    if (directoryRoleFilter === "all") return true;
    if (directoryRoleFilter === "internal") return user.role !== "client";
    return user.role === directoryRoleFilter;
  });
  const masterAdminUsers = users.filter((user) => user.role === "master_admin");
  const adminUsers = users.filter((user) => user.role === "admin");
  const clientUsers = users.filter((user) => user.role === "client");
  const internalProjectAccounts = [...users.filter((user) => user.role !== "client")].sort((left, right) => left.name.localeCompare(right.name));
  const clientProjectAccounts = [...users.filter((user) => user.role === "client")].sort((left, right) => left.name.localeCompare(right.name));
  const selectedProjectTeamUsers = mapSelectedUsers(internalProjectAccounts, projectForm.teamMembers);
  const selectedProjectClientUsers = mapSelectedUsers(clientProjectAccounts, projectForm.clients);
  const filteredProjectTeamUsers = filterProjectPickerUsers(internalProjectAccounts, projectForm.teamMembers, deferredProjectTeamSearch);
  const filteredProjectClientUsers = filterProjectPickerUsers(clientProjectAccounts, projectForm.clients, deferredProjectClientSearch);
  const pendingInternalProjectInvites = projectSetupInvites.filter((invite) => invite.role !== "client");
  const pendingClientProjectInvites = projectSetupInvites.filter((invite) => invite.role === "client");
  const inviteRoleOptions: UserRole[] = isMasterAdminWorkspace ? ["master_admin", "admin", "client"] : ["client"];
  const activeViewCopy = (isClientWorkspace ? clientWorkspaceViewCopy : workspaceViewCopy)[activeView];
  const workspaceNavItems = isClientWorkspace ? clientWorkspaceNav : workspaceNav;
  const unreadNotificationsCount = notifications.filter((notification) => !notification.readAt).length;
  const unreadCollaborationNotificationIds = notifications
    .filter((notification) => !notification.readAt && isCollaborationNotification(notification))
    .map((notification) => notification._id);
  const unreadCollaborationCount = unreadCollaborationNotificationIds.length;
  const unreadTimelineCount = notifications.filter((notification) => !notification.readAt && !isCollaborationNotification(notification)).length;
  const selectedProjectTaskCount = selectedProjectId ? tasks.filter((task) => taskProjectId(task) === selectedProjectId).length : 0;
  const selectedProjectTasks = selectedProjectId ? tasks.filter((task) => taskProjectId(task) === selectedProjectId) : [];
  const selectedProjectMilestones = selectedProjectTasks.filter((task) => task.milestone);
  const selectedProjectCompletedTasks = selectedProjectTasks.filter((task) => task.status === "completed").length;
  const selectedProjectOpenRequests = relevantRequests.filter((request) => request.status !== "completed").length;
  const completedProjects = [...projects]
    .filter((project) => project.status === "completed")
    .sort((left, right) => dueDateTime(left.deadline) - dueDateTime(right.deadline));
  const collaborationOpenRequests = collaborationRequests.filter((request) => request.status !== "completed").length;
  const selectedProjectPreview = getProjectPreviewAction(selectedProject);
  const selectedProjectPreviewType = inferProjectPreviewType(selectedProject);
  const clientVisibleTasks = [...visibleTasks].sort((left, right) => dueDateTime(left.dueDate) - dueDateTime(right.dueDate));
  const clientOpenTasks = clientVisibleTasks.filter((task) => task.status !== "completed");
  const clientCompletedTasks = clientVisibleTasks.filter((task) => task.status === "completed");
  const recentClientActivity = selectedProjectId
    ? (summary?.recentActivity ?? [])
        .filter((activity) => activity.project === selectedProjectId || activity.entityId === selectedProjectId)
        .slice(0, 6)
    : (summary?.recentActivity ?? []).slice(0, 6);
  const selectedProjectProgressValue =
    selectedProjectTasks.length > 0 ? Math.round((selectedProjectCompletedTasks / selectedProjectTasks.length) * 100) : (selectedProject?.progress ?? 0);
  const visibleMilestones = visibleTasks.filter((task) => task.milestone);
  const clientVisibleMilestones = [...visibleMilestones].sort((left, right) => dueDateTime(left.dueDate) - dueDateTime(right.dueDate));
  const upcomingClientDeadlines = visibleTasks
    .filter((task) => task.dueDate)
    .sort((left, right) => dueDateTime(left.dueDate) - dueDateTime(right.dueDate))
    .slice(0, 5);
  const clientCompletedMilestones = selectedProjectMilestones.filter((task) => task.status === "completed").length;
  const clientTimelineTasks = selectedProjectId ? selectedProjectTasks : summary?.upcomingDeadlines ?? [];
  const brandName = branding.brandName?.trim() || defaultBranding.brandName;
  const workspaceTitle = isClientWorkspace ? `${brandName} Client Portal` : `${brandName} Admin`;
  const workspaceDescription = isClientWorkspace
    ? "Review progress, previews, chat, and requests from one straightforward client workspace."
    : "A clearer workspace with focused admin views for projects, communication, users, and delivery.";
  const userName = session?.user.name ?? "Team";
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const heroTitle =
    currentRole === "client"
      ? `${firstName}, your workspace is ready`
      : currentRole === "master_admin"
        ? `${firstName}, here's the control room`
        : `${firstName}, here's today's admin view`;
  const heroDescription = selectedProject
    ? currentRole === "client"
      ? `You're focused on ${selectedProject.name}. Review progress, check the latest preview, and send feedback from one place.`
      : `You're focused on ${selectedProject.name}. Move between tasks, comments, and deadlines without losing context.`
    : currentRole === "client"
      ? "Review progress, review the latest deliverables, and send requests without digging through the dashboard."
      : currentRole === "master_admin"
        ? "See delivery, clients, admins, and live communication from one place."
        : "Track live work, unblock delivery, and keep clients aligned from one place.";
  const mobileHeroTitle =
    currentRole === "client"
      ? `${firstName}, your project updates`
      : currentRole === "master_admin"
        ? `${firstName}, control overview`
        : `${firstName}, today's updates`;
  const mobileHeroDescription = selectedProject
    ? `${selectedProject.name} is ${selectedProject.progress}% complete.`
    : currentRole === "client"
      ? "Check progress and send feedback quickly."
      : "Move through active work without digging through the page.";
  const heroHighlights = [
    {
      label: selectedProject ? "Current project" : "Projects",
      value: selectedProject ? selectedProject.name : `${visibleProjects.length} active`
    },
    {
      label: currentRole === "client" ? "Requests" : "Tasks",
      value: currentRole === "client" ? `${summary?.stats.openRequests ?? 0} open` : `${selectedProject ? selectedProjectTaskCount : visibleTasks.length} in focus`
    },
    {
      label: "Alerts",
      value: unreadNotificationsCount ? `${unreadNotificationsCount} new` : "All clear"
    }
  ];

  function workspaceBadge(view: WorkspaceView) {
    if (view === "collaboration") return unreadCollaborationCount || undefined;
    if (view === "timeline") return unreadTimelineCount || undefined;
    if (view === "tasks") return visibleTasks.length;
    if (view === "users" && !isClientWorkspace) return users.length;
    return undefined;
  }

  function openProjectWorkspace(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedTaskId(null);
    setActiveView("projects");
  }

  function openTaskWorkspace(task: Task) {
    setSelectedProjectId(taskProjectId(task));
    setSelectedTaskId(task._id);
    setActiveView("tasks");
  }

  function handleMobilePrimaryAction() {
    if (activeView === "users" && canInviteUsers) {
      setInviteModalOpen(true);
      return;
    }

    if (activeView === "tasks" && canManageTasks) {
      openTaskModal();
      return;
    }

    if (canManageProjects) {
      openProjectModal();
      return;
    }

    if (canManageTasks) {
      openTaskModal();
    }
  }

  function handleProjectCardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, projectId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openProjectWorkspace(projectId);
  }

  async function handleLogin(email: string, password: string) {
    setWorking(true);
    setError(null);
    try {
      const response = await apiRequest<Session>("/auth/login", { method: "POST", body: { email, password } });
      persistSession(response);
      await refreshWorkspace(response.token, true);
      pushToast("Signed in", `Workspace ready for ${response.user.name}.`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
      setWorking(false);
    }
  }

  async function handleRegister(payload: { token: string; name: string; password: string }) {
    setWorking(true);
    setError(null);
    try {
      const response = await apiRequest<Session>("/auth/register-invite", { method: "POST", body: payload });
      persistSession(response);
      await refreshWorkspace(response.token, true);
      pushToast("Invite accepted", "Your account is ready.");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register");
      setWorking(false);
    }
  }

  async function handleSignOut() {
    persistSession(null);
    setProjects([]);
    setTasks([]);
    setComments([]);
    setRequests([]);
    setNotifications([]);
    setSummary(null);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    setReplyToCommentId(null);
    setRequestSourceCommentId(null);
    setError(null);
  }

  function openProjectModal(project?: Project) {
    if (project) {
      setProjectEditing(project);
      setProjectForm({
        name: project.name,
        summary: project.summary,
        description: project.description,
        status: project.status,
        priority: project.priority,
        type: project.type,
        startDate: toDateInput(project.startDate),
        deadline: toDateInput(project.deadline),
        previewType: inferProjectPreviewType(project),
        previewUrl: project.previewUrl ?? "",
        previewImageUrl: project.previewImageUrl ?? "",
        previewVideoUrl: project.previewVideoUrl ?? "",
        tags: project.tags.join(", "),
        teamMembers: project.teamMembers.map((user) => user._id),
        clients: project.clients.map((user) => user._id),
        attachments: project.attachments ?? []
      });
    } else {
      setProjectEditing(null);
      setProjectForm(emptyProjectForm());
    }

    setProjectFiles([]);
    setProjectTeamSearch("");
    setProjectClientSearch("");
    setProjectSetupInvites([]);
    setProjectModalOpen(true);
  }

  function openTaskModal(task?: Task) {
    if (task) {
      setTaskEditing(task);
      setTaskForm({
        project: taskProjectId(task),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee?._id ?? "",
        dueDate: toDateInput(task.dueDate),
        milestone: task.milestone,
        tags: task.tags.join(", "),
        subtasks: task.subtasks.map((subtask) => subtask.title).join("\n"),
        attachments: task.attachments ?? []
      });
    } else {
      setTaskEditing(null);
      setTaskForm({ ...emptyTaskForm(), project: selectedProjectId ?? projects[0]?._id ?? "" });
    }

    setTaskFiles([]);
    setTaskModalOpen(true);
  }

  function openUserModal(user: User) {
    setUserEditing(user);
    setUserEditForm({
      name: user.name,
      email: user.email,
      title: user.title ?? "",
      role: user.role,
      isActive: user.isActive ?? true
    });
    setUserPasswordResetForm(emptyUserPasswordResetForm());
    setUserModalOpen(true);
  }

  function closeUserModal() {
    setUserModalOpen(false);
    setUserEditing(null);
    setUserEditForm(emptyUserEditForm());
    setUserPasswordResetForm(emptyUserPasswordResetForm());
  }

  function toggleSelection(values: string[], id: string) {
    return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
  }

  async function handleProjectSubmit() {
    if (!session?.token) return;

    setWorking(true);

    try {
      const uploaded = await uploadAttachments(projectFiles);
      const attachments = [...projectForm.attachments, ...uploaded];
      const previewFields = resolveProjectPreviewFields(projectForm, attachments);
      const payload = {
        ...projectForm,
        ...previewFields,
        tags: projectForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        startDate: projectForm.startDate || null,
        deadline: projectForm.deadline || null,
        attachments
      };

      if (projectEditing) {
        await apiRequest(`/projects/${projectEditing._id}`, {
          method: "PATCH",
          token: session.token,
          body: payload
        });
        pushToast("Project updated", `${projectForm.name} was updated.`);
      } else {
        await apiRequest("/projects", {
          method: "POST",
          token: session.token,
          body: payload
        });
        pushToast("Project created", `${projectForm.name} is now in the workspace.`);
      }

      setProjectModalOpen(false);
      await refreshWorkspace(session.token, true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save project");
      setWorking(false);
    }
  }

  async function handleTaskSubmit() {
    if (!session?.token) return;

    setWorking(true);

    try {
      const uploaded = await uploadAttachments(taskFiles);
      const payload = {
        ...taskForm,
        assignee: taskForm.assignee || null,
        dueDate: taskForm.dueDate || null,
        tags: taskForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        subtasks: taskForm.subtasks
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((title) => ({ title, completed: false })),
        attachments: [...taskForm.attachments, ...uploaded]
      };

      if (taskEditing) {
        await apiRequest(`/tasks/${taskEditing._id}`, {
          method: "PATCH",
          token: session.token,
          body: payload
        });
        pushToast("Task updated", `${taskForm.title} was updated.`);
      } else {
        await apiRequest("/tasks", {
          method: "POST",
          token: session.token,
          body: payload
        });
        pushToast("Task created", `${taskForm.title} was added to the board.`);
      }

      setTaskModalOpen(false);
      await refreshWorkspace(session.token, true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save task");
      setWorking(false);
    }
  }

  async function createInvite(email: string, role: UserRole) {
    if (!session?.token) {
      throw new Error("Authentication required");
    }

    return apiRequest<{ invite: GeneratedInviteState }>("/auth/invite", {
      method: "POST",
      token: session.token,
      body: { email, role }
    });
  }

  async function resendInvite(inviteId: string) {
    if (!session?.token) {
      throw new Error("Authentication required");
    }

    return apiRequest<{ invite: PendingInvite }>(`/auth/invites/${inviteId}/resend`, {
      method: "POST",
      token: session.token
    });
  }

  async function handleInviteResend(inviteId: string) {
    setError(null);
    setWorking(true);

    try {
      const response = await resendInvite(inviteId);
      setPendingInvites((current) => [response.invite, ...current.filter((invite) => invite.id !== response.invite.id)]);
      setProjectSetupInvites((current) => {
        const match = current.find((invite) => invite.id === response.invite.id);

        if (!match) {
          return current;
        }

        return [response.invite, ...current.filter((invite) => invite.id !== response.invite.id)];
      });
      await navigator.clipboard.writeText(response.invite.inviteLink).catch(() => undefined);
      pushToast("Invite resent", `${response.invite.email} received a fresh invite email. The new link was copied.`);
      setWorking(false);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to resend invite");
      setWorking(false);
    }
  }

  async function handleInviteSubmit() {
    if (!session?.token) return;

    setWorking(true);

    try {
      const response = await createInvite(inviteEmail, inviteRole);
      setInviteModalOpen(false);
      setInviteEmail("");
      setPendingInvites((current) => [response.invite, ...current.filter((invite) => invite.id !== response.invite.id)]);
      pushToast("Invite created", "Visible now in Users under pending invites.");
      await navigator.clipboard.writeText(response.invite.inviteLink).catch(() => undefined);
      setWorking(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create invite");
      setWorking(false);
    }
  }

  async function handleProjectSetupInvite(email: string, role: UserRole) {
    if (!session?.token) return;

    setWorking(true);
    setError(null);

    try {
      const response = await createInvite(email.trim(), role);
      setProjectSetupInvites((current) => {
        const next = current.filter((invite) => invite.email !== response.invite.email || invite.role !== response.invite.role);
        return [response.invite, ...next];
      });
      setPendingInvites((current) => [response.invite, ...current.filter((invite) => invite.id !== response.invite.id)]);
      pushToast("Invite created", `${response.invite.email} copied to clipboard.`);
      await navigator.clipboard.writeText(response.invite.inviteLink).catch(() => undefined);
      if (role === "client") {
        setProjectClientSearch("");
      } else {
        setProjectTeamSearch("");
      }
      setWorking(false);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create project invite");
      setWorking(false);
    }
  }

  async function handleProfileSave() {
    if (!session?.token) return;

    setWorking(true);
    setError(null);

    try {
      const response = await apiRequest<Session>("/auth/me", {
        method: "PATCH",
        token: session.token,
        body: profileForm
      });

      persistSession(response);
      pushToast("Profile updated", "Your account settings were saved.");
      await refreshWorkspace(response.token, true);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Unable to save profile settings");
      setWorking(false);
    }
  }

  async function handleBrandingSave() {
    if (!session?.token || !isMasterAdminWorkspace) return;

    setWorking(true);
    setError(null);

    try {
      const uploaded = await uploadAttachments(brandingFiles);
      const nextLogoUrl = uploaded[0]?.url ?? brandingForm.logoUrl.trim();
      const response = await apiRequest<{ branding: BrandingSettings }>("/settings/branding", {
        method: "PATCH",
        token: session.token,
        body: {
          brandName: brandingForm.brandName.trim() || defaultBranding.brandName,
          logoUrl: nextLogoUrl,
          logoSize: brandingForm.logoSize
        }
      });

      setBranding(response.branding);
      setBrandingForm({
        brandName: response.branding.brandName ?? defaultBranding.brandName,
        logoUrl: response.branding.logoUrl ?? "",
        logoSize: response.branding.logoSize ?? defaultBranding.logoSize
      });
      setBrandingFiles([]);
      pushToast("Brand updated", "The workspace branding was saved.");
      setWorking(false);
    } catch (brandingError) {
      setError(brandingError instanceof Error ? brandingError.message : "Unable to save branding");
      setWorking(false);
    }
  }

  async function handlePopulateDemoData() {
    if (!session?.token || !isMasterAdminWorkspace) return;

    setWorking(true);
    setError(null);

    try {
      await apiRequest<{ demoData: DemoDataStatus }>("/settings/demo-data/populate", {
        method: "POST",
        token: session.token
      });

      pushToast("Demo data ready", "Sample users, projects, tasks, chat, and requests were added.");
      await refreshWorkspace(session.token, true);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "Unable to populate demo data");
      setWorking(false);
    }
  }

  async function handleClearDemoData() {
    if (!session?.token || !isMasterAdminWorkspace) return;

    setWorking(true);
    setError(null);

    try {
      await apiRequest<{ demoData: DemoDataStatus }>("/settings/demo-data", {
        method: "DELETE",
        token: session.token
      });

      pushToast("Demo data cleared", "All generated sample records were removed from the workspace.");
      await refreshWorkspace(session.token, true);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "Unable to clear demo data");
      setWorking(false);
    }
  }

  async function handleUserSave() {
    if (!session?.token || !userEditing || !isMasterAdminWorkspace) return;

    setWorking(true);
    setError(null);

    try {
      await apiRequest<{ user: User }>(`/auth/users/${userEditing._id}`, {
        method: "PATCH",
        token: session.token,
        body: userEditForm
      });

      closeUserModal();
      pushToast("User updated", "The user details were saved.");
      await refreshWorkspace(session.token, true);
    } catch (userError) {
      setError(userError instanceof Error ? userError.message : "Unable to save user");
      setWorking(false);
    }
  }

  async function handlePasswordSave() {
    if (!session?.token) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response = await apiRequest<Session>("/auth/password", {
        method: "PATCH",
        token: session.token,
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }
      });

      setPasswordForm(emptyPasswordForm());
      persistSession(response);
      pushToast("Password updated", "Your password has been changed.");
      await refreshWorkspace(response.token, true);
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to update password");
      setWorking(false);
    }
  }

  async function handleUserPasswordReset() {
    if (!session?.token || !userEditing || !isMasterAdminWorkspace) return;

    if (userPasswordResetForm.newPassword !== userPasswordResetForm.confirmPassword) {
      setError("Reset password and confirmation do not match");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response = await apiRequest<{ user: User; token?: string }>(`/auth/users/${userEditing._id}/password`, {
        method: "PATCH",
        token: session.token,
        body: { newPassword: userPasswordResetForm.newPassword }
      });

      setUserPasswordResetForm(emptyUserPasswordResetForm());

      if (response.token && userEditing._id === session.user._id) {
        persistSession({ token: response.token, user: response.user });
        pushToast("Login reset", "Your password was reset and older sessions were signed out.");
        await refreshWorkspace(response.token, true);
        return;
      }

      pushToast("Login reset", `${userEditing.name}'s password was reset.`);
      await refreshWorkspace(session.token, true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset login password");
      setWorking(false);
    }
  }

  async function handleTaskMove(taskId: string, status: TaskStatus) {
    if (!session?.token) return;

    const task = tasks.find((item) => item._id === taskId);
    if (!task || task.status === status) return;

    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: "PATCH",
        token: session.token,
        body: { status }
      });
      pushToast("Task updated", `${task.title} moved to ${labelize(status)}.`);
      await refreshWorkspace(session.token, true);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move task");
    }
  }

  async function handleDeleteProject(project: Project) {
    if (!session?.token || !window.confirm(`Delete ${project.name}?`)) return;
    await apiRequest(`/projects/${project._id}`, { method: "DELETE", token: session.token });
    pushToast("Project deleted", `${project.name} was removed.`);
    await refreshWorkspace(session.token, true);
  }

  async function handleDeleteTask(task: Task) {
    if (!session?.token || !window.confirm(`Delete ${task.title}?`)) return;
    await apiRequest(`/tasks/${task._id}`, { method: "DELETE", token: session.token });
    pushToast("Task deleted", `${task.title} was removed.`);
    await refreshWorkspace(session.token, true);
  }

  function clearVoiceNotePreview() {
    if (voiceNotePreviewUrl) {
      URL.revokeObjectURL(voiceNotePreviewUrl);
    }

    setVoiceNotePreviewUrl(null);
    setVoiceNoteFileName(null);
  }

  function setVoiceNotePreview(file: File) {
    clearVoiceNotePreview();
    setVoiceNotePreviewUrl(URL.createObjectURL(file));
    setVoiceNoteFileName(file.name);
  }

  function attachVoiceNoteBlob(blob: Blob, mimeType: string, fileName: string) {
    const voiceFile = new File([blob], fileName, { type: mimeType, lastModified: Date.now() });

    setCommentFiles((current) => {
      const withoutExistingVoiceNote = voiceNoteFileName ? current.filter((item) => item.name !== voiceNoteFileName) : current;
      return mergeSelectedFiles(withoutExistingVoiceNote, [voiceFile]);
    });

    clearVoiceNotePreview();
    setVoiceNotePreviewUrl(URL.createObjectURL(blob));
    setVoiceNoteFileName(fileName);
    pushToast("Voice note ready", "Your recording is attached to this message.");
  }

  async function normalizeRecordedVoiceNote(blob: Blob, mimeType: string) {
    if (mimeType === "audio/wav") {
      return { blob, mimeType, extension: "wav" };
    }

    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextConstructor) {
      return { blob, mimeType, extension: resolveVoiceNoteExtension(mimeType) };
    }

    let audioContext: AudioContext | null = null;

    try {
      audioContext = new AudioContextConstructor();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const wavBlob = encodeWavBlobFromSamples(mixAudioBufferToMono(audioBuffer), audioBuffer.sampleRate);
      return { blob: wavBlob, mimeType: "audio/wav", extension: "wav" };
    } catch {
      return { blob, mimeType, extension: resolveVoiceNoteExtension(mimeType) };
    } finally {
      void audioContext?.close().catch(() => {});
    }
  }

  function buildMicrophoneConstraints(): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }

  async function ensureMicrophonePermission(options?: { auto?: boolean }) {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    if (microphonePermissionInFlightRef.current) {
      return false;
    }

    microphonePermissionInFlightRef.current = true;

    try {
      const permissionsApi = (navigator as Navigator & {
        permissions?: {
          query: (descriptor: PermissionDescriptor) => Promise<{ state: PermissionState }>;
        };
      }).permissions;

      if (permissionsApi) {
        try {
          const status = await permissionsApi.query({ name: "microphone" as PermissionName });

          if (status.state === "granted") {
            return true;
          }

          if (status.state === "denied") {
            if (!options?.auto) {
              const message = "Microphone access is blocked. Allow it in your browser settings to record voice notes.";
              setError(message);
              pushToast("Microphone blocked", message);
            }
            return false;
          }
        } catch {
          // Fall through to a direct permission request when the browser cannot report microphone permission state.
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(buildMicrophoneConstraints());
      stream.getTracks().forEach((track) => track.stop());

      if (options?.auto) {
        pushToast("Microphone ready", "Browser microphone access is enabled for live voice notes.");
      }

      return true;
    } catch (permissionError) {
      const message = permissionError instanceof Error ? permissionError.message : "Unable to access the microphone";

      if (!options?.auto) {
        setError(message);
        pushToast("Voice notes unavailable", message);
      }

      return false;
    } finally {
      microphonePermissionInFlightRef.current = false;
    }
  }

  function stopVoiceCaptureStream() {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  }

  function cleanupWavVoiceNoteCapture() {
    const processor = voiceAudioProcessorRef.current;
    const source = voiceAudioSourceRef.current;
    const audioContext = voiceAudioContextRef.current;
    const monitorGain = voiceMonitorGainRef.current;

    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }

    monitorGain?.disconnect();
    source?.disconnect();
    void audioContext?.close().catch(() => {});

    voiceAudioProcessorRef.current = null;
    voiceAudioSourceRef.current = null;
    voiceAudioContextRef.current = null;
    voiceMonitorGainRef.current = null;
    voiceAudioChunksRef.current = [];
    voiceSampleRateRef.current = 44100;
  }

  function removeCommentFile(fileToRemove: File) {
    setCommentFiles((current) => current.filter((file) => !sameFile(file, fileToRemove)));

    if (voiceNoteFileName && fileToRemove.name === voiceNoteFileName) {
      clearVoiceNotePreview();
    }
  }

  function attachVoiceNoteFile(file: File) {
    setCommentFiles((current) => {
      const withoutExistingVoiceNote = voiceNoteFileName ? current.filter((item) => item.name !== voiceNoteFileName) : current;
      return mergeSelectedFiles(withoutExistingVoiceNote, [file]);
    });
    setVoiceNotePreview(file);
    pushToast("Voice note ready", "Your recording is attached to this message.");
  }

  function finalizeWavVoiceNote(saveRecording: boolean) {
    const chunks = [...voiceAudioChunksRef.current];
    const sampleRate = voiceSampleRateRef.current;

    cleanupWavVoiceNoteCapture();
    voiceRecorderModeRef.current = null;
    stopVoiceCaptureStream();
    setIsRecordingVoiceNote(false);

    if (!saveRecording || !chunks.length) {
      return;
    }

    const blob = encodeWavBlob(chunks, sampleRate);

    if (!blob.size) {
      pushToast("Voice note unavailable", "No audio was captured. Try recording again.");
      return;
    }

    const fileName = `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
    attachVoiceNoteBlob(blob, "audio/wav", fileName);
  }

  function startMediaRecorderVoiceNote(stream: MediaStream) {
    if (typeof MediaRecorder === "undefined") {
      return false;
    }

    const supportedMimeType =
      voiceNoteMimeTypeOptions.find(
        (mimeType) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mimeType) && canPlayRecordedMimeType(mimeType)
      ) ?? "";

    if (!supportedMimeType) {
      return false;
    }

    const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });

    voiceChunksRef.current = [];
    voiceRecorderRef.current = recorder;
    voiceRecorderModeRef.current = "media_recorder";
    voiceStreamRef.current = stream;
    voiceNoteSaveOnStopRef.current = true;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        voiceChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const shouldSaveRecording = voiceNoteSaveOnStopRef.current;
      const recordedChunks = [...voiceChunksRef.current];
      voiceChunksRef.current = [];
      voiceRecorderRef.current = null;
      voiceRecorderModeRef.current = null;
      stopVoiceCaptureStream();
      setIsRecordingVoiceNote(false);

      if (!shouldSaveRecording || !recordedChunks.length) {
        return;
      }

      const mimeType = recorder.mimeType || supportedMimeType;
      const blob = new Blob(recordedChunks, { type: mimeType });

      if (!blob.size) {
        pushToast("Voice note unavailable", "No audio was captured. Try recording again.");
        return;
      }

      void normalizeRecordedVoiceNote(blob, mimeType).then((normalized) => {
        const fileName = `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${normalized.extension}`;
        attachVoiceNoteBlob(normalized.blob, normalized.mimeType, fileName);
      });
    };

    recorder.start();
    setIsRecordingVoiceNote(true);
    pushToast("Recording started", "Speak now, then tap Stop to attach the voice note.");
    return true;
  }

  function stopVoiceNoteRecording(saveRecording: boolean) {
    voiceNoteSaveOnStopRef.current = saveRecording;
    const mode = voiceRecorderModeRef.current;

    if (mode === "media_recorder") {
      const recorder = voiceRecorderRef.current;

      if (!recorder) {
        voiceRecorderModeRef.current = null;
        stopVoiceCaptureStream();
        setIsRecordingVoiceNote(false);
        return;
      }

      if (recorder.state !== "inactive") {
        recorder.stop();
        return;
      }

      voiceRecorderRef.current = null;
      voiceRecorderModeRef.current = null;
      stopVoiceCaptureStream();
      setIsRecordingVoiceNote(false);
      return;
    }

    if (mode === "wav") {
      finalizeWavVoiceNote(saveRecording);
      return;
    }

    stopVoiceCaptureStream();
    setIsRecordingVoiceNote(false);
  }

  async function startWavVoiceNote(stream: MediaStream) {
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error("This browser does not support live voice-note recording.");
    }

    const audioContext = new AudioContextConstructor();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const monitorGain = audioContext.createGain();
    monitorGain.gain.value = 0;

    voiceAudioChunksRef.current = [];
    voiceSampleRateRef.current = audioContext.sampleRate;
    voiceAudioContextRef.current = audioContext;
    voiceAudioSourceRef.current = source;
    voiceAudioProcessorRef.current = processor;
    voiceMonitorGainRef.current = monitorGain;
    voiceStreamRef.current = stream;
    voiceRecorderModeRef.current = "wav";
    voiceNoteSaveOnStopRef.current = true;

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      voiceAudioChunksRef.current.push(new Float32Array(inputData));
    };

    source.connect(processor);
    processor.connect(monitorGain);
    monitorGain.connect(audioContext.destination);

    setIsRecordingVoiceNote(true);
    pushToast("Recording started", "Speak now, then tap Stop to attach the voice note.");
  }

  async function handleVoiceNoteToggle() {
    if (isRecordingVoiceNote) {
      stopVoiceNoteRecording(true);
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const message = "This browser does not support live microphone recording.";
      setError(message);
      pushToast("Voice notes unavailable", message);
      return;
    }

    setError(null);

    let stream: MediaStream | null = null;

    try {
      const permissionGranted = await ensureMicrophonePermission();

      if (!permissionGranted) {
        return;
      }

      stream = await navigator.mediaDevices.getUserMedia(buildMicrophoneConstraints());

      const startedMediaRecorder = startMediaRecorderVoiceNote(stream);
      if (startedMediaRecorder) {
        return;
      }

      await startWavVoiceNote(stream);
    } catch (voiceError) {
      stream?.getTracks().forEach((track) => track.stop());
      cleanupWavVoiceNoteCapture();
      stopVoiceCaptureStream();
      setIsRecordingVoiceNote(false);
      const message = voiceError instanceof Error ? voiceError.message : "Unable to access the microphone";
      setError(message);
      pushToast("Voice notes unavailable", message);
    }
  }

  async function handleCommentSubmit() {
    if (!session?.token || !selectedProjectId || isRecordingVoiceNote || (!commentDraft.trim() && commentFiles.length === 0)) return;

    setWorking(true);

    try {
      const uploaded = await uploadAttachments(commentFiles);
      const mentionIds =
        isAdminWorkspace && selectedCollaborationClient
          ? Array.from(new Set([...commentMentions, selectedCollaborationClient._id]))
          : commentMentions;
      await apiRequest("/comments", {
        method: "POST",
        token: session.token,
        body: {
          project: selectedProjectId,
          task: selectedTaskId ?? replyTargetComment?.task ?? null,
          replyTo: replyTargetComment?._id ?? null,
          content: commentDraft.trim(),
          mentions: mentionIds,
          attachments: uploaded
        }
      });
      setCommentDraft("");
      setCommentFiles([]);
      clearVoiceNotePreview();
      setCommentMentions([]);
      setReplyToCommentId(null);
      setFeedbackComposerMode("comment");
      pushToast("Message sent", "Your message is now part of the project chat.");
      await refreshWorkspace(session.token, true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save comment");
      setWorking(false);
    }
  }

  function clearRequestSelection(returnToChat = false) {
    setRequestSourceCommentId(null);
    setRequestTitle("");
    setRequestDescription("");
    setRequestStatus("open");
    setRequestPriority("medium");
    setRequestFiles([]);

    if (returnToChat) {
      setFeedbackComposerMode("comment");
    }
  }

  function selectChatAsRequest(comment: Comment) {
    if (requestSourceCommentId === comment._id) {
      clearRequestSelection(true);
      pushToast("Request selection cleared", "That message is back to normal chat.");
      return;
    }

    setReplyToCommentId(null);
    setRequestSourceCommentId(comment._id);
    setRequestTitle(buildRequestTitleFromComment(comment));
    setRequestDescription(comment.content);
    setRequestStatus("open");
    setRequestPriority("medium");
    setRequestFiles([]);
    setFeedbackComposerMode("request");
    pushToast("Message selected", "The chat message is now ready to submit as a tracked request.");
  }

  async function handleRequestSubmit() {
    if (!session?.token || !selectedProjectId || !requestTitle.trim() || !requestDescription.trim()) return;

    setWorking(true);

    try {
      const uploaded = await uploadAttachments(requestFiles);
      await apiRequest("/requests", {
        method: "POST",
        token: session.token,
        body: {
          project: selectedProjectId,
          task: requestSourceComment?.task ?? selectedTaskId ?? null,
          sourceComment: requestSourceComment?._id ?? null,
          title: requestTitle,
          description: requestDescription,
          status: requestStatus,
          priority: requestPriority,
          attachments: uploaded
        }
      });
      setRequestTitle("");
      setRequestDescription("");
      setRequestStatus("open");
      setRequestPriority("medium");
      setRequestFiles([]);
      setRequestSourceCommentId(null);
      setFeedbackComposerMode("request");
      pushToast("Request submitted", "The request is now linked to the project.");
      await refreshWorkspace(session.token, true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit request");
      setWorking(false);
    }
  }

  async function handleRequestStatusToggle(request: RequestItem) {
    if (!session?.token || !canManageRequests) return;

    const nextStatus: RequestStatus = request.status === "completed" ? "open" : "completed";

    setWorking(true);

    try {
      await apiRequest(`/requests/${request._id}`, {
        method: "PATCH",
        token: session.token,
        body: { status: nextStatus }
      });
      pushToast(nextStatus === "completed" ? "Request completed" : "Request reopened", `${request.title} is now ${labelize(nextStatus)}.`);
      await refreshWorkspace(session.token, true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update request");
      setWorking(false);
    }
  }

  async function handleDeleteRequest(request: RequestItem) {
    if (!session?.token || !isAdminWorkspace || !window.confirm(`Delete request "${request.title}"?`)) return;

    setWorking(true);

    try {
      await apiRequest(`/requests/${request._id}`, { method: "DELETE", token: session.token });
      pushToast("Request deleted", `${request.title} was removed.`);
      await refreshWorkspace(session.token, true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete request");
      setWorking(false);
    }
  }

  async function handleDeleteComment(comment: Comment) {
    if (!session?.token || !isAdminWorkspace || !window.confirm("Delete this chat message?")) return;

    setWorking(true);

    try {
      await apiRequest(`/comments/${comment._id}`, { method: "DELETE", token: session.token });
      if (replyToCommentId === comment._id) {
        setReplyToCommentId(null);
      }
      if (requestSourceCommentId === comment._id) {
        clearRequestSelection(false);
      }
      pushToast("Message deleted", "The chat message was removed.");
      await refreshWorkspace(session.token, true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete message");
      setWorking(false);
    }
  }

  async function markAllNotificationsRead() {
    if (!session?.token) return;
    await apiRequest("/notifications/read-all", { method: "PATCH", token: session.token });
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: new Date().toISOString()
      }))
    );
  }

  async function markNotificationsRead(notificationIds: string[]) {
    if (!session?.token || !notificationIds.length) return;

    const idsToMark = [...new Set(notificationIds)];
    await Promise.allSettled(
      idsToMark.map((notificationId) => apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH", token: session.token }))
    );

    const readAt = new Date().toISOString();
    const ids = new Set(idsToMark);
    setNotifications((current) =>
      current.map((notification) => (ids.has(notification._id) ? { ...notification, readAt: notification.readAt ?? readAt } : notification))
    );
  }

  async function downloadProjectsCsv() {
    if (!session?.token) return;

    const response = await fetch(`${apiBaseUrl}/dashboard/export/projects.csv`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "projects.csv";
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  function renderRequestSourceCard(sourceComment: Comment, dismissible = false) {
    const linkedTaskLabel = sourceComment.task ? tasks.find((task) => task._id === sourceComment.task)?.title ?? "Linked task" : null;

    return (
      <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-700/70 dark:text-amber-200/70">Selected from chat</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {sourceComment.author.name} · {formatChatTimestamp(sourceComment.createdAt)}
            </p>
          </div>
          {dismissible ? (
            <button
              aria-label="Clear selected chat"
              className="ui-hover-icon rounded-full p-2 text-slate-400 transition"
              onClick={() => setRequestSourceCommentId(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {linkedTaskLabel ? (
          <div className="mt-3">
            <span className="inline-flex rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
              {linkedTaskLabel}
            </span>
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {summarizeChatMessage(sourceComment.content, sourceComment.attachments ?? [])}
        </p>
      </div>
    );
  }

  function renderChatConversation(emptyDescription: string, messagePlaceholder: string) {
    return (
      <SectionCard eyebrow="Chat" title="Project conversation">
        <div className="space-y-4">
          <div
            ref={chatScrollRef}
            className="scrollbar-thin max-h-[560px] overflow-y-auto rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/35 sm:p-5"
          >
            <div className="space-y-3">
              {collaborationChatMessages.length ? (
                collaborationChatMessages.map((comment) => {
                  const authorId = comment.author._id || comment.author.id || "";
                  const isOwnMessage = authorId === currentUserId;
                  const linkedTaskLabel = comment.task ? tasks.find((task) => task._id === comment.task)?.title ?? "Selected task" : null;
                  const audioAttachments = comment.attachments.filter((attachment) => isAudioLikeFile(attachment));
                  const fileAttachments = comment.attachments.filter((attachment) => !isAudioLikeFile(attachment));
                  const hasTextContent = Boolean(comment.content.trim());

                  return (
                    <div key={comment._id} className={cn("flex items-end gap-3", isOwnMessage ? "justify-end" : "justify-start")}>
                      {!isOwnMessage ? (
                        <div className="avatar-token flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-lime-500/15 dark:text-lime-300">
                          {initials(comment.author.name)}
                        </div>
                      ) : null}

                      <div className={cn("max-w-[88%] sm:max-w-[78%]", isOwnMessage ? "items-end" : "items-start")}>
                        <div
                          className={cn(
                            "rounded-[24px] px-4 py-3 shadow-sm",
                            isOwnMessage
                              ? "rounded-br-[10px] bg-accent-500 text-white dark:bg-lime-500 dark:text-ink"
                              : "rounded-bl-[10px] bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white dark:ring-slate-800"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", isOwnMessage ? "text-white/75 dark:text-ink/70" : "text-slate-400")}>
                              {isOwnMessage ? "You" : comment.author.name}
                            </p>
                            <p className={cn("text-[11px]", isOwnMessage ? "text-white/75 dark:text-ink/70" : "text-slate-400")}>
                              {formatChatTimestamp(comment.createdAt)}
                            </p>
                          </div>

                          {comment.replyTo ? (
                            <div
                              className={cn(
                                "mt-3 rounded-2xl border-l-2 px-3 py-2 text-xs",
                                isOwnMessage
                                  ? "border-white/60 bg-white/10 text-white/85 dark:border-ink/35 dark:bg-ink/10 dark:text-ink/80"
                                  : "border-accent-400 bg-slate-900/[0.04] text-slate-500 dark:border-lime-400 dark:bg-white/5 dark:text-slate-300"
                              )}
                            >
                              <p className="font-semibold">{comment.replyTo.author?.name ?? "Previous message"}</p>
                              <p className="mt-1 leading-5">{summarizeChatMessage(comment.replyTo.content, comment.replyTo.attachments ?? [])}</p>
                            </div>
                          ) : null}

                          {linkedTaskLabel ? (
                            <div className="mt-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                                  isOwnMessage
                                    ? "bg-white/12 text-white/85 dark:bg-ink/10 dark:text-ink/80"
                                    : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                                )}
                              >
                                {linkedTaskLabel}
                              </span>
                            </div>
                          ) : null}

                          {hasTextContent ? (
                            <div className={cn("markdown-body mt-3 text-sm leading-6", isOwnMessage ? "text-white dark:text-ink" : "text-slate-700 dark:text-slate-200")}>
                              <ReactMarkdown>{comment.content}</ReactMarkdown>
                            </div>
                          ) : null}

                          {audioAttachments.length ? (
                            <div className="mt-3 space-y-2">
                              {audioAttachments.map((attachment) => (
                                <div
                                  key={`${comment._id}-${attachment.url}`}
                                  className={cn(
                                    "rounded-[20px] px-3 py-3",
                                    isOwnMessage ? "bg-white/12 dark:bg-ink/10" : "bg-slate-900/5 dark:bg-white/10"
                                  )}
                                >
                                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", isOwnMessage ? "text-white/75 dark:text-ink/70" : "text-slate-400")}>
                                    Voice note
                                  </p>
                                  <AudioMessagePlayer className="mt-2 h-10 w-full min-w-[220px] max-w-[300px]" src={assetUrl(attachment.url)} />
                                  <a
                                    className={cn(
                                      "mt-2 inline-flex items-center gap-2 text-xs font-semibold transition",
                                      isOwnMessage
                                        ? "text-white/80 hover:text-white dark:text-ink/80 dark:hover:text-ink"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                                    )}
                                    href={assetUrl(attachment.url)}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    {attachment.name}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {fileAttachments.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {fileAttachments.map((attachment) => (
                                <a
                                  key={`${comment._id}-${attachment.url}`}
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
                                    isOwnMessage
                                      ? "bg-white/12 text-white hover:bg-white/20 dark:bg-ink/10 dark:text-ink dark:hover:bg-ink/15"
                                      : "bg-slate-900/5 text-slate-600 hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                                  )}
                                  href={assetUrl(attachment.url)}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                  <span className="max-w-[180px] truncate">{attachment.name}</span>
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className={cn("mt-2 flex flex-wrap gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
                          <button
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                            onClick={() => {
                              setReplyToCommentId(comment._id);
                              setFeedbackComposerMode("comment");
                            }}
                            type="button"
                          >
                            <CornerDownLeft className="h-3.5 w-3.5" />
                            Reply
                          </button>
                          <button
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                              requestSourceCommentId === comment._id
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                                : "text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                            )}
                            onClick={() => selectChatAsRequest(comment)}
                            type="button"
                          >
                            <ListTodo className="h-3.5 w-3.5" />
                            {requestSourceCommentId === comment._id ? "Undo request" : "Track request"}
                          </button>
                          {isAdminWorkspace ? (
                            <button
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10 dark:hover:bg-rose-500/15"
                              onClick={() => void handleDeleteComment(comment)}
                              type="button"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {isOwnMessage ? (
                        <div className="avatar-token flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500/12 text-xs font-semibold text-accent-700 dark:bg-lime-500/12 dark:text-lime-300">
                          {initials(comment.author.name)}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <EmptyState description={emptyDescription} title="No chat yet" />
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/55">
            {replyTargetComment ? (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-[22px] border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Replying to {replyTargetComment.author.name}</p>
                  <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                    {summarizeChatMessage(replyTargetComment.content, replyTargetComment.attachments)}
                  </p>
                </div>
                <button
                  aria-label="Cancel reply"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  onClick={() => setReplyToCommentId(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <TextArea
                className="min-h-[110px] border-0 bg-transparent px-0 py-0 text-sm leading-6 focus:border-transparent dark:bg-transparent"
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder={messagePlaceholder}
                rows={4}
                value={commentDraft}
              />

              {isRecordingVoiceNote ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  Recording voice note...
                </div>
              ) : null}

              {commentFiles.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {commentFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-900/5 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200"
                    >
                      {voiceNoteFileName === file.name && voiceNotePreviewUrl ? <Mic className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                      <span className="max-w-[160px] truncate">{voiceNoteFileName === file.name ? "Voice note" : file.name}</span>
                      <button
                        aria-label={`Remove ${file.name}`}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-900/10 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={() => removeCommentFile(file)}
                        type="button"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {voiceNotePreviewUrl ? (
                <div className="mt-3 rounded-[22px] border border-slate-200/70 bg-white/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Voice note preview</p>
                    <button
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                      onClick={() => {
                        if (voiceNoteFileName) {
                          const existingVoiceNote = commentFiles.find((file) => file.name === voiceNoteFileName);
                          if (existingVoiceNote) {
                            removeCommentFile(existingVoiceNote);
                            return;
                          }
                        }

                        clearVoiceNotePreview();
                      }}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <AudioMessagePlayer className="mt-3 h-10 w-full" src={voiceNotePreviewUrl} />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                    <input
                      className="hidden"
                      multiple
                      onChange={(event) => {
                        const incomingFiles = Array.from(event.target.files ?? []);
                        setCommentFiles((current) => mergeSelectedFiles(current, incomingFiles));
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>

                  <button
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
                      isRecordingVoiceNote
                        ? "bg-rose-500 text-white hover:bg-rose-600"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900"
                    )}
                    disabled={working}
                    onClick={() => void handleVoiceNoteToggle()}
                    type="button"
                  >
                    {isRecordingVoiceNote ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isRecordingVoiceNote ? "Stop" : "Voice note"}
                  </button>

                  {feedbackParticipantsForComposer.slice(0, 5).map((user) => (
                    <button
                      key={user._id}
                      className={cn(
                        "rounded-full px-3 py-2 text-xs font-semibold transition",
                        commentMentions.includes(user._id)
                          ? "bg-accent-500 text-white dark:bg-lime-500 dark:text-ink"
                          : "bg-slate-900/5 text-slate-600 hover:bg-slate-900/10 dark:bg-slate-100/10 dark:text-slate-300 dark:hover:bg-slate-100/15"
                      )}
                      onClick={() => setCommentMentions((current) => toggleSelection(current, user._id))}
                      type="button"
                    >
                      @{user.name.split(" ")[0]}
                    </button>
                  ))}
                </div>

                <Button
                  className="h-11 min-w-[110px]"
                  disabled={working || isRecordingVoiceNote || (!commentDraft.trim() && commentFiles.length === 0)}
                  onClick={() => void handleCommentSubmit()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Shift the conversation here for normal back-and-forth updates. Attach files or record a voice note. Requests stay in the request tab.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        branding={branding}
        error={error}
        inviteInfo={inviteInfo}
        inviteToken={inviteToken}
        loading={working || loading}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-strong w-full max-w-sm rounded-[32px] p-6 text-center">
          <BrandMark branding={branding} className="justify-center" subtitle="Loading workspace" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Getting everything ready...</p>
        </div>
      </main>
    );
  }

  return (
      <main className="min-h-screen min-h-dvh px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-6 lg:pb-6">
      <ToastViewport toasts={toasts} />
      <div className="mx-auto max-w-[1600px] gap-6 xl:grid xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="mb-6 hidden xl:block xl:mb-0">
          <div className="surface sticky top-4 space-y-5 rounded-[32px] p-5">
            <div>
              <BrandMark branding={branding} subtitle="Workspace" />
              <h2 className="mt-4 font-display text-3xl text-slate-900 dark:text-white">{workspaceTitle}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{workspaceDescription}</p>
            </div>
            <div className="space-y-2">
              {workspaceNavItems.map((item) => (
                <WorkspaceNavButton
                  key={item.id}
                  active={activeView === item.id}
                  badge={workspaceBadge(item.id)}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => setActiveView(item.id)}
                />
              ))}
            </div>
            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current Project</p>
              {selectedProject ? (
                <>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">{selectedProject.name}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedProject.summary}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <StatusPill label={labelize(selectedProject.status)} tone={projectTone(selectedProject.status)} />
                    <StatusPill label={`${selectedProject.progress}%`} tone={priorityTone(selectedProject.priority)} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button className="w-full" onClick={() => setActiveView("projects")} variant="secondary">
                      {isClientWorkspace ? "Project overview" : "Open details"}
                    </Button>
                    <Button className="w-full" onClick={() => setActiveView("collaboration")} variant="ghost">
                      {isClientWorkspace ? "Chat & requests" : "Chat & requests"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Select a project to give the workspace context.</p>
              )}
            </div>
            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed In</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{session.user.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{labelize(session.user.role)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canManageProjects ? (
                  <Button className="w-full" onClick={() => openProjectModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    New project
                  </Button>
                ) : null}
                {canManageTasks ? (
                  <Button className="w-full" onClick={() => openTaskModal()} variant="secondary">
                    <ListTodo className="mr-2 h-4 w-4" />
                    New task
                  </Button>
                ) : null}
                {canInviteUsers ? (
                  <Button className="w-full" onClick={() => setInviteModalOpen(true)} variant="secondary">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite user
                  </Button>
                ) : null}
                {isClientWorkspace ? (
                  <Button className="w-full" onClick={() => setActiveView("account")} variant="secondary">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Account settings
                  </Button>
                ) : null}
                <Button className="w-full" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} variant="secondary">
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </Button>
                <Button className="w-full" onClick={() => void downloadProjectsCsv()} variant="secondary">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button className="w-full" onClick={() => void handleSignOut()} variant="ghost">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="surface sticky top-2 z-20 rounded-[24px] p-3 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <BrandMark branding={branding} compact subtitle={activeViewCopy.eyebrow} />
              </div>
              <div className="flex items-center gap-2">
                {canManageProjects || canManageTasks ? (
                  <Button
                    aria-label="Create item"
                    className="h-11 w-11 rounded-2xl px-0"
                    onClick={() => handleMobilePrimaryAction()}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                ) : null}
                <Button
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  className="h-11 w-11 rounded-2xl px-0"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                  variant="secondary"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <Button aria-label="Sign out" className="h-11 w-11 rounded-2xl px-0" onClick={() => void handleSignOut()} variant="ghost">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/70 bg-white/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedProject ? selectedProject.name : activeViewCopy.title}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{labelize(session.user.role)} / {session.user.name}</p>
              </div>
              {selectedProject ? (
                <StatusPill label={`${selectedProject.progress}%`} tone={priorityTone(selectedProject.priority)} />
              ) : (
                <StatusPill label={unreadNotificationsCount ? `${unreadNotificationsCount} new` : "All clear"} tone="info" />
              )}
            </div>
          </section>

          {showWorkspaceHero ? (
            <section className="surface hero-grid overflow-hidden rounded-[36px] p-4 md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <p className="hidden text-sm font-semibold text-accent-600 dark:text-lime-300 md:block">Welcome back, {firstName}</p>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400 md:hidden">{activeViewCopy.eyebrow}</p>
                  <h1 className="mt-2 font-display text-[2.15rem] leading-[1.02] text-slate-900 dark:text-white md:mt-3 md:text-5xl md:leading-tight">
                    <span className="md:hidden">{mobileHeroTitle}</span>
                    <span className="hidden md:inline">{heroTitle}</span>
                  </h1>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 md:mt-4 md:text-base">
                    <span className="md:hidden">{mobileHeroDescription}</span>
                    <span className="hidden md:inline">{heroDescription}</span>
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:mt-5 md:flex md:flex-wrap md:gap-3">
                    {heroHighlights.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[20px] border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40 md:rounded-[22px] md:px-4"
                      >
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {error ? (
                    <div className="mt-4 rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:text-rose-300">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {showWorkspaceFilters ? (
            <section className="surface rounded-[30px] p-4">
              <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
                <TextField onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} value={search} />
                <div className="grid grid-cols-2 gap-3">
                  {activeView === "tasks" ? (
                    <SelectField onChange={(event) => setTaskStatusFilter(event.target.value)} value={taskStatusFilter}>
                      <option value="all">All task statuses</option>
                      {taskStatuses.map((status) => (
                        <option key={status} value={status}>{labelize(status)}</option>
                      ))}
                    </SelectField>
                  ) : (
                    <SelectField onChange={(event) => setProjectFilter(event.target.value)} value={projectFilter}>
                      <option value="all">{isClientWorkspace ? "All project statuses" : "All statuses"}</option>
                      {projectStatuses.map((status) => (
                        <option key={status} value={status}>{labelize(status)}</option>
                      ))}
                    </SelectField>
                  )}
                  <SelectField onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
                    <option value="all">All priorities</option>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>{labelize(priority)}</option>
                    ))}
                  </SelectField>
                </div>
              </div>
            </section>
          ) : null}

          {showWorkspaceLead ? (
            <section className="surface rounded-[30px] p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{activeViewCopy.eyebrow}</p>
                  <h2 className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{activeViewCopy.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{activeViewCopy.description}</p>
                </div>
                <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0 xl:pb-0">
                  {selectedProject ? (
                    <button
                      className="ui-hover-surface shrink-0 rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-3 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                      onClick={() => setActiveView("projects")}
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <FolderKanban className="h-4 w-4 text-accent-500 dark:text-lime-400" />
                        {selectedProject.name}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Current project</p>
                    </button>
                  ) : null}
                  {selectedProject ? (
                    <button
                      className="ui-hover-surface shrink-0 rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-3 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                      onClick={() => setActiveView("tasks")}
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <ListTodo className="h-4 w-4 text-accent-500 dark:text-lime-400" />
                        {selectedProjectTaskCount} active tasks
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                        {isClientWorkspace ? "Open task list" : "Open task board"}
                      </p>
                    </button>
                  ) : null}
                  {selectedTask ? (
                    <button
                      className="ui-hover-surface shrink-0 rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-3 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                      onClick={() => setActiveView("collaboration")}
                      type="button"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <MessagesSquare className="h-4 w-4 text-accent-500 dark:text-lime-400" />
                        {selectedTask.title}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Open chat & requests
                      </p>
                    </button>
                  ) : null}
                  <button
                    className="ui-hover-surface shrink-0 rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-3 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                    onClick={() => setActiveView("timeline")}
                    type="button"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <BellDot className="h-4 w-4 text-accent-500 dark:text-lime-400" />
                      {unreadNotificationsCount} new alerts
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Open timeline</p>
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "overview" ? (
            isClientWorkspace ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard caption="Projects you can review right now" title="Your Projects" value={visibleProjects.length} />
                  <StatCard caption="Tasks already finished for your projects" title="Completed Tasks" value={summary?.stats.completedTasks ?? 0} />
                  <StatCard caption="Change requests still awaiting closure" title="Open Requests" value={summary?.stats.openRequests ?? 0} />
                  <StatCard caption="Upcoming work due soon" title="Deadlines" value={summary?.upcomingDeadlines.length ?? 0} />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <SectionCard eyebrow="Projects" title="Project Overview">
                    <div className="space-y-4">
                      {visibleProjects.length ? (
                        visibleProjects.map((project) => (
                          <button
                            key={project._id}
                            className={cn(
                              "w-full rounded-[24px] border p-4 text-left transition",
                              selectedProjectId === project._id
                                ? "border-accent-400 bg-accent-500/8 dark:border-lime-400 dark:bg-lime-500/10"
                                : "border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                            )}
                            onClick={() => openProjectWorkspace(project._id)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{project.name}</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{project.summary}</p>
                              </div>
                              <StatusPill label={labelize(project.status)} tone={projectTone(project.status)} />
                            </div>
                            <div className="mt-4 h-2 rounded-full bg-slate-900/8 dark:bg-white/8">
                              <div className="h-2 rounded-full bg-accent-500 dark:bg-lime-500" style={{ width: `${project.progress}%` }} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
                              <span>{project.progress}% complete</span>
                              <span>{project.deadline ? formatShortDate(project.deadline) : "No deadline set"}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyState description="No projects are linked to this client account yet." title="No client projects" />
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard eyebrow="What Next" title="Latest Updates">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected project</p>
                        <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">
                          {selectedProject ? selectedProject.name : "Choose a project"}
                        </p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {selectedProject
                            ? `${selectedProjectTaskCount} tasks, ${selectedProjectOpenRequests} open requests, due ${selectedProject.deadline ? relativeDate(selectedProject.deadline) : "whenever your team is ready"}.`
                            : "Pick a project to see the latest progress, requests, and deadlines."}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {recentClientActivity.length ? (
                          recentClientActivity.map((activity) => (
                            <div key={activity._id} className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{activity.message}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{labelize(activity.action)}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-slate-300/70 px-4 py-8 text-sm text-slate-400 dark:border-slate-700">
                            No recent updates yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                </section>
              </>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard caption="Projects in the workspace" title="Projects" value={summary?.stats.totalProjects ?? 0} />
                  <StatCard caption="Tasks already completed" title="Completed Tasks" value={summary?.stats.completedTasks ?? 0} />
                  <StatCard caption="Deadlines needing attention" title="Overdue" value={summary?.stats.overdueTasks ?? 0} />
                  <StatCard caption="Client change requests still open" title="Open Requests" value={summary?.stats.openRequests ?? 0} />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SectionCard eyebrow="Analytics" title="Project Status Mix">
                    <div className="space-y-5">
                      {(summary?.projectsByStatus ?? []).map((entry, index) => {
                        const total = summary?.projectsByStatus.reduce((sum, item) => sum + item.count, 0) ?? 0;
                        const width = total ? Math.max((entry.count / total) * 100, 8) : 0;
                        const colors = ["bg-accent-500", "bg-lime-500", "bg-ember-500"];
                        return (
                          <div key={entry.status}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-semibold text-slate-900 dark:text-white">{labelize(entry.status)}</span>
                              <span className="text-slate-500 dark:text-slate-400">{entry.count}</span>
                            </div>
                            <div className="h-4 rounded-full bg-slate-900/8 dark:bg-white/8">
                              <div className={cn("h-4 rounded-full", colors[index % colors.length])} style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                  <SectionCard eyebrow="Analytics" title="Team Workload">
                    <div className="space-y-4">
                      {(summary?.workload ?? []).map((member) => {
                        const total = member.openTasks + member.completedTasks;
                        const completedWidth = total ? (member.completedTasks / total) * 100 : 0;
                        return (
                          <div key={member.name} className="rounded-[24px] border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold text-slate-900 dark:text-white">{member.name}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {member.openTasks} open / {member.completedTasks} done
                              </span>
                            </div>
                            <div className="mt-3 h-3 rounded-full bg-slate-900/8 dark:bg-white/8">
                              <div className="h-3 rounded-full bg-lime-500" style={{ width: `${completedWidth}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </section>

                <SectionCard
                  action={
                    <StatusPill
                      label={`${completedProjects.length} completed`}
                      tone={completedProjects.length ? "success" : "default"}
                    />
                  }
                  eyebrow="Archive"
                  title="Completed projects"
                >
                  {completedProjects.length ? (
                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                      {completedProjects.slice(0, 6).map((project) => (
                        <button
                          key={project._id}
                          className="ui-hover-surface rounded-[26px] border border-slate-200/70 bg-white/70 p-5 text-left transition dark:border-slate-800 dark:bg-slate-950/35"
                          onClick={() => openProjectWorkspace(project._id)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">{project.name}</p>
                              <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{project.summary}</p>
                            </div>
                            <StatusPill label="Completed" tone="success" />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <span>{project.taskCount ?? 0} tasks</span>
                            <span>{project.progress}% complete</span>
                            <span>{project.deadline ? `Closed ${formatShortDate(project.deadline)}` : "Closed project"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description="Completed projects will collect here once delivery is signed off."
                      title="No completed projects yet"
                    />
                  )}
                </SectionCard>
              </>
            )
          ) : null}

          {activeView === "projects" ? (
            <section className="project-workspace grid gap-6 xl:grid-cols-[312px_minmax(0,1fr)] 2xl:grid-cols-[336px_minmax(0,1fr)]">
              <SectionCard
                className="project-panel min-w-0 dark:border-[#162437] dark:bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(7,13,25,0.98))]"
                eyebrow="Projects"
                title={isClientWorkspace ? "Your Projects" : "Client Portfolio"}
              >
                <div className="scrollbar-thin max-h-[610px] space-y-4 overflow-y-auto pr-1 2xl:max-h-[760px]">
                  {visibleProjects.length ? (
                    visibleProjects.map((project) => {
                      const projectParticipants = [...project.teamMembers, ...project.clients].slice(0, 3);
                      const isSelected = selectedProjectId === project._id;

                      return (
                        <div
                          key={project._id}
                          className={cn(
                            "project-rail-card w-full rounded-[32px] border px-5 py-5 text-left transition duration-200",
                            isSelected
                              ? "project-rail-card-active border-accent-400/45 bg-accent-500/[0.04] shadow-[0_20px_44px_rgba(39,110,241,0.12)] dark:border-lime-400/55 dark:bg-[linear-gradient(180deg,rgba(20,38,27,0.98),rgba(15,28,23,0.98))] dark:shadow-[0_22px_44px_rgba(1,7,18,0.3)]"
                              : "border-slate-200/70 bg-white/70 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-[#18263a] dark:bg-[linear-gradient(180deg,rgba(8,16,30,0.98),rgba(7,14,27,0.98))] dark:shadow-[0_18px_36px_rgba(1,7,18,0.22)]"
                          )}
                          onClick={() => {
                            openProjectWorkspace(project._id);
                          }}
                          onKeyDown={(event) => handleProjectCardKeyDown(event, project._id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_78px] items-start gap-4">
                            <div className="min-w-0">
                              <p className="max-w-[172px] font-display text-[2.55rem] leading-[0.93] tracking-[-0.04em] text-slate-900 dark:text-white">
                                {project.name}
                              </p>
                              <p className="mt-4 max-w-[190px] text-[0.9rem] leading-6 text-slate-600 dark:text-slate-300">
                                {project.summary}
                              </p>
                            </div>
                            <div className="pt-1 text-right">
                              <p className="text-[0.92rem] font-semibold leading-4 text-accent-700 dark:text-lime-300">
                                {labelize(project.status).split(" ").map((part) => (
                                  <span key={part} className="block">
                                    {part}
                                  </span>
                                ))}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex items-end justify-between gap-4">
                            <div className="flex -space-x-1.5">
                              {projectParticipants.map((user) => (
                                <div
                                  key={user._id}
                                  className="avatar-token project-member-chip flex h-10 w-10 items-center justify-center rounded-full border border-accent-100 bg-accent-100 text-[0.76rem] font-bold uppercase text-accent-700 shadow-[0_8px_20px_rgba(15,23,42,0.12)] dark:border-lime-400/18 dark:bg-lime-500/12 dark:text-lime-300 dark:shadow-none"
                                  title={user.name}
                                >
                                  {initials(user.name)}
                                </div>
                              ))}
                            </div>
                            <p className="shrink-0 text-[0.95rem] font-semibold text-amber-600 dark:text-amber-300">{project.progress}% complete</p>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4 text-[0.92rem] text-slate-500 dark:text-slate-400">
                            <span>{project.taskCount ?? 0} tasks</span>
                            <span>{project.deadline ? formatShortDate(project.deadline) : "No deadline"}</span>
                          </div>

                          {canManageProjects ? (
                            <div className="mt-5 flex items-center gap-4">
                              <Button
                                className="rounded-[18px] px-5 dark:border-[#2a3a53] dark:bg-[#0f182d] dark:text-white dark:hover:bg-[#132033]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openProjectModal(project);
                                }}
                                type="button"
                                variant="secondary"
                              >
                                Edit
                              </Button>
                              <Button
                                className="px-0 font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteProject(project);
                                }}
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState
                      action={canManageProjects ? <Button onClick={() => openProjectModal()}>Create project</Button> : undefined}
                      description="Nothing matches the current filters."
                      title="No projects found"
                    />
                  )}
                </div>
              </SectionCard>

              <SectionCard
                action={
                  selectedProjectPreview ? (
                    <a className="inline-flex" href={selectedProjectPreview.href} rel="noreferrer" target="_blank">
                      <Button className="dark:border-[#25354a] dark:bg-[#0f182b] dark:text-white dark:hover:bg-[#122033]" variant="secondary">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {selectedProjectPreview.label}
                      </Button>
                    </a>
                  ) : null
                }
                className="project-panel min-w-0 dark:border-[#162437] dark:bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(7,13,25,0.98))]"
                eyebrow="Preview"
                title={selectedProject ? selectedProject.name : "Project preview"}
              >
                {selectedProject ? (
                  <div className="min-w-0 space-y-5">
                    <div className="project-preview-frame-shell">
                      <DesktopReviewFrame
                        previewType={selectedProjectPreviewType}
                        imageUrl={selectedProject.previewImageUrl}
                        title={selectedProject.name}
                        url={selectedProject.previewUrl}
                        videoUrl={selectedProject.previewVideoUrl}
                      />
                    </div>

                    <div className="project-detail-panel rounded-[30px] border border-slate-200/70 bg-white/70 p-5 dark:border-[#1a2840] dark:bg-[linear-gradient(180deg,rgba(8,14,27,0.98),rgba(8,14,27,0.98))]">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={labelize(selectedProject.status)} tone={projectTone(selectedProject.status)} />
                        <StatusPill
                          label={selectedProjectPreviewType === "none" ? "No preview" : `${labelize(selectedProjectPreviewType)} preview`}
                          tone="default"
                        />
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedProject.description}</p>

                      <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Start date</p>
                          <p className="mt-1.5 font-semibold text-slate-900 dark:text-white">
                            {selectedProject.startDate ? formatShortDate(selectedProject.startDate) : "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Priority</p>
                          <p className="mt-1.5 font-semibold text-slate-900 dark:text-white">{labelize(selectedProject.priority)}</p>
                        </div>
                        <div>
                          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Deadline</p>
                          <p className={cn("mt-1.5 font-semibold", isOverdue(selectedProject.deadline) ? "text-rose-500" : "text-slate-900 dark:text-white")}>
                            {selectedProject.deadline ? relativeDate(selectedProject.deadline) : "Flexible"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <p className="text-slate-400">Overall progress</p>
                          <p className="font-semibold text-slate-900 dark:text-white">{selectedProjectProgressValue}%</p>
                        </div>
                        <div className="h-3 rounded-full bg-slate-900/8 dark:bg-white/8">
                          <div className="h-3 rounded-full bg-accent-500 dark:bg-lime-500" style={{ width: `${selectedProjectProgressValue}%` }} />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="project-stat-panel rounded-[22px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.035]">
                          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Tasks</p>
                          <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{selectedProjectTaskCount}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{selectedProjectCompletedTasks} completed</p>
                        </div>
                        <div className="project-stat-panel rounded-[22px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.035]">
                          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">Milestones</p>
                          <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{selectedProjectMilestones.length}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{selectedProjectOpenRequests} open requests</p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Assigned team</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.teamMembers.length ? (
                            selectedProject.teamMembers.map((member) => (
                              <span
                                key={member._id}
                                className="project-tag-chip rounded-full bg-slate-900/5 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-white/8 dark:text-slate-300"
                              >
                                {member.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">No team assigned yet</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedProject.tags.map((tag) => (
                          <StatusPill key={tag} label={tag} tone="default" />
                        ))}
                      </div>
                    </div>

                    {selectedProjectMilestones.length ? (
                      <div className="project-detail-panel min-w-0 rounded-[30px] border border-slate-200/70 bg-white/70 p-5 dark:border-[#1a2840] dark:bg-[linear-gradient(180deg,rgba(8,14,27,0.98),rgba(8,14,27,0.98))]">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-display text-3xl text-slate-900 dark:text-white">Milestones</h3>
                          <StatusPill label={`${selectedProjectMilestones.length} tracked`} tone="success" />
                        </div>
                        <div className="mt-4 grid gap-3">
                          {selectedProjectMilestones.map((milestone) => (
                            <div key={milestone._id} className="project-milestone-card rounded-[22px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.035]">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">{milestone.title}</p>
                                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    {milestone.dueDate ? `Due ${formatShortDate(milestone.dueDate)}` : "No due date set"}
                                  </p>
                                </div>
                                <StatusPill label={labelize(milestone.status)} tone={milestone.status === "completed" ? "success" : "info"} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState description="Select a project to inspect its preview, metadata, attachments, and related work." title="No active project" />
                )}
              </SectionCard>
            </section>
          ) : null}

          {activeView === "tasks" ? (
            isClientWorkspace ? (
              <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard caption="Tasks still being worked on" title="Open Tasks" value={clientOpenTasks.length} />
                  <StatCard caption="Tasks already completed" title="Completed" value={clientCompletedTasks.length} />
                  <StatCard caption="Milestones tracked for this project" title="Milestones" value={clientVisibleMilestones.length} />
                  <StatCard caption="Items with a due date coming up next" title="Due Soon" value={upcomingClientDeadlines.length} />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <SectionCard eyebrow="Tasks" title={selectedProject ? `${selectedProject.name} tasks` : "Project tasks"}>
                    <div className="space-y-3">
                      {clientVisibleTasks.length ? (
                        clientVisibleTasks.map((task) => {
                          const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

                          return (
                            <button
                              key={task._id}
                              className={cn(
                                "w-full rounded-[24px] border p-4 text-left transition",
                                selectedTaskId === task._id
                                  ? "border-accent-400 bg-accent-500/8 dark:border-lime-400 dark:bg-lime-500/10"
                                  : "border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                              )}
                              onClick={() => openTaskWorkspace(task)}
                              type="button"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusPill label={labelize(task.status)} tone="info" />
                                  <StatusPill label={labelize(task.priority)} tone={priorityTone(task.priority)} />
                                  {task.milestone ? <StatusPill label="Milestone" tone="success" /> : null}
                                </div>
                              </div>
                              <div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                                <span>{task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : "No due date"}</span>
                                <span>{task.assignee?.name ? `Assigned to ${task.assignee.name}` : "Team assignment pending"}</span>
                                <span>{task.subtasks.length ? `${completedSubtasks}/${task.subtasks.length} subtasks complete` : "No subtasks"}</span>
                                <span>{task.reporter?.name ? `Requested by ${task.reporter.name}` : "Shared with your team"}</span>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <EmptyState
                          description="No tasks match the current project, search, or selected priority filter."
                          title="No tasks to review"
                        />
                      )}
                    </div>
                  </SectionCard>

                  <div className="space-y-6">
                    <SectionCard
                      action={
                        selectedTask ? (
                          <Button onClick={() => setActiveView("collaboration")} variant="secondary">
                            <MessagesSquare className="mr-2 h-4 w-4" />
                            Add comment
                          </Button>
                        ) : undefined
                      }
                      eyebrow="Selected Task"
                      title={selectedTask ? selectedTask.title : "Choose a task to inspect"}
                    >
                      {selectedTask ? (
                        <div className="space-y-4">
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedTask.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <StatusPill label={labelize(selectedTask.status)} tone="info" />
                            <StatusPill label={labelize(selectedTask.priority)} tone={priorityTone(selectedTask.priority)} />
                            {selectedTask.milestone ? <StatusPill label="Milestone" tone="success" /> : null}
                          </div>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-[22px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Due date</p>
                              <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                                {selectedTask.dueDate ? formatShortDate(selectedTask.dueDate) : "Not scheduled"}
                              </p>
                            </div>
                            <div className="rounded-[22px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assigned team member</p>
                              <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                                {selectedTask.assignee?.name ?? "Unassigned"}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Subtasks</p>
                            <div className="space-y-2">
                              {selectedTask.subtasks.length ? (
                                selectedTask.subtasks.map((subtask) => (
                                  <div
                                    key={subtask._id ?? subtask.title}
                                    className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/70 px-4 py-3 dark:border-slate-800"
                                  >
                                    <p className="text-sm text-slate-700 dark:text-slate-200">{subtask.title}</p>
                                    <StatusPill label={subtask.completed ? "Done" : "Pending"} tone={subtask.completed ? "success" : "default"} />
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-[18px] border border-dashed border-slate-300/70 px-4 py-4 text-sm text-slate-400 dark:border-slate-700">
                                  No subtasks were added to this task yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          description="Pick a task from the list to see its due date, assignee, and subtasks."
                          title="No task selected"
                        />
                      )}
                    </SectionCard>

                    <SectionCard eyebrow="Milestones" title="Milestones & deadlines">
                      <div className="space-y-3">
                        {clientVisibleMilestones.length ? (
                          clientVisibleMilestones.slice(0, 5).map((task) => (
                            <button
                              key={task._id}
                              className="ui-hover-surface w-full rounded-[24px] border border-slate-200/70 bg-white/70 p-4 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                              onClick={() => openTaskWorkspace(task)}
                              type="button"
                            >
                              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : "No due date yet"}
                                  </p>
                                </div>
                                <StatusPill label={labelize(task.status)} tone={task.status === "completed" ? "success" : "info"} />
                              </div>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            description="Milestones will show up here as soon as your team adds them to the project."
                            title="No milestones yet"
                          />
                        )}
                      </div>
                    </SectionCard>
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedTask ? (
                  <SectionCard eyebrow="Focus" title={selectedTask.title}>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedTask.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <StatusPill label={labelize(selectedTask.status)} tone="info" />
                          <StatusPill label={labelize(selectedTask.priority)} tone={priorityTone(selectedTask.priority)} />
                          {selectedTask.milestone ? <StatusPill label="Milestone" tone="success" /> : null}
                        </div>
                        {canManageTasks ? (
                          <div className="mt-4 max-w-sm xl:hidden">
                            <FieldLabel>Update progress</FieldLabel>
                            <SelectField
                              onChange={(event) => void handleTaskMove(selectedTask._id, event.target.value as TaskStatus)}
                              value={selectedTask.status}
                            >
                              {taskStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {labelize(status)}
                                </option>
                              ))}
                            </SelectField>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedTask.dueDate ? `Due ${formatShortDate(selectedTask.dueDate)}` : "No due date"}
                      </div>
                    </div>
                  </SectionCard>
                ) : null}
                <SectionCard
                  action={canManageTasks ? <Button onClick={() => openTaskModal()}><Plus className="mr-2 h-4 w-4" />New task</Button> : undefined}
                  eyebrow="Execution"
                  title="Realtime Task Board"
                >
                  <KanbanBoard
                    canManage={canManageTasks}
                    onDelete={(task) => void handleDeleteTask(task)}
                    onEdit={(task) => openTaskModal(task)}
                    onMove={(taskId, status) => void handleTaskMove(taskId, status)}
                    onSelect={(task) => openTaskWorkspace(task)}
                    tasks={visibleTasks}
                  />
                </SectionCard>
              </div>
            )
          ) : null}

          {activeView === "collaboration" ? (
            isClientWorkspace ? (
              selectedProject ? (
                <div className="space-y-6">
                  <SectionCard eyebrow="Collaboration" title={feedbackComposerMode === "comment" ? "Chat" : "Requests"}>
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                      <div className="space-y-4">
                        <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Choose a lane</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button onClick={() => setFeedbackComposerMode("comment")} variant={feedbackComposerMode === "comment" ? "secondary" : "ghost"}>
                              Chat
                            </Button>
                            <Button
                              onClick={() => {
                                setReplyToCommentId(null);
                                setRequestSourceCommentId(null);
                                setFeedbackComposerMode("request");
                              }}
                              variant={feedbackComposerMode === "request" ? "secondary" : "ghost"}
                            >
                              Request
                            </Button>
                          </div>
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            {feedbackComposerMode === "comment"
                              ? "Use chat for back-and-forth conversation, quick feedback, and approvals."
                              : "Use a request when something should be tracked as a change or deliverable."}
                          </p>
                        </div>

                        {feedbackComposerMode === "comment" ? (
                          <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">How to use chat</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              Use the thread below like normal messaging. Reply to a specific message when you want to answer in context. Use requests only for changes that
                              should be tracked.
                            </p>
                          </div>
                        ) : (
                          <>
                            {requestSourceComment ? renderRequestSourceCard(requestSourceComment, true) : null}
                            <div>
                              <FieldLabel>Request title</FieldLabel>
                              <TextField
                                onChange={(event) => setRequestTitle(event.target.value)}
                                placeholder="What needs to change?"
                                value={requestTitle}
                              />
                            </div>
                            <div>
                              <FieldLabel>Details</FieldLabel>
                              <TextArea
                                onChange={(event) => setRequestDescription(event.target.value)}
                                placeholder="Describe the change, feature, bug fix, resource, or deliverable you need."
                                rows={5}
                                value={requestDescription}
                              />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <FieldLabel>Priority</FieldLabel>
                                <SelectField onChange={(event) => setRequestPriority(event.target.value as Priority)} value={requestPriority}>
                                  {priorities.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {labelize(priority)}
                                    </option>
                                  ))}
                                </SelectField>
                              </div>
                              <div>
                                <FieldLabel>Attachments</FieldLabel>
                                <TextField multiple onChange={(event) => setRequestFiles(Array.from(event.target.files ?? []))} type="file" />
                              </div>
                            </div>

                            <Button disabled={working || !requestTitle.trim() || !requestDescription.trim()} onClick={() => void handleRequestSubmit()}>
                              Submit request
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current context</p>
                          <p className="mt-2 font-semibold text-slate-900 dark:text-white">{feedbackContextLabel}</p>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {selectedTask
                              ? "Anything sent here will be linked to the selected task and still stay visible in the project conversation."
                              : "Anything sent here will be linked to the current project automatically."}
                          </p>
                        </div>

                          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                            <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Chat messages</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{chatMessages.length}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Messages currently linked to this view</p>
                          </div>
                          <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open requests</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{selectedProjectOpenRequests}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Items still waiting on closure</p>
                          </div>
                          <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">People involved</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">
                              {selectedProject.teamMembers.length + selectedProject.clients.length}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Assigned collaborators on this project</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {feedbackComposerMode === "comment" ? (
                    renderChatConversation(`Messages between your team and ${brandName} will appear here.`, "Write a message to your team...")
                  ) : (
                    <SectionCard eyebrow="Requests" title="Tracked requests">
                      <div className="space-y-3">
                        {relevantRequests.length ? (
                          relevantRequests.map((request) => (
                            <div key={request._id} className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill label={labelize(request.status)} tone={request.status === "completed" ? "success" : "info"} />
                                    <StatusPill label={labelize(request.priority)} tone={priorityTone(request.priority)} />
                                  </div>
                                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">{request.title}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Requested by {request.createdBy.name}</p>
                                </div>
                                <p className="text-sm text-slate-400">{formatShortDate(request.createdAt)}</p>
                              </div>

                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{request.description}</p>
                              {request.sourceComment ? (
                                <div className="mt-4 rounded-[20px] border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created from chat</p>
                                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {request.sourceComment.author?.name ?? "Project chat"} · {formatChatTimestamp(request.sourceComment.createdAt)}
                                  </p>
                                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                                    {summarizeChatMessage(request.sourceComment.content, request.sourceComment.attachments ?? [])}
                                  </p>
                                </div>
                              ) : null}
                              {canManageRequests ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button onClick={() => void handleRequestStatusToggle(request)} variant="secondary">
                                    {request.status === "completed" ? "Reopen request" : "Mark done"}
                                  </Button>
                                  {isAdminWorkspace ? (
                                    <Button onClick={() => void handleDeleteRequest(request)} variant="ghost">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                              {canManageRequests ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button onClick={() => void handleRequestStatusToggle(request)} variant="secondary">
                                    {request.status === "completed" ? "Reopen request" : "Mark done"}
                                  </Button>
                                  {isAdminWorkspace ? (
                                    <Button onClick={() => void handleDeleteRequest(request)} variant="ghost">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            description="Tracked requests will appear here once you submit one."
                            title="No requests yet"
                          />
                        )}
                      </div>
                    </SectionCard>
                  )}
                </div>
              ) : (
                <EmptyState
                  action={
                    <Button onClick={() => setActiveView("projects")} variant="secondary">
                      Browse projects
                    </Button>
                  }
                  description="Choose a project first so comments and requests stay linked to the right work."
                  title="No project selected"
                />
              )
            ) : (
              <div className="space-y-6">
                <SectionCard eyebrow="Conversation" title="Choose project and client">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <FieldLabel>Project</FieldLabel>
                        <SelectField
                          onChange={(event) => {
                            const nextProjectId = event.target.value || null;
                            setSelectedProjectId(nextProjectId);
                            setSelectedTaskId(null);
                            setReplyToCommentId(null);
                            setRequestSourceCommentId(null);
                            setSelectedAdminClientId("all");
                          }}
                          value={selectedProjectId ?? ""}
                        >
                          <option value="">Select project</option>
                          {[...projects]
                            .sort((left, right) => left.name.localeCompare(right.name))
                            .map((project) => (
                              <option key={project._id} value={project._id}>
                                {project.name}
                              </option>
                            ))}
                        </SelectField>
                      </div>

                      <div>
                        <FieldLabel>Client thread</FieldLabel>
                        <SelectField
                          disabled={!selectedProject || !selectedProject.clients.length}
                          onChange={(event) => {
                            setSelectedAdminClientId(event.target.value);
                            setReplyToCommentId(null);
                            setRequestSourceCommentId(null);
                          }}
                          value={selectedAdminClientId}
                        >
                          <option value="all">All client messages</option>
                          {(selectedProject?.clients ?? []).map((client) => (
                            <option key={client._id} value={client._id}>
                              {client.name}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current reply lane</p>
                      <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                        {selectedProject
                          ? selectedCollaborationClient
                            ? `${selectedProject.name} / ${selectedCollaborationClient.name}`
                            : `${selectedProject.name} / All client activity`
                          : "Select a project to begin"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {selectedCollaborationClient
                          ? `Replies in chat will keep ${selectedCollaborationClient.name} in focus so you can answer the right client quickly.`
                          : selectedProject
                            ? "Choose one client only when you want to answer a focused client thread. Leave it on all messages to manage the full project feed."
                            : "Pick a project first, then narrow the thread down to one client when needed."}
                      </p>
                    </div>
                  </div>
                </SectionCard>

                {selectedProject ? (
                  <div className="space-y-6">
                  <SectionCard eyebrow="Collaboration" title={feedbackComposerMode === "comment" ? "Chat" : "Requests"}>
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                      <div className="space-y-4">
                        <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Choose a lane</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button onClick={() => setFeedbackComposerMode("comment")} variant={feedbackComposerMode === "comment" ? "secondary" : "ghost"}>
                              Chat
                            </Button>
                            <Button
                              onClick={() => {
                                setReplyToCommentId(null);
                                setRequestSourceCommentId(null);
                                setFeedbackComposerMode("request");
                              }}
                              variant={feedbackComposerMode === "request" ? "secondary" : "ghost"}
                            >
                              Request
                            </Button>
                          </div>
                          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            {feedbackComposerMode === "comment"
                              ? selectedCollaborationClient
                                ? `You are replying inside ${selectedCollaborationClient.name}'s thread.`
                                : "Use chat for day-to-day conversation, approvals, and delivery notes."
                              : "Use a request when the item should be tracked with status and priority."}
                          </p>
                        </div>

                        {feedbackComposerMode === "comment" ? (
                          <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">How to use chat</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {selectedCollaborationClient
                                ? `Reply normally here to keep ${selectedCollaborationClient.name}'s conversation together. Move only tracked change work into requests.`
                                : "Keep normal delivery back-and-forth in the message thread below. Reply to the exact message you are answering, and move only tracked change work into requests."}
                            </p>
                          </div>
                        ) : (
                          <>
                            {requestSourceComment ? renderRequestSourceCard(requestSourceComment, true) : null}
                            <div>
                              <FieldLabel>Request title</FieldLabel>
                              <TextField onChange={(event) => setRequestTitle(event.target.value)} placeholder="Request title" value={requestTitle} />
                            </div>
                            <div>
                              <FieldLabel>Details</FieldLabel>
                              <TextArea
                                onChange={(event) => setRequestDescription(event.target.value)}
                                placeholder="Describe the change, resource, feature, or deliverable needed..."
                                rows={5}
                                value={requestDescription}
                              />
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <FieldLabel>Status</FieldLabel>
                                <SelectField onChange={(event) => setRequestStatus(event.target.value as RequestStatus)} value={requestStatus}>
                                  {requestStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {labelize(status)}
                                    </option>
                                  ))}
                                </SelectField>
                              </div>
                              <div>
                                <FieldLabel>Priority</FieldLabel>
                                <SelectField onChange={(event) => setRequestPriority(event.target.value as Priority)} value={requestPriority}>
                                  {priorities.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {labelize(priority)}
                                    </option>
                                  ))}
                                </SelectField>
                              </div>
                              <div>
                                <FieldLabel>Attachments</FieldLabel>
                                <TextField multiple onChange={(event) => setRequestFiles(Array.from(event.target.files ?? []))} type="file" />
                              </div>
                            </div>

                            <Button disabled={working || !requestTitle.trim() || !requestDescription.trim()} onClick={() => void handleRequestSubmit()}>
                              Submit request
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current context</p>
                          <p className="mt-2 font-semibold text-slate-900 dark:text-white">{feedbackContextLabel}</p>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {selectedTask
                              ? "Anything sent here will be linked to the selected task and still stay visible in the wider project feed."
                              : selectedCollaborationClient
                                ? `Anything sent here stays on ${selectedCollaborationClient.name}'s thread inside this project.`
                                : "Anything sent here will be linked to the current project automatically."}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                          <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Chat messages</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{collaborationChatMessages.length}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {selectedCollaborationClient ? "Messages in this client thread" : "Messages currently linked to this project"}
                            </p>
                          </div>
                          <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open requests</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">{collaborationOpenRequests}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {selectedCollaborationClient ? "Tracked items for this client" : "Items still waiting on closure"}
                            </p>
                          </div>
                          <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">People involved</p>
                            <p className="mt-2 font-display text-3xl text-slate-900 dark:text-white">
                              {selectedCollaborationClient ? 1 : selectedProject.teamMembers.length + selectedProject.clients.length}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {selectedCollaborationClient ? "Focused client account" : "Assigned collaborators on this project"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {feedbackComposerMode === "comment" ? (
                    renderChatConversation(
                      selectedCollaborationClient
                        ? `Messages involving ${selectedCollaborationClient.name} will appear here.`
                        : "Messages between the team and client will appear here.",
                      selectedCollaborationClient
                        ? `Write a message to ${selectedCollaborationClient.name}...`
                        : "Write a message to the client or delivery team..."
                    )
                  ) : (
                    <SectionCard eyebrow="Requests" title="Tracked requests">
                      <div className="space-y-3">
                        {collaborationRequests.length ? (
                          collaborationRequests.map((request) => (
                            <div key={request._id} className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill label={labelize(request.status)} tone={request.status === "completed" ? "success" : "info"} />
                                    <StatusPill label={labelize(request.priority)} tone={priorityTone(request.priority)} />
                                  </div>
                                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">{request.title}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Requested by {request.createdBy.name}</p>
                                </div>
                                <p className="text-sm text-slate-400">{formatShortDate(request.createdAt)}</p>
                              </div>

                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{request.description}</p>
                              {request.sourceComment ? (
                                <div className="mt-4 rounded-[20px] border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created from chat</p>
                                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {request.sourceComment.author?.name ?? "Project chat"} · {formatChatTimestamp(request.sourceComment.createdAt)}
                                  </p>
                                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                                    {summarizeChatMessage(request.sourceComment.content, request.sourceComment.attachments ?? [])}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            description={
                              selectedCollaborationClient
                                ? `Tracked requests for ${selectedCollaborationClient.name} will appear here once one is created.`
                                : "Tracked requests will appear here once one is created."
                            }
                            title="No requests yet"
                          />
                        )}
                      </div>
                    </SectionCard>
                  )}
                </div>
              ) : (
                <EmptyState
                  action={
                    <Button onClick={() => setActiveView("projects")} variant="secondary">
                      Browse projects
                    </Button>
                  }
                  description="Choose a project above to open the right client conversation."
                  title="No project selected"
                />
              )}
            </div>
            )
          ) : null}

          {activeView === "timeline" ? (
            isClientWorkspace ? (
              <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-3">
                  <StatCard caption="Notifications you have not opened yet" title="Unread Alerts" value={unreadNotificationsCount} />
                  <StatCard caption="Tasks and milestones due soon" title="Upcoming Deadlines" value={upcomingClientDeadlines.length} />
                  <StatCard caption="Milestones already completed for this project" title="Completed Milestones" value={clientCompletedMilestones} />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                  <SectionCard
                    action={
                      <Button onClick={() => void markAllNotificationsRead()} variant="secondary">
                        Mark all read
                      </Button>
                    }
                    eyebrow="Updates"
                    title="Notifications & activity"
                  >
                    <div className="space-y-5">
                      <div>
                        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-400">Notifications</p>
                        <div className="space-y-3">
                          {notifications.length ? (
                            notifications.slice(0, 8).map((notification) => (
                              <div
                                key={notification._id}
                                className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-semibold text-slate-900 dark:text-white">{notification.title}</p>
                                  <StatusPill label={notification.readAt ? "Read" : "New"} tone={notification.readAt ? "default" : "info"} />
                                </div>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{notification.message}</p>
                              </div>
                            ))
                          ) : (
                            <EmptyState description="New alerts will appear here as soon as your team posts updates." title="No alerts yet" />
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-400">Recent activity</p>
                        <div className="space-y-3">
                          {recentClientActivity.length ? (
                            recentClientActivity.map((activity) => (
                              <div key={activity._id} className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{activity.message}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{labelize(activity.action)}</p>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              description="Project activity will appear here as tasks move forward and milestones get completed."
                              title="No recent activity"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <div className="space-y-6">
                    <SectionCard eyebrow="Planning" title="Deadline calendar">
                      <DeadlineCalendar tasks={clientTimelineTasks} />
                    </SectionCard>

                    <SectionCard eyebrow="Next Up" title="Upcoming deadlines">
                      <div className="space-y-3">
                        {upcomingClientDeadlines.length ? (
                          upcomingClientDeadlines.map((task) => (
                            <button
                              key={task._id}
                              className="ui-hover-surface w-full rounded-[24px] border border-slate-200/70 bg-white/70 p-4 text-left transition dark:border-slate-800 dark:bg-slate-950/40"
                              onClick={() => openTaskWorkspace(task)}
                              type="button"
                            >
                              <div className="space-y-4 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:space-y-0">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : "No due date"}
                                  </p>
                                </div>
                                <StatusPill label={labelize(task.status)} tone={task.status === "completed" ? "success" : "info"} />
                              </div>
                            </button>
                          ))
                        ) : (
                          <EmptyState description="You do not have any upcoming dated tasks in the current view." title="Schedule is clear" />
                        )}
                      </div>
                    </SectionCard>
                  </div>
                </section>
              </div>
            ) : (
              <section className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
                <SectionCard
                  action={
                    <Button onClick={() => void markAllNotificationsRead()} variant="secondary">
                      Mark all read
                    </Button>
                  }
                  eyebrow="Signal"
                  title="Notifications & Activity"
                >
                  <div className="scrollbar-thin max-h-[620px] space-y-4 overflow-y-auto pr-1">
                    {notifications.map((notification) => (
                      <div key={notification._id} className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{notification.title}</p>
                          <StatusPill label={notification.readAt ? "Read" : "New"} tone={notification.readAt ? "default" : "info"} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{notification.message}</p>
                      </div>
                    ))}
                    {(summary?.recentActivity ?? []).map((activity) => (
                      <div key={activity._id} className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{activity.message}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{labelize(activity.action)}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard eyebrow="Planning" title="Deadline Calendar">
                  <DeadlineCalendar tasks={summary?.upcomingDeadlines ?? []} />
                </SectionCard>
              </section>
            )
          ) : null}

          {activeView === "users" ? (
            isClientWorkspace ? (
              <EmptyState
                action={
                  <Button onClick={() => setActiveView("overview")} variant="secondary">
                    Back to dashboard
                  </Button>
                }
                description="This directory is only available to internal admins."
                title="Users view unavailable"
              />
            ) : (
              <section className="space-y-6">
                <section className="grid gap-4 md:grid-cols-3">
                  <StatCard caption="People with full system ownership" title="Master Admins" value={masterAdminUsers.length} />
                  <StatCard caption="Internal team members managing delivery" title="Admins" value={adminUsers.length} />
                  <StatCard caption="Clients invited into project workspaces" title="Clients" value={clientUsers.length} />
                </section>

                <section className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.25fr)_360px]">
                  <SectionCard
                    className="min-w-0"
                    action={
                      canInviteUsers ? (
                        <Button className="w-full sm:w-auto" onClick={() => setInviteModalOpen(true)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite account
                        </Button>
                      ) : undefined
                    }
                    eyebrow="Directory"
                    title="People directory"
                  >
                    <div className="space-y-4">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <TextField
                          onChange={(event) => setDirectorySearch(event.target.value)}
                          placeholder="Search by name, email, or title"
                          value={directorySearch}
                        />
                        <SelectField onChange={(event) => setDirectoryRoleFilter(event.target.value)} value={directoryRoleFilter}>
                          <option value="all">All account types</option>
                          <option value="internal">Internal team</option>
                          <option value="master_admin">Master Admins</option>
                          <option value="admin">Admins</option>
                          <option value="client">Clients</option>
                        </SelectField>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          {visibleDirectoryUsers.length} visible
                        </span>
                        <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          {visibleDirectoryUsers.filter((user) => user.role !== "client").length} internal
                        </span>
                        <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          {visibleDirectoryUsers.filter((user) => user.role === "client").length} clients
                        </span>
                      </div>

                      <div className="scrollbar-thin max-h-[760px] overflow-y-auto pr-1">
                        <UserDirectoryList
                          canEdit={isMasterAdminWorkspace}
                          onEdit={isMasterAdminWorkspace ? (user) => openUserModal(user) : undefined}
                          projectCounts={userProjectCounts}
                          users={visibleDirectoryUsers}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <div className="min-w-0 space-y-6">
                    <SectionCard className="min-w-0" eyebrow="Pending" title="Invites sent">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                            {pendingInvites.length} active
                          </span>
                        </div>
                        {pendingInvites.length ? (
                          pendingInvites.slice(0, 8).map((invite) => (
                            <div key={invite.id} className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                              <div className="space-y-4 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:space-y-0">
                                <div className="min-w-0">
                                  <p className="break-all font-semibold text-slate-900 dark:text-white">{invite.email}</p>
                                  <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                                    {labelize(invite.role)} invite
                                    {invite.expiresAt ? ` · Expires ${relativeDate(invite.expiresAt)}` : ""}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs sm:hidden">
                                  <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                                    {labelize(invite.role)} invite
                                  </span>
                                  {invite.expiresAt ? (
                                    <span className="rounded-full bg-slate-900/5 px-3 py-2 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                                      Expires {relativeDate(invite.expiresAt)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                                  <Button
                                    className="w-full sm:w-auto"
                                    disabled={working}
                                    onClick={() => void handleInviteResend(invite.id)}
                                    variant="ghost"
                                  >
                                    <CornerDownLeft className="mr-2 h-4 w-4" />
                                    Resend invite
                                  </Button>
                                  <Button
                                    className="w-full sm:w-auto"
                                    disabled={working}
                                    onClick={() => void navigator.clipboard.writeText(invite.inviteLink).catch(() => undefined)}
                                    variant="secondary"
                                  >
                                    Copy link
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">New invites will stay here until the person accepts and creates their account.</p>
                        )}
                      </div>
                    </SectionCard>

                    <SectionCard className="min-w-0" eyebrow="How It Works" title="Teams and accounts">
                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="font-semibold text-slate-900 dark:text-white">Every person has their own account</p>
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Internal admins and clients are invited by email, then they register and sign in with their own login. The directory is an account list, not a
                            shared contact sheet.
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="font-semibold text-slate-900 dark:text-white">Teams are added per project</p>
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Invite an internal admin first, then add that account to a project's internal team inside the project editor. Clients are added separately to the
                            client list for that project.
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="font-semibold text-slate-900 dark:text-white">Designed for bigger directories</p>
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Search, role filters, and project counts keep the directory usable as it grows. If you want departments or named team groups later, that would be a
                            separate structure on top of these individual accounts.
                          </p>
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                </section>
              </section>
            )
          ) : null}

          {activeView === "account" ? (
            <section className="space-y-6">
              {!isClientWorkspace ? (
                <SectionCard className="min-w-0 xl:hidden" eyebrow="Workspace Tools" title="Quick actions">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {canInviteUsers ? (
                      <Button className="w-full" onClick={() => setInviteModalOpen(true)} variant="secondary">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite user
                      </Button>
                    ) : null}
                    <Button className="w-full" onClick={() => void downloadProjectsCsv()} variant="secondary">
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </SectionCard>
              ) : null}

              <section className="grid items-start gap-6 xl:grid-cols-[1fr_0.95fr]">
                <SectionCard
                  className="min-w-0"
                  action={<Button className="w-full sm:w-auto" onClick={() => void handleProfileSave()}>Save profile</Button>}
                  eyebrow="Profile"
                  title="Your details"
                >
                  <div className="space-y-4">
                    <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Account overview</p>
                      <p className="mt-2 font-semibold text-slate-900 dark:text-white">{session.user.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {labelize(session.user.role)} account with access to {projects.length} project{projects.length === 1 ? "" : "s"}.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <FieldLabel>Full name</FieldLabel>
                        <TextField onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} value={profileForm.name} />
                      </div>
                      <div>
                        <FieldLabel>Email address</FieldLabel>
                        <TextField onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} type="email" value={profileForm.email} />
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Job title</FieldLabel>
                      <TextField
                        onChange={(event) => setProfileForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Client lead, product owner, marketing manager..."
                        value={profileForm.title}
                      />
                    </div>
                  </div>
                </SectionCard>

                <div className="min-w-0 space-y-6">
                  {isMasterAdminWorkspace ? (
                    <SectionCard
                      className="min-w-0"
                      action={<Button className="w-full sm:w-auto" onClick={() => void handleBrandingSave()} variant="secondary">Save branding</Button>}
                      eyebrow="Branding"
                      title="White label"
                    >
                      <div className="space-y-4">
                        <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Preview</p>
                          <div className="mt-3">
                            <BrandMark
                              branding={{
                                brandName: brandingForm.brandName.trim() || defaultBranding.brandName,
                                logoUrl: brandingFiles.length ? "" : brandingForm.logoUrl,
                                logoSize: brandingForm.logoSize
                              }}
                              subtitle="Shown across the login page and workspace"
                            />
                          </div>
                          {brandingFiles.length ? (
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                              New upload ready: {brandingFiles[0].name}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <FieldLabel>Brand name</FieldLabel>
                          <TextField
                            onChange={(event) => setBrandingForm((current) => ({ ...current, brandName: event.target.value }))}
                            placeholder="Your company name"
                            value={brandingForm.brandName}
                          />
                        </div>

                        <div>
                          <FieldLabel>Logo URL</FieldLabel>
                          <TextField
                            onChange={(event) => setBrandingForm((current) => ({ ...current, logoUrl: event.target.value }))}
                            placeholder="https://assets.example.com/logo.png"
                            value={brandingForm.logoUrl}
                          />
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <FieldLabel>Logo image size</FieldLabel>
                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                              {Math.round(brandingForm.logoSize * 100)}%
                            </span>
                          </div>
                          <input
                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent-500 dark:bg-slate-800 dark:accent-lime-400"
                            max={180}
                            min={80}
                            onChange={(event) =>
                              setBrandingForm((current) => ({
                                ...current,
                                logoSize: Number(event.target.value) / 100
                              }))
                            }
                            step={5}
                            type="range"
                            value={Math.round(brandingForm.logoSize * 100)}
                          />
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Increase or reduce the logo image inside the fixed logo frame used across the login page and workspace.
                          </p>
                        </div>

                        <div>
                          <FieldLabel>Upload logo</FieldLabel>
                          <TextField
                            accept="image/*"
                            onChange={(event) => setBrandingFiles(Array.from(event.target.files ?? []).slice(0, 1))}
                            type="file"
                          />
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Upload one image or use a direct image URL like `.png` or `.jpg`. Website homepages will not render as logos.
                          </p>
                        </div>
                      </div>
                    </SectionCard>
                  ) : null}

                  {isMasterAdminWorkspace ? (
                    <SectionCard className="min-w-0" eyebrow="Demo workspace" title="Sample data">
                      <div className="space-y-4">
                        <div className="rounded-[24px] bg-slate-900/[0.04] p-4 dark:bg-white/[0.04]">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill
                              label={demoDataStatus?.populated ? "Demo data active" : "Demo data empty"}
                              tone={demoDataStatus?.populated ? "info" : "default"}
                            />
                            <StatusPill label={`${demoDataStatus?.counts.projects ?? 0} projects`} tone="default" />
                            <StatusPill label={`${demoDataStatus?.counts.tasks ?? 0} tasks`} tone="default" />
                            <StatusPill label={`${demoDataStatus?.counts.comments ?? 0} chat`} tone="default" />
                            <StatusPill label={`${demoDataStatus?.counts.requests ?? 0} requests`} tone="default" />
                            <StatusPill label={`${demoDataStatus?.counts.invites ?? 0} invites`} tone="default" />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Populate a safe demo workspace with sample admin, clients, projects, tasks, chat, requests, notifications, and a pending invite. Clear removes only generated demo records.
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Button className="w-full" disabled={working} onClick={() => void handlePopulateDemoData()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Populate demo data
                          </Button>
                          <Button
                            className="w-full"
                            disabled={working || !demoDataStatus?.populated}
                            onClick={() => void handleClearDemoData()}
                            variant="danger"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear demo data
                          </Button>
                        </div>

                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Sample sign-ins</p>
                          <div className="mt-3 space-y-3">
                            {(demoDataStatus?.sampleAccounts ?? []).map((account) => (
                              <div
                                key={account.email}
                                className="flex flex-col gap-1 rounded-[20px] border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/70"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-white">{account.name}</span>
                                  <StatusPill label={labelize(account.role)} tone="default" />
                                </div>
                                <span className="break-all font-mono text-[13px] text-slate-600 dark:text-slate-300">{account.email}</span>
                                <span className="font-mono text-[13px] text-slate-500 dark:text-slate-400">{account.password}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </SectionCard>
                  ) : null}

                  <SectionCard
                    className="min-w-0"
                    action={<Button className="w-full sm:w-auto" onClick={() => void handleProfileSave()} variant="secondary">Save preferences</Button>}
                    eyebrow="Notifications"
                    title="Choose what you want to hear about"
                  >
                    <div className="space-y-3">
                      {notificationPreferenceOptions.map((item) => {
                        const enabled = profileForm.notificationPreferences[item.key];

                        return (
                          <button
                            key={item.key}
                            className={cn(
                              "w-full rounded-[24px] border p-4 text-left transition",
                              enabled
                                ? "border-accent-300 bg-accent-500/[0.06] dark:border-lime-400 dark:bg-lime-500/[0.08]"
                                : "border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
                            )}
                            onClick={() =>
                              setProfileForm((current) => ({
                                ...current,
                                notificationPreferences: {
                                  ...current.notificationPreferences,
                                  [item.key]: !current.notificationPreferences[item.key]
                                }
                              }))
                            }
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                              </div>
                              <StatusPill label={enabled ? "On" : "Off"} tone={enabled ? "success" : "default"} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard
                    className="min-w-0"
                    action={<Button className="w-full sm:w-auto" onClick={() => void handlePasswordSave()} variant="secondary">Update password</Button>}
                    eyebrow="Security"
                    title="Change password"
                  >
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Current password</FieldLabel>
                        <TextField
                          onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                          type="password"
                          value={passwordForm.currentPassword}
                        />
                      </div>
                      <div>
                        <FieldLabel>New password</FieldLabel>
                        <TextField
                          onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                          type="password"
                          value={passwordForm.newPassword}
                        />
                      </div>
                      <div>
                        <FieldLabel>Confirm new password</FieldLabel>
                        <TextField
                          onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                          type="password"
                          value={passwordForm.confirmPassword}
                        />
                      </div>
                    </div>
                    {isMasterAdminWorkspace ? (
                      <div className="rounded-[22px] border border-dashed border-accent-300/70 bg-accent-500/[0.05] px-4 py-4 text-sm text-slate-600 dark:border-lime-400/50 dark:bg-lime-500/[0.08] dark:text-slate-300">
                        Need to reset a login without the current password? Use the <span className="font-semibold text-slate-900 dark:text-white">Users</span> tab. Master Admin can reset any account there, including their own.
                      </div>
                    ) : null}
                  </SectionCard>
                </div>
              </section>
            </section>
          ) : null}
        </div>
      </div>

      <Modal
        onClose={() => setProjectModalOpen(false)}
        open={projectModalOpen}
        size="xl"
        subtitle="Projects drive the entire client workspace."
        title={projectEditing ? "Edit project" : "Create project"}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <FieldLabel>Name</FieldLabel>
              <TextField onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} value={projectForm.name} />
            </div>
            <div>
              <FieldLabel>Summary</FieldLabel>
              <TextField onChange={(event) => setProjectForm((current) => ({ ...current, summary: event.target.value }))} value={projectForm.summary} />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <TextArea onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} rows={5} value={projectForm.description} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectField onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))} value={projectForm.status}>
                  {projectStatuses.map((status) => (
                    <option key={status} value={status}>{labelize(status)}</option>
                  ))}
                </SelectField>
              </div>
              <div>
                <FieldLabel>Priority</FieldLabel>
                <SelectField onChange={(event) => setProjectForm((current) => ({ ...current, priority: event.target.value as Priority }))} value={projectForm.priority}>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>{labelize(priority)}</option>
                  ))}
                </SelectField>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Start date</FieldLabel>
                <TextField onChange={(event) => setProjectForm((current) => ({ ...current, startDate: event.target.value }))} type="date" value={projectForm.startDate} />
              </div>
              <div>
                <FieldLabel>Deadline</FieldLabel>
                <TextField onChange={(event) => setProjectForm((current) => ({ ...current, deadline: event.target.value }))} type="date" value={projectForm.deadline} />
              </div>
            </div>
            <div>
              <FieldLabel>Preview mode</FieldLabel>
              <SelectField
                onChange={(event) => setProjectForm((current) => ({ ...current, previewType: event.target.value as ProjectPreviewType }))}
                value={projectForm.previewType}
              >
                <option value="website">Website</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="none">No preview</option>
              </SelectField>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Use website for live links, image or video for uploaded deliverables, or no preview when the project does not need one.
              </p>
            </div>
            {projectForm.previewType === "website" ? (
              <div>
                <FieldLabel>Website URL</FieldLabel>
                <TextField
                  onChange={(event) => setProjectForm((current) => ({ ...current, previewUrl: event.target.value }))}
                  placeholder="https://preview.example.com"
                  value={projectForm.previewUrl}
                />
              </div>
            ) : null}
            {projectForm.previewType === "image" ? (
              <div>
                <FieldLabel>Image URL</FieldLabel>
                <TextField
                  onChange={(event) => setProjectForm((current) => ({ ...current, previewImageUrl: event.target.value }))}
                  placeholder="https://assets.example.com/mockup.jpg"
                  value={projectForm.previewImageUrl}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Leave this blank to use the first uploaded image as the preview.</p>
              </div>
            ) : null}
            {projectForm.previewType === "video" ? (
              <div>
                <FieldLabel>Video URL</FieldLabel>
                <TextField
                  onChange={(event) => setProjectForm((current) => ({ ...current, previewVideoUrl: event.target.value }))}
                  placeholder="https://assets.example.com/demo.mp4"
                  value={projectForm.previewVideoUrl}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Leave this blank to use the first uploaded video as the preview.</p>
              </div>
            ) : null}
            {projectForm.previewType === "none" ? (
              <div className="rounded-[22px] border border-dashed border-slate-300/70 bg-slate-50/70 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300">
                This project will not show a dedicated preview card. Team members can still manage files, tasks, comments, and milestones normally.
              </div>
            ) : null}
            <div>
              <FieldLabel>Tags</FieldLabel>
              <TextField onChange={(event) => setProjectForm((current) => ({ ...current, tags: event.target.value }))} placeholder="SEO, CMS, Redesign" value={projectForm.tags} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <FieldLabel>Project type</FieldLabel>
              <TextField
                onChange={(event) => setProjectForm((current) => ({ ...current, type: event.target.value }))}
                placeholder="Website, app, campaign, branding, video..."
                value={projectForm.type}
              />
            </div>
            <div>
              <FieldLabel>Upload files</FieldLabel>
              <TextField multiple onChange={(event) => setProjectFiles(Array.from(event.target.files ?? []))} type="file" />
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Uploaded images or videos can become the project preview automatically when image or video mode is selected.
              </p>
            </div>
            <ProjectPeoplePicker
              canInvite={isMasterAdminWorkspace}
              description="Search internal accounts instead of scrolling through every person in the workspace. Selected members stay pinned above."
              inviteLabel="internal admin"
              inviteRole="admin"
              lockedInviteMessage="Only Master Admin can create new internal accounts. Existing admins can still be searched and added here."
              onInvite={(email, role) => void handleProjectSetupInvite(email, role)}
              onResend={(inviteId) => void handleInviteResend(inviteId)}
              onRemove={(userId) =>
                setProjectForm((current) => ({ ...current, teamMembers: current.teamMembers.filter((id) => id !== userId) }))
              }
              actionsDisabled={working}
              onSearchChange={setProjectTeamSearch}
              onSelect={(userId) =>
                setProjectForm((current) => ({ ...current, teamMembers: toggleSelection(current.teamMembers, userId) }))
              }
              pendingInvites={pendingInternalProjectInvites}
              results={filteredProjectTeamUsers}
              searchPlaceholder="Search admins by name, email, or title"
              searchValue={projectTeamSearch}
              selectedUsers={selectedProjectTeamUsers}
              title="Internal team"
              totalCount={internalProjectAccounts.length}
              users={internalProjectAccounts}
            />
            <ProjectPeoplePicker
              canInvite={canInviteUsers}
              description="Search client accounts by name or email. If the client does not exist yet, generate a shareable invite right here."
              inviteLabel="client"
              inviteRole="client"
              onInvite={(email, role) => void handleProjectSetupInvite(email, role)}
              onResend={(inviteId) => void handleInviteResend(inviteId)}
              onRemove={(userId) =>
                setProjectForm((current) => ({ ...current, clients: current.clients.filter((id) => id !== userId) }))
              }
              actionsDisabled={working}
              onSearchChange={setProjectClientSearch}
              onSelect={(userId) =>
                setProjectForm((current) => ({ ...current, clients: toggleSelection(current.clients, userId) }))
              }
              pendingInvites={pendingClientProjectInvites}
              results={filteredProjectClientUsers}
              searchPlaceholder="Search clients by name, email, or company contact"
              searchValue={projectClientSearch}
              selectedUsers={selectedProjectClientUsers}
              title="Client accounts"
              totalCount={clientProjectAccounts.length}
              users={clientProjectAccounts}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setProjectModalOpen(false)} variant="ghost">Cancel</Button>
          <Button disabled={working || !projectForm.name.trim()} onClick={() => void handleProjectSubmit()}>{projectEditing ? "Save changes" : "Create project"}</Button>
        </div>
      </Modal>

      <Modal
        onClose={() => setTaskModalOpen(false)}
        open={taskModalOpen}
        size="lg"
        subtitle="Tasks and milestones feed the kanban board and analytics."
        title={taskEditing ? "Edit task" : "Create task"}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <FieldLabel>Project</FieldLabel>
              <SelectField onChange={(event) => setTaskForm((current) => ({ ...current, project: event.target.value }))} value={taskForm.project}>
                {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
              </SelectField>
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <TextField onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} value={taskForm.title} />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <TextArea onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={5} value={taskForm.description} />
            </div>
            <div>
              <FieldLabel>Subtasks</FieldLabel>
              <TextArea onChange={(event) => setTaskForm((current) => ({ ...current, subtasks: event.target.value }))} placeholder="One subtask per line" rows={5} value={taskForm.subtasks} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectField onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value as TaskStatus }))} value={taskForm.status}>
                  {taskStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                </SelectField>
              </div>
              <div>
                <FieldLabel>Priority</FieldLabel>
                <SelectField onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as Priority }))} value={taskForm.priority}>
                  {priorities.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
                </SelectField>
              </div>
            </div>
            <div>
              <FieldLabel>Assignee</FieldLabel>
              <SelectField onChange={(event) => setTaskForm((current) => ({ ...current, assignee: event.target.value }))} value={taskForm.assignee}>
                <option value="">Unassigned</option>
                {users.filter((user) => user.role !== "client").map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
              </SelectField>
            </div>
            <div>
              <FieldLabel>Due date</FieldLabel>
              <TextField onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={taskForm.dueDate} />
            </div>
            <div>
              <FieldLabel>Tags</FieldLabel>
              <TextField onChange={(event) => setTaskForm((current) => ({ ...current, tags: event.target.value }))} placeholder="frontend, approval" value={taskForm.tags} />
            </div>
            <div>
              <FieldLabel>Attachments</FieldLabel>
              <TextField multiple onChange={(event) => setTaskFiles(Array.from(event.target.files ?? []))} type="file" />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 px-4 py-3 text-sm dark:border-slate-800">
              <input checked={taskForm.milestone} onChange={(event) => setTaskForm((current) => ({ ...current, milestone: event.target.checked }))} type="checkbox" />
              Mark as milestone
            </label>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setTaskModalOpen(false)} variant="ghost">Cancel</Button>
          <Button disabled={working || !taskForm.title.trim() || !taskForm.project} onClick={() => void handleTaskSubmit()}>{taskEditing ? "Save changes" : "Create task"}</Button>
        </div>
      </Modal>

      <Modal
        onClose={closeUserModal}
        open={userModalOpen}
        subtitle="Master Admin can update name, email, role, title, and account status for any user."
        title={userEditing ? `Edit ${userEditing.name}` : "Edit user"}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Full name</FieldLabel>
            <TextField onChange={(event) => setUserEditForm((current) => ({ ...current, name: event.target.value }))} value={userEditForm.name} />
          </div>
          <div>
            <FieldLabel>Email address</FieldLabel>
            <TextField onChange={(event) => setUserEditForm((current) => ({ ...current, email: event.target.value }))} type="email" value={userEditForm.email} />
          </div>
          <div>
            <FieldLabel>Job title</FieldLabel>
            <TextField onChange={(event) => setUserEditForm((current) => ({ ...current, title: event.target.value }))} value={userEditForm.title} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <SelectField onChange={(event) => setUserEditForm((current) => ({ ...current, role: event.target.value as UserRole }))} value={userEditForm.role}>
              {(["master_admin", "admin", "client"] as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {labelize(role)}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div className="mt-4">
          <FieldLabel>Account status</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className={cn(
                "rounded-[22px] border p-4 text-left transition",
                userEditForm.isActive
                  ? "border-accent-300 bg-accent-500/[0.06] dark:border-lime-400 dark:bg-lime-500/[0.08]"
                  : "border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
              )}
              onClick={() => setUserEditForm((current) => ({ ...current, isActive: true }))}
              type="button"
            >
              <p className="font-semibold text-slate-900 dark:text-white">Active</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The user can sign in and be assigned to projects.</p>
            </button>
            <button
              className={cn(
                "rounded-[22px] border p-4 text-left transition",
                !userEditForm.isActive
                  ? "border-amber-300 bg-amber-500/[0.08] dark:border-amber-400/70 dark:bg-amber-500/[0.12]"
                  : "border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/40"
              )}
              onClick={() => setUserEditForm((current) => ({ ...current, isActive: false }))}
              type="button"
            >
              <p className="font-semibold text-slate-900 dark:text-white">Inactive</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The account stays in the system but can no longer sign in.</p>
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Reset login password</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Set a new password for this account. Existing sessions signed in with the old password will be invalidated.
              </p>
            </div>
            {userEditing ? (
              <StatusPill
                label={userEditing._id === session?.user._id ? "Your account" : "Selected account"}
                tone={userEditing._id === session?.user._id ? "info" : "default"}
              />
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>New password</FieldLabel>
              <TextField
                onChange={(event) => setUserPasswordResetForm((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder="Minimum 10 characters"
                type="password"
                value={userPasswordResetForm.newPassword}
              />
            </div>
            <div>
              <FieldLabel>Confirm new password</FieldLabel>
              <TextField
                onChange={(event) => setUserPasswordResetForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                type="password"
                value={userPasswordResetForm.confirmPassword}
              />
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Passwords must include uppercase, lowercase, a number, a symbol, and be at least 10 characters long.
          </p>

          <div className="mt-4 flex justify-end">
            <Button
              disabled={working || !userPasswordResetForm.newPassword.trim() || !userPasswordResetForm.confirmPassword.trim()}
              onClick={() => void handleUserPasswordReset()}
              variant="secondary"
            >
              Reset login password
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={closeUserModal} variant="ghost">Cancel</Button>
          <Button disabled={working || !userEditForm.name.trim() || !userEditForm.email.trim()} onClick={() => void handleUserSave()}>
            Save user
          </Button>
        </div>
      </Modal>

      <Modal
        onClose={() => setInviteModalOpen(false)}
        open={inviteModalOpen}
        subtitle="Master admins and admins can generate direct access links for internal users and clients."
        title="Invite a user"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextField onChange={(event) => setInviteEmail(event.target.value)} type="email" value={inviteEmail} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <SelectField onChange={(event) => setInviteRole(event.target.value as UserRole)} value={inviteRole}>
              {inviteRoleOptions.map((role) => <option key={role} value={role}>{labelize(role)}</option>)}
            </SelectField>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => setInviteModalOpen(false)} variant="ghost">Cancel</Button>
          <Button disabled={working || !inviteEmail.trim()} onClick={() => void handleInviteSubmit()}>Generate invite</Button>
        </div>
      </Modal>

      <nav className="mobile-dock-shell xl:hidden">
        <div className="pointer-events-auto flex w-full max-w-[420px] items-center justify-between gap-1 rounded-[28px] border border-white/75 bg-white/82 p-1.5 shadow-[0_20px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-700/75 dark:bg-slate-950/84">
          {workspaceNavItems.map((item) => (
            <MobileDockButton
              key={item.id}
              active={activeView === item.id}
              badge={workspaceBadge(item.id)}
              icon={item.icon}
              label={item.label}
              onClick={() => setActiveView(item.id)}
            />
          ))}
        </div>
      </nav>
    </main>
  );
}
