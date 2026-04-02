"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { assetUrl } from "@/lib/api";
import type { BrandingSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BrandMark({
  branding,
  title,
  subtitle,
  compact = false,
  className
}: {
  branding: BrandingSettings;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}) {
  const resolvedLogoUrl = assetUrl(branding.logoUrl, branding.logoVersion);
  const resolvedTitle = title ?? branding.brandName ?? "Bakhtech Solutions";
  const logoScale = Math.min(Math.max(branding.logoSize ?? 1, 0.8), 1.8);
  const frameSize = compact ? 44 : 56;
  const iconSize = compact ? 20 : 24;
  const imagePadding = compact ? 7 : 9;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedLogoUrl]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 dark:border-slate-800 dark:bg-slate-950/75"
        style={{ height: frameSize, width: frameSize }}
      >
        {resolvedLogoUrl && !imageFailed ? (
          <img
            alt={resolvedTitle}
            className="h-full w-full object-contain transition-transform duration-200"
            onError={() => setImageFailed(true)}
            src={resolvedLogoUrl}
            style={{ padding: imagePadding, transform: `scale(${logoScale})`, transformOrigin: "center" }}
          />
        ) : (
          <Building2 className="text-accent-700 dark:text-lime-300" style={{ height: iconSize, width: iconSize }} />
        )}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-base")}>{resolvedTitle}</p>
        {subtitle ? <p className={cn("truncate text-slate-500 dark:text-slate-400", compact ? "text-xs" : "text-sm")}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
