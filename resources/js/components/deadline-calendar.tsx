"use client";

import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns";

import type { Task } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

type CalendarDay = {
  date: Date;
  tasks: Task[];
};

function deadlineMeta(task: Task) {
  if (task.milestone) {
    return { label: "Milestone", className: "text-emerald-600 dark:text-emerald-300" };
  }

  if (task.priority === "urgent") {
    return { label: "Urgent", className: "text-rose-500 dark:text-rose-300" };
  }

  if (task.priority === "high") {
    return { label: "High", className: "text-amber-600 dark:text-amber-300" };
  }

  return { label: labelize(task.status), className: "text-accent-700 dark:text-lime-300" };
}

function DeadlineTaskCard({ task }: { task: Task }) {
  const meta = deadlineMeta(task);

  return (
    <div className="deadline-day-task rounded-[20px] bg-slate-900/[0.04] px-4 py-3.5 dark:bg-[rgba(255,255,255,0.04)]">
      <p className="max-w-[180px] text-[1rem] font-semibold leading-7 text-slate-900 dark:text-white">{task.title}</p>
      <div className="mt-3.5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.22em]">
        <span className={meta.className}>{meta.label}</span>
        {task.assignee?.name ? <span className="text-slate-400 dark:text-slate-500">{task.assignee.name}</span> : null}
      </div>
    </div>
  );
}

export function DeadlineCalendar({ tasks }: { tasks: Task[] }) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days: CalendarDay[] = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(start, index);

    return {
      date,
      tasks: tasks
        .filter((task) => task.dueDate && isSameDay(parseISO(task.dueDate), date))
        .sort((left, right) => Number(right.milestone) - Number(left.milestone))
    };
  });

  const weeks = [days.slice(0, 7), days.slice(7, 14)];
  const totalDeadlines = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const todayDeadlines = days.find((day) => isToday(day.date))?.tasks.length ?? 0;

  return (
    <div className="deadline-calendar space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Next 14 Days</p>
            <p className="mt-1.5 text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-700 dark:text-slate-300">
              {format(start, "MMM d")} - {format(addDays(start, 13), "MMM d")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[0.95rem] font-semibold">
            <span className={cn(totalDeadlines ? "text-accent-700 dark:text-lime-300" : "text-slate-500 dark:text-slate-400")}>
              {totalDeadlines} deadlines
            </span>
            <span className={cn(todayDeadlines ? "text-amber-600 dark:text-amber-300" : "text-slate-500 dark:text-slate-400")}>
              {todayDeadlines} due today
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {weeks.map((week, index) => {
          const weekDeadlineCount = week.reduce((sum, day) => sum + day.tasks.length, 0);

          return (
            <section key={`week-grid-${index}`} className="space-y-3.5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Week {index + 1}: {format(week[0].date, "MMM d")} - {format(week[6].date, "MMM d")}
                </p>
                <p className={cn("text-[0.95rem] font-semibold", weekDeadlineCount ? "text-accent-700 dark:text-lime-300" : "text-slate-500 dark:text-slate-400")}>
                  {weekDeadlineCount} deadlines
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {week.map((day) => {
                  const isCurrentDay = isToday(day.date);
                  const monthLabel = format(day.date, "MMMM");
                  const dayLabel = format(day.date, "EEE");
                  const yearLabel = format(day.date, "yyyy");

                  return (
                    <article
                      key={day.date.toISOString()}
                      className={cn(
                        "deadline-day-card min-h-[206px] rounded-[28px] border px-4 py-4",
                        isCurrentDay
                          ? "deadline-day-card-active border-accent-300 bg-accent-500/[0.05] dark:border-lime-400/65 dark:bg-[linear-gradient(180deg,rgba(20,40,28,0.99),rgba(14,28,22,0.99))]"
                          : "border-slate-200/70 bg-white/70 dark:border-[#18263a] dark:bg-[linear-gradient(180deg,rgba(8,16,30,0.99),rgba(7,14,27,0.99))]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{dayLabel}</p>
                            <p className="mt-1.5 font-display text-[3.15rem] leading-none text-slate-900 dark:text-white">{format(day.date, "d")}</p>
                          </div>
                          <div className="pt-1">
                            <p className="text-[1.08rem] font-semibold leading-6 text-slate-900 dark:text-white">{monthLabel}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-400">{isCurrentDay ? "Today" : yearLabel}</p>
                          </div>
                        </div>

                        {isCurrentDay ? (
                          <span className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-lime-300">Today</span>
                        ) : day.tasks.length ? (
                          <span className="deadline-day-count inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900/6 px-2 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-white">
                            {day.tasks.length}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {day.tasks.length ? (
                          <>
                            <DeadlineTaskCard key={day.tasks[0]._id} task={day.tasks[0]} />
                            {day.tasks.length > 1 ? (
                              <div className="rounded-[18px] border border-dashed border-slate-300/70 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:border-[#22324b] dark:text-slate-400">
                                +{day.tasks.length - 1} more
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="deadline-day-empty rounded-[18px] bg-slate-900/[0.04] px-4 py-3.5 text-sm text-slate-400 dark:bg-white/[0.04] dark:text-slate-500">
                            Clear day
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
