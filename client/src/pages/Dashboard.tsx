import { useState } from "react";
import { Link } from "wouter";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useClients } from "@/hooks/use-clients";
import { useOfflineRecordings, useOnlineStatus } from "@/hooks/use-offline";
import { retrySingle, syncAllPending } from "@/lib/offlineSync";
import { deleteOfflineRecording } from "@/lib/offlineDb";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Plus, ChevronRight, MoreVertical, Trash2, Calendar, Clock, Mic, Users, X, WifiOff, RefreshCw, Loader2, CloudUpload } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import { ViewToggle } from "@/components/ViewToggle";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { data: meetings, isLoading, isError } = useMeetings();
  const { data: clients } = useClients();
  const deleteMutation = useDeleteMeeting();
  const { recordings: offlineRecordings, refresh: refreshOffline } = useOfflineRecordings();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [viewMode, setViewMode] = useViewMode("dashboard-view");

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const result = await syncAllPending();
      if (result.synced > 0) {
        toast({ title: "Sync Complete", description: `${result.synced} recording(s) uploaded successfully.` });
      }
      if (result.failed > 0) {
        toast({ title: "Some Failed", description: `${result.failed} recording(s) failed to upload.`, variant: "destructive" });
      }
    } finally {
      setSyncingAll(false);
      await refreshOffline();
    }
  };

  const handleRetrySingle = async (id: string) => {
    setSyncingId(id);
    try {
      const success = await retrySingle(id);
      if (success) {
        toast({ title: "Upload Complete", description: "Recording uploaded and processing started." });
      } else {
        toast({ title: "Upload Failed", description: "Could not upload. Try again later.", variant: "destructive" });
      }
    } finally {
      setSyncingId(null);
      await refreshOffline();
    }
  };

  const handleDeleteOffline = async (id: string) => {
    await deleteOfflineRecording(id);
    await refreshOffline();
    toast({ title: "Deleted", description: "Offline recording removed." });
  };

  const pendingRecordings = offlineRecordings;

  const filteredMeetings = selectedClientId
    ? meetings?.filter(m => m.clientId === Number(selectedClientId))
    : meetings;

  const selectedClient = clients?.find(c => c.id === Number(selectedClientId));

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-slate-500">Failed to load meetings.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const getClientName = (clientId: number | null) => {
    if (!clientId || !clients) return null;
    return clients.find(c => c.id === clientId)?.name;
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-foreground" data-testid="text-dashboard-heading">Your Meetings</h1>
          <p className="text-slate-500 mt-1 font-body text-sm sm:text-base">Manage recordings and view AI insights.</p>
        </div>
        <Link href="/new">
          <Button 
            size="lg"
            className="rounded-xl w-full sm:w-auto"
            data-testid="button-new-meeting"
          >
            <Plus className="mr-2 w-5 h-5" />
            New Meeting
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-[220px] rounded-xl" data-testid="select-filter-client">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <SelectValue placeholder="Filter by client" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={String(client.id)}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedClientId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedClientId("")}
            className="text-slate-500"
            data-testid="button-clear-filter"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filter
          </Button>
        )}
        {selectedClient && (
          <Badge variant="secondary" className="rounded-lg">
            Showing meetings for: {selectedClient.name}
          </Badge>
        )}
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {pendingRecordings.length > 0 && (
        <div className="space-y-4" data-testid="section-offline-recordings">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">
                Saved Offline ({pendingRecordings.length})
              </h2>
            </div>
            {isOnline && pendingRecordings.some(r => r.status === "pending" || r.status === "failed") && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncAll}
                disabled={syncingAll}
                data-testid="button-sync-all"
              >
                {syncingAll ? (
                  <><Loader2 className="mr-1.5 w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><CloudUpload className="mr-1.5 w-4 h-4" /> Upload All</>
                )}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pendingRecordings.map((rec) => (
              <div
                key={rec.id}
                className="relative bg-white dark:bg-card rounded-2xl border border-amber-200 dark:border-amber-800 p-5 sm:p-6"
                data-testid={`card-offline-${rec.id}`}
              >
                <div className="flex justify-between items-start mb-4 gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      rec.status === "syncing"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : rec.status === "failed"
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }
                  >
                    {rec.status === "syncing" ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading</>
                    ) : rec.status === "failed" ? (
                      "Upload Failed"
                    ) : (
                      <><WifiOff className="w-3 h-3 mr-1" /> Waiting to Upload</>
                    )}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-2 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                      {isOnline && rec.status !== "syncing" && (
                        <DropdownMenuItem
                          className="rounded-lg cursor-pointer"
                          onClick={() => handleRetrySingle(rec.id)}
                          disabled={syncingId === rec.id}
                        >
                          <RefreshCw className="mr-2 w-4 h-4" />
                          Upload Now
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                        onClick={() => handleDeleteOffline(rec.id)}
                      >
                        <Trash2 className="mr-2 w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2">
                  {rec.title}
                </h3>

                <div className="flex flex-col gap-2 mt-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {format(new Date(rec.createdAt), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {format(new Date(rec.createdAt), "h:mm a")}
                  </div>
                </div>

                {rec.status === "failed" && rec.errorMessage && (
                  <p className="mt-3 text-xs text-red-500">{rec.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredMeetings && filteredMeetings.length > 0 ? (
        viewMode === "tile" ? (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {filteredMeetings.map((meeting) => {
              const clientName = getClientName(meeting.clientId);
              return (
                <motion.div 
                  key={meeting.id} 
                  variants={item}
                  className="group relative bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-5 sm:p-6 hover-elevate transition-all duration-300"
                  data-testid={`card-meeting-${meeting.id}`}
                >
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={meeting.status as any} />
                      {clientName && (
                        <Badge variant="outline" className="rounded-lg text-xs">
                          {clientName}
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-2 text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                          onClick={() => deleteMutation.mutate(meeting.id)}
                        >
                          <Trash2 className="mr-2 w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Link href={`/meeting/${meeting.id}`}>
                    <div className="block cursor-pointer">
                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                        {meeting.title}
                      </h3>
                      
                      <div className="flex flex-col gap-2 mt-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {format(new Date(meeting.date), "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
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
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {filteredMeetings.map((meeting) => {
              const clientName = getClientName(meeting.clientId);
              return (
                <motion.div
                  key={meeting.id}
                  variants={item}
                  className="group relative bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border hover-elevate transition-all duration-200"
                  data-testid={`row-meeting-${meeting.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <Link href={`/meeting/${meeting.id}`} className="flex-1 min-w-0" data-testid={`link-meeting-${meeting.id}`}>
                      <div className="flex items-center gap-4 cursor-pointer">
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
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <StatusBadge status={meeting.status as any} />
                          {clientName && (
                            <Badge variant="outline" className="rounded-lg text-xs">
                              {clientName}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-400 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                          onClick={() => deleteMutation.mutate(meeting.id)}
                        >
                          <Trash2 className="mr-2 w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Mic className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {selectedClientId ? "No meetings for this client" : "No meetings yet"}
          </h3>
          <p className="text-slate-500 mt-1 mb-6">
            {selectedClientId ? "Record or upload a meeting for this client." : "Record or upload your first meeting to get started."}
          </p>
          <Link href="/new">
            <Button variant="outline" className="rounded-xl">Create Meeting</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
