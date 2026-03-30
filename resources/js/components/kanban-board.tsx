"use client";

import { PenSquare, Trash2 } from "lucide-react";

import type { Task, TaskStatus } from "@/lib/types";
import { formatShortDate, labelize, relativeDate } from "@/lib/utils";
import { AvatarStack, Button, EmptyState, SelectField, StatusPill } from "./ui";

const columns: Array<{ id: TaskStatus; title: string }> = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "completed", title: "Completed" }
];

export function KanbanBoard({
  tasks,
  onMove,
  onEdit,
  onDelete,
  onSelect,
  canManage
}: {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSelect: (task: Task) => void;
  canManage: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks in this slice"
        description="Create a task or relax your filters to populate the board."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);

        return (
          <div
            key={column.id}
            className="rounded-[26px] border border-slate-200/70 bg-white/55 p-3 dark:border-slate-800 dark:bg-slate-950/35"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/plain");
              if (taskId) {
                onMove(taskId, column.id);
              }
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">{column.title}</h3>
              <StatusPill label={String(columnTasks.length)} tone="info" />
            </div>
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <div
                  key={task._id}
                  className="w-full rounded-[24px] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900"
                  draggable
                  onClick={() => onSelect(task)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", task._id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onSelect(task);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>
                    </div>
                    <StatusPill
                      label={labelize(task.priority)}
                      tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "default"}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      <p>{task.dueDate ? relativeDate(task.dueDate) : "No deadline"}</p>
                      <p>{task.dueDate ? formatShortDate(task.dueDate) : "Flexible timeline"}</p>
                    </div>
                    {task.assignee ? <AvatarStack users={[task.assignee]} /> : null}
                  </div>
                  {canManage ? (
                    <div
                      className="mt-4 xl:hidden"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Update progress</p>
                      <SelectField
                        onChange={(event) => onMove(task._id, event.target.value as TaskStatus)}
                        value={task.status}
                      >
                        {columns.map((statusColumn) => (
                          <option key={statusColumn.id} value={statusColumn.id}>
                            {statusColumn.title}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {task.milestone ? <StatusPill label="Milestone" tone="success" /> : null}
                      {task.subtasks.length ? <StatusPill label={`${task.subtasks.length} subtasks`} tone="default" /> : null}
                    </div>
                    {canManage ? (
                      <div className="flex gap-1">
                        <Button
                          aria-label="Edit task"
                          className="h-9 w-9 rounded-full p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(task);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          <PenSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label="Delete task"
                          className="h-9 w-9 rounded-full p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(task);
                          }}
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
