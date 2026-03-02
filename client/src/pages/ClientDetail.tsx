import { useClient } from "@/hooks/use-clients";
import { useRoute, Link, useSearch } from "wouter";
import { ChevronLeft, Calendar, Clock, ChevronRight, Users, Building2, Mail, CheckSquare, Circle, Filter, Loader2, ArrowUpDown } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import { ViewToggle } from "@/components/ViewToggle";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ActionItem } from "@shared/schema";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type ClientActionItem = ActionItem & { meetingTitle: string; meetingDate: string };

type SessionSortMode = "date-newest" | "date-oldest" | "name-az" | "status";
type TaskSortMode = "date-newest" | "date-oldest" | "status-pending" | "status-completed";

function TasksSection({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [taskSort, setTaskSort] = useState<TaskSortMode>(() => {
    return (localStorage.getItem("client-tasks-sort") as TaskSortMode) || "date-newest";
  });

  const handleTaskSortChange = (value: TaskSortMode) => {
    setTaskSort(value);
    localStorage.setItem("client-tasks-sort", value);
  };

  const { data: tasks = [], isLoading } = useQuery<ClientActionItem[]>({
    queryKey: ["/api/clients", clientId, "action-items"],
    queryFn: () => fetch(`/api/clients/${clientId}/action-items`, { credentials: "include" }).then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "pending" | "completed" }) =>
      apiRequest("PATCH", `/api/action-items/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "action-items"] });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const filtered = statusFilter === "all" ? tasks : tasks.filter(t => t.status === statusFilter);

  const sortedTasks = useMemo(() => {
    const sorted = [...filtered];
    switch (taskSort) {
      case "date-newest":
        return sorted.sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
      case "date-oldest":
        return sorted.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());
      case "status-pending":
        return sorted.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
      case "status-completed":
        return sorted.sort((a, b) => (a.status === "completed" ? -1 : 1) - (b.status === "completed" ? -1 : 1));
      default:
        return sorted;
    }
  }, [filtered, taskSort]);
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">
            Tasks ({tasks.length})
          </h2>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="outline" className="text-xs">{pendingCount} pending</Badge>
              <Badge variant="secondary" className="text-xs">{completedCount} done</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-task-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <Select value={taskSort} onValueChange={(v) => handleTaskSortChange(v as TaskSortMode)}>
            <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-task-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-newest">Date (newest)</SelectItem>
              <SelectItem value="date-oldest">Date (oldest)</SelectItem>
              <SelectItem value="status-pending">Pending first</SelectItem>
              <SelectItem value="status-completed">Completed first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-muted/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-border">
          <CheckSquare className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {tasks.length === 0 ? "No tasks from sessions yet" : `No ${statusFilter} tasks`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <Card
              key={task.id}
              className={`flex items-start gap-3 p-4 transition-all ${task.status === "completed" ? "opacity-60" : ""}`}
              data-testid={`card-task-${task.id}`}
            >
              <button
                onClick={() => toggleMutation.mutate({
                  id: task.id,
                  status: task.status === "completed" ? "pending" : "completed",
                })}
                className="mt-0.5 shrink-0 focus:outline-none"
                disabled={toggleMutation.isPending}
                data-testid={`button-toggle-task-${task.id}`}
              >
                {task.status === "completed" ? (
                  <CheckSquare className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 hover:text-primary transition-colors" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${task.status === "completed" ? "line-through text-slate-400" : "text-slate-900 dark:text-foreground"}`} data-testid={`text-task-content-${task.id}`}>
                  {task.content}
                </p>
                {task.assignee && (
                  <p className="text-xs text-slate-500 mt-1">
                    Assigned to: {task.assignee}
                  </p>
                )}
                <Link href={`/meeting/${task.meetingId}`}>
                  <span className="text-xs text-primary hover:underline mt-1 inline-block cursor-pointer" data-testid={`link-task-meeting-${task.id}`}>
                    {task.meetingTitle} — {format(new Date(task.meetingDate), "MMM d, yyyy")}
                  </span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const [, params] = useRoute("/client/:id");
  const id = params ? parseInt(params.id) : null;
  const { data: client, isLoading, error } = useClient(id);
  const searchString = useSearch();
  const initialTab = new URLSearchParams(searchString).get("tab") === "tasks" ? "tasks" : "meetings";
  const [activeTab, setActiveTab] = useState<"meetings" | "tasks">(initialTab);

  const [viewMode, setViewMode] = useViewMode("client-detail-view");
  const [sessionSort, setSessionSort] = useState<SessionSortMode>(() => {
    return (localStorage.getItem("client-sessions-sort") as SessionSortMode) || "date-newest";
  });

  const handleSessionSortChange = (value: SessionSortMode) => {
    setSessionSort(value);
    localStorage.setItem("client-sessions-sort", value);
  };

  const sortedMeetings = useMemo(() => {
    if (!client?.meetings) return [];
    const sorted = [...client.meetings];
    switch (sessionSort) {
      case "date-newest":
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case "date-oldest":
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case "name-az":
        return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      case "status": {
        const order: Record<string, number> = { recording: 0, processing: 1, completed: 2 };
        return sorted.sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
      }
      default:
        return sorted;
    }
  }, [client?.meetings, sessionSort]);

  if (isLoading) return <div className="p-10 text-center text-slate-500">Loading client...</div>;
  if (error || !client) return <div className="p-10 text-center text-red-500">Client not found</div>;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="bg-white dark:bg-background border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/clients">
            <Button variant="ghost" size="icon" className="rounded-full shrink-0" data-testid="button-back-clients">
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-display font-bold text-slate-900 dark:text-foreground truncate" data-testid="text-client-name">{client.name}</h1>
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500 mt-0.5 flex-wrap">
              {client.company && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.company}</span>
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5 hidden sm:flex">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href="/new">
          <Button className="rounded-xl shrink-0" data-testid="button-new-meeting-for-client">
            <span className="hidden sm:inline">New Session</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-border">
            <button
              onClick={() => setActiveTab("meetings")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "meetings"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              data-testid="tab-meetings"
            >
              <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Sessions ({client.meetings?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "tasks"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              data-testid="tab-tasks"
            >
              <CheckSquare className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Tasks
            </button>
          </div>

          {activeTab === "tasks" && <TasksSection clientId={client.id} />}

          {activeTab === "meetings" && (
          <>
          <div className="flex items-center justify-end gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <Select value={sessionSort} onValueChange={(v) => handleSessionSortChange(v as SessionSortMode)}>
              <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-session-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Date (newest)</SelectItem>
                <SelectItem value="date-oldest">Date (oldest)</SelectItem>
                <SelectItem value="name-az">Name (A-Z)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {sortedMeetings.length > 0 ? (
            viewMode === "tile" ? (
              <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              >
                {sortedMeetings.map((meeting) => (
                  <motion.div 
                    key={meeting.id} 
                    variants={item}
                    className="group relative bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-5 sm:p-6 hover-elevate transition-all duration-300"
                    data-testid={`card-meeting-${meeting.id}`}
                  >
                    <div className="mb-4">
                      <StatusBadge status={meeting.status as any} />
                    </div>

                    <Link href={`/meeting/${meeting.id}`}>
                      <div className="block cursor-pointer">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-foreground mb-2 group-hover:text-primary transition-colors">
                          {meeting.title}
                        </h3>
                        
                        <div className="flex flex-col gap-2 mt-4 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            {format(new Date(meeting.date), "MMM d, yyyy")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            {format(new Date(meeting.date), "h:mm a")}
                          </div>
                        </div>

                        <div className="mt-6 flex items-center text-primary font-medium text-sm">
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {sortedMeetings.map((meeting) => (
                  <motion.div
                    key={meeting.id}
                    variants={item}
                    className="group relative bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border hover-elevate transition-all duration-200"
                    data-testid={`row-meeting-${meeting.id}`}
                  >
                    <Link href={`/meeting/${meeting.id}`} data-testid={`link-meeting-${meeting.id}`}>
                      <div className="flex items-center gap-4 p-4 cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-primary transition-colors" data-testid={`text-meeting-title-${meeting.id}`}>
                            {meeting.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {format(new Date(meeting.date), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {format(new Date(meeting.date), "h:mm a")}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={meeting.status as any} />
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 bg-slate-50 dark:bg-muted/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-border">
              <div className="w-16 h-16 bg-white dark:bg-background rounded-full flex items-center justify-center shadow-sm mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-foreground">No sessions yet</h3>
              <p className="text-slate-500 mt-1 mb-6 text-center px-4">No sessions have been recorded for this client.</p>
              <Link href="/new">
                <Button variant="outline" className="rounded-xl">Create Session</Button>
              </Link>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
