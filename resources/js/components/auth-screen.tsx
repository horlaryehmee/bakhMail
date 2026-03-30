"use client";

import { ArrowRight, FolderKanban, LockKeyhole, Mail, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";

import type { BrandingSettings, UserRole } from "@/lib/types";
import { labelize } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { Button, FieldLabel, TextField } from "./ui";

type InviteInfo = {
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "expired";
} | null;

export function AuthScreen({
  inviteToken,
  inviteInfo,
  branding,
  loading,
  error,
  onLogin,
  onRegister
}: {
  inviteToken: string | null;
  inviteInfo: InviteInfo;
  branding: BrandingSettings;
  loading: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: { token: string; name: string; password: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "invite">(inviteToken ? "invite" : "login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  useEffect(() => {
    if (!inviteToken) {
      setMode("login");
      return;
    }

    setMode(inviteInfo?.status === "pending" ? "invite" : "login");
  }, [inviteInfo?.status, inviteToken]);

  useEffect(() => {
    if (!inviteInfo?.email) return;
    setLoginEmail((current) => (current.trim() ? current : inviteInfo.email));
  }, [inviteInfo?.email]);

  const inviteReady = Boolean(inviteToken && inviteInfo?.email && inviteInfo.status === "pending");
  const showInviteTabs = Boolean(inviteToken && inviteInfo?.status === "pending");
  const inviteNotice =
    inviteInfo?.status === "accepted"
      ? "This invite has already been used. Sign in with the invited email to continue."
      : inviteInfo?.status === "expired"
        ? "This invite link has expired. Ask an admin for a new invite."
        : mode === "invite"
          ? "Complete your account and enter the platform."
          : "Sign in to continue.";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.10),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-4 py-4 dark:bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.10),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center">
        <div className="grid w-full gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="surface relative hidden min-h-[640px] overflow-hidden rounded-[38px] p-8 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-accent-500/18 via-sky-500/10 to-emerald-500/14 blur-3xl" />
            <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl dark:bg-lime-500/10" />

            <BrandMark branding={branding} subtitle="Workspace" />

            <div className="relative">
              <h1 className="max-w-md font-display text-5xl leading-[1.02] text-slate-900 dark:text-white">
                Workspace access.
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-slate-600 dark:text-slate-300">
                Projects, chat, requests, and updates in one place.
              </p>
            </div>

            <div className="relative space-y-3">
              <AccessStrip icon={<FolderKanban className="h-4 w-4" />} label="Projects" value="Status, deadlines, previews" />
              <AccessStrip icon={<MessagesSquare className="h-4 w-4" />} label="Chat" value="Direct replies and requests" />
              <AccessStrip icon={<LockKeyhole className="h-4 w-4" />} label="Access" value="Secure invite-based entry" />
            </div>

          </section>

          <section className="surface-strong rounded-[38px] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <BrandMark branding={branding} compact subtitle={mode === "invite" ? "Invite access" : "Workspace access"} />
                <h2 className="mt-3 font-display text-3xl leading-tight text-slate-900 dark:text-white sm:text-4xl">
                  {mode === "invite" ? "Accept invite" : "Sign in"}
                </h2>
                <p className="mt-2 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{inviteNotice}</p>
                <div className="scrollbar-thin -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                  <CompactAccessChip icon={<FolderKanban className="h-3.5 w-3.5" />} label="Projects" />
                  <CompactAccessChip icon={<MessagesSquare className="h-3.5 w-3.5" />} label="Chat" />
                  <CompactAccessChip icon={<LockKeyhole className="h-3.5 w-3.5" />} label="Secure invite" />
                </div>
              </div>
              {inviteToken ? (
                <span className="rounded-full bg-accent-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-700 dark:bg-lime-500/12 dark:text-lime-300">
                  Invite
                </span>
              ) : null}
            </div>

            {showInviteTabs ? (
              <div className="mt-6 flex rounded-full border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-950/70">
                <button
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                  onClick={() => setMode("login")}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "invite"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                  onClick={() => setMode("invite")}
                  type="button"
                >
                  Accept invite
                </button>
              </div>
            ) : null}

            {inviteToken && inviteInfo?.status === "accepted" ? (
              <div className="mt-5 rounded-[24px] border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300">
                This account is already set up. Sign in below with <span className="font-semibold">{inviteInfo.email}</span>.
              </div>
            ) : null}

            {inviteToken && inviteInfo?.status === "expired" ? (
              <div className="mt-5 rounded-[24px] border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:text-amber-300">
                This invite link expired. An admin needs to send a fresh invite before this person can create an account.
              </div>
            ) : null}

            <div className="mt-6 rounded-[30px] border border-slate-200/70 bg-white/76 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/46 sm:p-6">
              {mode === "login" ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onLogin(loginEmail, loginPassword);
                  }}
                >
                  <div>
                    <FieldLabel>Email address</FieldLabel>
                    <TextField
                      autoComplete="email"
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="name@company.com"
                      type="email"
                      value={loginEmail}
                    />
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <TextField
                      autoComplete="current-password"
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Enter password"
                      type="password"
                      value={loginPassword}
                    />
                  </div>
                  <Button className="w-full" disabled={loading || !loginEmail.trim() || !loginPassword.trim()} type="submit">
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!inviteToken) return;

                    void onRegister({
                      token: inviteToken,
                      name: registerName,
                      password: registerPassword
                    });
                  }}
                >
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/85 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/65">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-accent-500/10 p-3 text-accent-700 dark:bg-lime-500/10 dark:text-lime-300">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {inviteInfo ? labelize(inviteInfo.role) : "Invite required"}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                          {inviteInfo?.email ?? "Open your invite link to continue."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Email address</FieldLabel>
                    <TextField
                      className="bg-slate-100/95 text-slate-500 dark:bg-slate-900/70 dark:text-slate-300"
                      readOnly
                      value={inviteInfo?.email ?? ""}
                    />
                  </div>
                  <div>
                    <FieldLabel>Full name</FieldLabel>
                    <TextField
                      autoComplete="name"
                      onChange={(event) => setRegisterName(event.target.value)}
                      placeholder="Your full name"
                      value={registerName}
                    />
                  </div>
                  <div>
                    <FieldLabel>Create password</FieldLabel>
                    <TextField
                      autoComplete="new-password"
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="At least 10 characters"
                      type="password"
                      value={registerPassword}
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Use at least 10 characters and include an uppercase letter, lowercase letter, number, and symbol.
                    </p>
                  </div>
                  <Button className="w-full" disabled={loading || !inviteReady || !registerName.trim() || !registerPassword.trim()} type="submit">
                    Activate access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>

            {error ? (
              <div className="mt-4 rounded-[24px] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:text-rose-300">
                {error}
              </div>
            ) : null}

          </section>
        </div>
      </div>
    </main>
  );
}

function AccessStrip({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[24px] border border-slate-200/70 bg-white/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/46">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-700 dark:bg-lime-500/10 dark:text-lime-300">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CompactAccessChip({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200/80 bg-white/76 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/46 dark:text-slate-200">
      <span className="text-accent-700 dark:text-lime-300">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
