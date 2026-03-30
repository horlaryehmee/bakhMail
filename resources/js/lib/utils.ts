import clsx from "clsx";
import { format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns";

export function cn(...values: Array<string | boolean | null | undefined>) {
  return clsx(values);
}

export function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  return format(parseISO(value), "MMM d, yyyy");
}

export function relativeDate(value?: string | null) {
  if (!value) {
    return "No deadline";
  }

  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function isOverdue(value?: string | null) {
  return Boolean(value) && isPast(parseISO(value!));
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function percent(completed: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

