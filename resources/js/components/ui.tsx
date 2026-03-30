"use client";

import { AnimatePresence, motion } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { cn, initials } from "@/lib/utils";
import type { User } from "@/lib/types";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const buttonStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "ui-button-primary",
  secondary: "ui-button-secondary",
  ghost: "ui-button-ghost",
  danger: "ui-button-danger"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200 will-change-transform",
        buttonStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface w-full min-w-0 max-w-full overflow-hidden rounded-[28px] p-5", className)}>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{eyebrow}</p> : null}
          <h2 className="font-display text-2xl text-slate-900 dark:text-white">{title}</h2>
        </div>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({
  label,
  tone = "default"
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneStyles = {
    default: "bg-slate-900/5 text-slate-600 dark:bg-slate-100/10 dark:text-slate-300",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    danger: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    info: "bg-accent-500/12 text-accent-700 dark:bg-lime-500 dark:text-ink"
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneStyles[tone])}>{label}</span>
  );
}

export function StatCard({
  title,
  value,
  caption
}: {
  title: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="surface-strong w-full min-w-0 rounded-[24px] p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 font-display text-4xl text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{caption}</p>
    </div>
  );
}

export function AvatarStack({ users }: { users: User[] }) {
  return (
    <div className="flex items-center">
      {users.slice(0, 4).map((user, index) => (
        <div
          key={user._id}
          className="avatar-token -ml-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-accent-100 text-xs font-semibold text-accent-700 first:ml-0 dark:border-slate-900 dark:bg-lime-500/15 dark:text-lime-300"
          style={{ zIndex: 10 - index }}
          title={user.name}
        >
          {initials(user.name)}
        </div>
      ))}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">{children}</label>;
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-accent-400 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100",
        props.className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent-400 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100",
        props.className
      )}
    />
  );
}

export function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-accent-400 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100",
        props.className
      )}
    />
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  size = "md"
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const sizeClasses = {
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl"
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/45 p-2 sm:p-3 md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={cn(
              "surface-strong flex max-h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-[28px] p-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-[32px] sm:p-6",
              sizeClasses[size]
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900 dark:text-white sm:text-3xl">{title}</h3>
                {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
              </div>
              <button
                aria-label="Close modal"
                className="ui-hover-icon rounded-full p-2 text-slate-400 transition"
                onClick={onClose}
                type="button"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="scrollbar-thin min-h-0 overflow-y-auto pr-1">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type ToastItem = {
  id: number;
  title: string;
  description?: string;
};

export function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,90vw)] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className="surface-strong rounded-3xl p-4"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
          >
            <p className="font-semibold text-slate-900 dark:text-white">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{toast.description}</p> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300/70 px-6 py-10 text-center dark:border-slate-700">
      <h3 className="font-display text-2xl text-slate-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
