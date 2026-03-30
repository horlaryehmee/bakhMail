export type UserRole = "master_admin" | "admin" | "client";
export type ProjectStatus = "not_started" | "in_progress" | "completed";
export type TaskStatus = "todo" | "in_progress" | "review" | "completed";
export type Priority = "low" | "medium" | "high" | "urgent";
export type RequestStatus = "open" | "planned" | "in_progress" | "completed";
export type ProjectPreviewType = "none" | "website" | "image" | "video";

export type Attachment = {
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt?: string;
};

export type NotificationPreferences = {
  comments: boolean;
  requests: boolean;
  deadlines: boolean;
  activity: boolean;
};

export type BrandingSettings = {
  brandName: string;
  logoUrl: string;
  logoSize: number;
};

export type DemoDataAccount = {
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

export type DemoDataStatus = {
  populated: boolean;
  counts: {
    users: number;
    projects: number;
    tasks: number;
    comments: number;
    requests: number;
    notifications: number;
    activity: number;
    invites: number;
  };
  sampleAccounts: DemoDataAccount[];
};

export type PendingInvite = {
  id: string;
  email: string;
  role: UserRole;
  inviteLink: string;
  expiresAt?: string;
  createdAt?: string;
};

export type User = {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatarUrl?: string;
  isActive?: boolean;
  notificationPreferences?: NotificationPreferences;
};

export type Project = {
  _id: string;
  name: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  type: string;
  tags: string[];
  progress: number;
  startDate?: string | null;
  deadline?: string | null;
  previewType?: ProjectPreviewType;
  previewUrl?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  attachments: Attachment[];
  teamMembers: User[];
  clients: User[];
  createdBy?: User;
  taskCount?: number;
  completedTaskCount?: number;
  createdAt?: string;
};

export type Subtask = {
  _id?: string;
  title: string;
  completed: boolean;
  assignee?: string | null;
};

export type Task = {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  milestone: boolean;
  order: number;
  tags: string[];
  startDate?: string | null;
  dueDate?: string | null;
  assignee?: User | null;
  reporter?: User | null;
  project: Project | string;
  subtasks: Subtask[];
  attachments: Attachment[];
  createdAt?: string;
};

export type Comment = {
  _id: string;
  content: string;
  project: string;
  task?: string | null;
  replyTo?: {
    _id: string;
    content: string;
    task?: string | null;
    createdAt: string;
    author?: User | null;
    attachments?: Attachment[];
  } | null;
  author: User;
  mentions: User[];
  attachments: Attachment[];
  createdAt: string;
};

export type RequestItem = {
  _id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: Priority;
  type: string;
  project: { _id?: string; name: string } | string;
  task?: { _id?: string; title: string } | string | null;
  sourceComment?: {
    _id: string;
    content: string;
    task?: string | null;
    createdAt: string;
    author?: User | null;
    attachments?: Attachment[];
  } | null;
  createdBy: User;
  attachments: Attachment[];
  createdAt: string;
};

export type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  readAt?: string | null;
  createdAt: string;
};

export type ActivityItem = {
  _id: string;
  action: string;
  message: string;
  entityType: string;
  entityId: string;
  actor?: User | null;
  project?: string | null;
  task?: string | null;
  createdAt: string;
};

export type Summary = {
  stats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    openRequests: number;
  };
  projectsByStatus: Array<{ status: ProjectStatus; count: number }>;
  workload: Array<{ name: string; openTasks: number; completedTasks: number }>;
  upcomingDeadlines: Task[];
  recentActivity: ActivityItem[];
};

export type Session = {
  token: string;
  user: User;
};
