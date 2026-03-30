import { Head } from '@inertiajs/react';
import {
    BellDot,
    Download,
    FolderKanban,
    LayoutDashboard,
    ListTodo,
    LogOut,
    MessagesSquare,
    Moon,
    Plus,
    Settings2,
    UserPlus,
    Users,
} from 'lucide-react';

import { BrandMark } from '@/components/brand-mark';
import { Button, EmptyState, SectionCard, StatCard, StatusPill } from '@/components/ui';
import { cn, labelize } from '@/lib/utils';

const navIconMap = {
    overview: LayoutDashboard,
    projects: FolderKanban,
    tasks: ListTodo,
    collaboration: MessagesSquare,
    timeline: BellDot,
    users: Users,
    account: Settings2,
};

function WorkspaceNavButton({ active, label, icon: Icon, badge }) {
    return (
        <button
            className={cn(
                'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
                active ? 'bg-accent-500 text-white shadow-[0_14px_28px_rgba(39,110,241,0.22)]' : 'text-slate-600 hover:bg-white/60',
            )}
            type="button"
        >
            <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {label}
            </span>
            {badge ? (
                <span className={cn('rounded-full px-2 py-1 text-xs font-bold', active ? 'bg-white/20 text-white' : 'bg-slate-900/5 text-slate-500')}>
                    {badge}
                </span>
            ) : null}
        </button>
    );
}

function StatusMixRow({ label, count, width, color }) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{label}</span>
                <span className="text-slate-500">{count}</span>
            </div>
            <div className="h-4 rounded-full bg-slate-900/8">
                <div className={cn('h-4 rounded-full', color)} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
}

function WorkloadCard({ member }) {
    const total = member.open + member.done;
    const completedWidth = total ? Math.max((member.done / total) * 100, 18) : 0;

    return (
        <div className="rounded-[24px] border border-slate-200/70 bg-white/60 p-4">
            <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">{member.name}</span>
                <span className="text-slate-500">
                    {member.open} open / {member.done} done
                </span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-slate-900/8">
                <div className="h-3 rounded-full bg-lime-500" style={{ width: `${completedWidth}%` }} />
            </div>
        </div>
    );
}

export default function Dashboard({
    branding,
    workspace,
    user,
    navItems,
    currentProject,
    stats,
    statusMix,
    workload,
    completedProjects,
}) {
    return (
        <>
            <Head title="Workspace" />
            <main className="min-h-screen px-4 py-6 sm:px-6">
                <div className="mx-auto grid max-w-[1280px] gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="hidden xl:block">
                        <div className="surface-strong sticky top-6 space-y-4 rounded-[34px] p-5">
                            <div>
                                <BrandMark branding={branding} subtitle="Workspace" />
                                <h2 className="mt-4 font-display text-3xl leading-[1.02] text-slate-900">{workspace.sidebarTitle}</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">{workspace.sidebarDescription}</p>
                            </div>

                            <div className="space-y-2">
                                {navItems.map((item) => (
                                    <WorkspaceNavButton
                                        key={item.id}
                                        active={item.active}
                                        badge={item.badge}
                                        icon={navIconMap[item.icon] ?? LayoutDashboard}
                                        label={item.label}
                                    />
                                ))}
                            </div>

                            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current Project</p>
                                <p className="mt-2 font-semibold text-slate-900">{currentProject.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{currentProject.summary}</p>
                                <div className="mt-4 flex items-center justify-between">
                                    <StatusPill label={labelize(currentProject.status)} tone="info" />
                                    <StatusPill label={`${currentProject.progress}%`} tone="default" />
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <Button className="w-full" variant="secondary">
                                        Open details
                                    </Button>
                                    <Button className="w-full" variant="ghost">
                                        Chat & requests
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed In</p>
                                <p className="mt-2 font-semibold text-slate-900">{user.name}</p>
                                <p className="text-sm text-slate-500">{labelize(user.role)}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button className="w-full">
                                        <Plus className="mr-2 h-4 w-4" />
                                        New project
                                    </Button>
                                    <Button className="w-full" variant="secondary">
                                        <ListTodo className="mr-2 h-4 w-4" />
                                        New task
                                    </Button>
                                    <Button className="w-full" variant="secondary">
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Invite user
                                    </Button>
                                    <Button className="w-full" variant="secondary">
                                        <Moon className="mr-2 h-4 w-4" />
                                        Dark mode
                                    </Button>
                                    <Button className="w-full" variant="secondary">
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                    <Button className="w-full" variant="ghost">
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
                                <BrandMark branding={branding} compact subtitle="Overview" />
                                <div className="flex items-center gap-2">
                                    <Button className="h-11 w-11 rounded-2xl px-0">
                                        <Plus className="h-5 w-5" />
                                    </Button>
                                    <Button className="h-11 w-11 rounded-2xl px-0" variant="secondary">
                                        <Moon className="h-5 w-5" />
                                    </Button>
                                    <Button className="h-11 w-11 rounded-2xl px-0" variant="ghost">
                                        <LogOut className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/70 bg-white/60 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{currentProject.name}</p>
                                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                        {labelize(user.role)} / {user.name}
                                    </p>
                                </div>
                                <StatusPill label={`${currentProject.progress}%`} tone="default" />
                            </div>
                        </section>

                        <section className="surface hero-grid overflow-hidden rounded-[36px] p-4 md:p-8">
                            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                                <div className="max-w-2xl">
                                    <p className="hidden text-sm font-semibold text-accent-600 md:block">Welcome back, {user.firstName}</p>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400 md:hidden">Overview</p>
                                    <h1 className="mt-2 font-display text-[2.15rem] leading-[1.02] text-slate-900 md:mt-3 md:text-5xl md:leading-tight">
                                        {workspace.heroTitle}
                                    </h1>
                                    <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-base">{workspace.heroDescription}</p>
                                    <div className="mt-4 grid grid-cols-2 gap-2 md:mt-5 md:flex md:flex-wrap md:gap-3">
                                        {workspace.heroHighlights.map((item) => (
                                            <div
                                                key={item.label}
                                                className="rounded-[20px] border border-slate-200/70 bg-white/70 px-3 py-3 md:rounded-[22px] md:px-4"
                                            >
                                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {stats.map((stat) => (
                                <StatCard key={stat.title} caption={stat.caption} title={stat.title} value={stat.value} />
                            ))}
                        </section>

                        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                            <SectionCard eyebrow="Analytics" title="Project Status Mix">
                                <div className="space-y-5">
                                    {statusMix.map((entry) => (
                                        <StatusMixRow key={entry.label} color={entry.color} count={entry.count} label={entry.label} width={entry.width} />
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard eyebrow="Analytics" title="Team Workload">
                                <div className="space-y-4">
                                    {workload.map((member) => (
                                        <WorkloadCard key={member.name} member={member} />
                                    ))}
                                </div>
                            </SectionCard>
                        </section>

                        <SectionCard
                            action={<StatusPill label={`${completedProjects.length} completed`} tone={completedProjects.length ? 'success' : 'default'} />}
                            eyebrow="Archive"
                            title="Completed projects"
                        >
                            {completedProjects.length ? (
                                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                    {completedProjects.map((project) => (
                                        <button
                                            key={project.name}
                                            className="rounded-[26px] border border-slate-200/70 bg-white/70 p-5 text-left transition hover:border-accent-300 hover:bg-accent-500/5"
                                            type="button"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-900">{project.name}</p>
                                                    <p className="mt-2 text-sm text-slate-500">{project.summary}</p>
                                                </div>
                                                <StatusPill label="Completed" tone="success" />
                                            </div>
                                            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                                <span>{project.tasks} tasks</span>
                                                <span>{project.progress}% complete</span>
                                                <span>{project.closedAt}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState description="Completed projects will collect here once delivery is signed off." title="No completed projects yet" />
                            )}
                        </SectionCard>

                        <div className="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4 xl:hidden">
                            <div className="surface-strong flex items-center gap-2 rounded-full px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                                {navItems.map((item) => {
                                    const Icon = navIconMap[item.icon] ?? LayoutDashboard;

                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold',
                                                item.active ? 'bg-accent-500 text-white' : 'text-slate-500',
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {item.active ? item.label : null}
                                            {item.badge ? (
                                                <span className="absolute right-0 top-0 min-w-[18px] translate-x-[28%] -translate-y-[28%] rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                                    {item.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
