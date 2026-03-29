import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useClients } from "@/hooks/use-clients";
import { useOfflineRecordings, useOnlineStatus } from "@/hooks/use-offline";
import { retrySingle, syncAllPending } from "@/lib/offlineSync";
import { deleteOfflineRecording } from "@/lib/offlineDb";
import { useHasRecoverableRecording } from "@/hooks/use-recovery";
import { StatusBadge } from "@/components/StatusBadge";
import { MergeDialog } from "@/components/MergeDialog";
import { format } from "date-fns";
import { Plus, ChevronRight, MoreVertical, Trash2, Calendar, Clock, Mic, Users, X, WifiOff, RefreshCw, Loader2, CloudUpload, Phone, ArrowUpDown, RotateCcw, Merge, CheckSquare } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const [, setLocation] = useLocation();
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
  const [deleteMeetingId, setDeleteMeetingId] = useState<number | null>(null);
  const [deleteOfflineId, setDeleteOfflineId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<string>(() => {
    return localStorage.getItem("dashboard-sort") || "date-newest";
  });
  const { hasRecoverable, discard: discardRecovery } = useHasRecoverableRecording();
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const toggleMergeSelection = (id: number) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge(new Set());
  };

  const selectedMeetingsForMerge = useMemo(() => {
    if (!meetings) return [];
    return meetings.filter(m => selectedForMerge.has(m.id));
  }, [meetings, selectedForMerge]);

  const handleSortChange = (value: string) => {
    setSortMode(value);
    localStorage.setItem("dashboard-sort", value);
  };

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

  const getClientName = (clientId: number | null) => {
    if (!clientId || !clients) return null;
    return clients.find(c => c.id === clientId)?.name;
  };

  const filteredMeetings = selectedClientId
    ? meetings?.filter(m => m.clientId === Number(selectedClientId))
    : meetings;

  const sortedMeetings = useMemo(() => {
    if (!filteredMeetings) return filteredMeetings;
    const sorted = [...filteredMeetings];
    switch (sortMode) {
      case "date-newest":
        sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "date-oldest":
        sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "name-az":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "name-za":
        sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
      case "client-az":
        sorted.sort((a, b) => {
          const nameA = getClientName(a.clientId) || "";
          const nameB = getClientName(b.clientId) || "";
          return nameA.localeCompare(nameB);
        });
        break;
      case "status":
        sorted.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        break;
      default:
        break;
    }
    return sorted;
  }, [filteredMeetings, sortMode, clients]);

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
          <p className="text-slate-500">Failed to load sessions.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-foreground" data-testid="text-dashboard-heading">Your Sessions</h1>
          <p className="text-slate-500 mt-1 font-body text-sm sm:text-base">Manage recordings and view AI insights.</p>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/quick-record" className="flex-1 min-w-0 sm:flex-none">
            <Button 
              size="lg"
              variant="outline"
              className="rounded-xl w-full px-3 sm:px-8 text-sm sm:text-base"
              data-testid="button-quick-record"
            >
              <Phone className="mr-1.5 sm:mr-2 w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              Quick Record
            </Button>
          </Link>
          <Link href="/new" className="flex-1 min-w-0 sm:flex-none">
            <Button 
              size="lg"
              className="rounded-xl w-full px-3 sm:px-8 text-sm sm:text-base"
              data-testid="button-new-meeting"
            >
              <Plus className="mr-1.5 sm:mr-2 w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              New Session
            </Button>
          </Link>
        </div>
      </div>

      {hasRecoverable && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4" data-testid="banner-dashboard-recovery">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                Interrupted recording found
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                A previous recording was interrupted and can be recovered. Choose where to continue:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/quick-record">
                  <Button size="sm" data-testid="button-recover-quickrecord">
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Quick Record
                  </Button>
                </Link>
                <Link href="/new">
                  <Button size="sm" variant="outline" data-testid="button-recover-newsession">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Session
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blue-600 dark:text-blue-400"
                  onClick={async () => {
                    await discardRecovery();
                    toast({ title: "Discarded", description: "The interrupted recording has been removed." });
                  }}
                  data-testid="button-discard-dashboard-recovery"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            Showing sessions for: {selectedClient.name}
          </Badge>
        )}
        <Select value={sortMode} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-[200px] rounded-xl" data-testid="select-sort">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <SelectValue placeholder="Sort by" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-newest">Date (newest first)</SelectItem>
            <SelectItem value="date-oldest">Date (oldest first)</SelectItem>
            <SelectItem value="name-az">Session name (A-Z)</SelectItem>
            <SelectItem value="name-za">Session name (Z-A)</SelectItem>
            <SelectItem value="client-az">Client (A-Z)</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          {!mergeMode ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setMergeMode(true)}
              disabled={!sortedMeetings || sortedMeetings.length < 2}
              data-testid="button-enter-merge-mode"
            >
              <Merge className="w-4 h-4 mr-1.5" />
              Merge
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="rounded-xl"
                disabled={selectedForMerge.size < 2}
                onClick={() => setMergeDialogOpen(true)}
                data-testid="button-open-merge-dialog"
              >
                <Merge className="w-4 h-4 mr-1.5" />
                Merge ({selectedForMerge.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={exitMergeMode}
                data-testid="button-exit-merge-mode"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}
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
                        onClick={() => setDeleteOfflineId(rec.id)}
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

      {sortedMeetings && sortedMeetings.length > 0 ? (
        viewMode === "tile" ? (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {sortedMeetings.map((meeting) => {
              const clientName = getClientName(meeting.clientId);
              const isSelected = selectedForMerge.has(meeting.id);
              return (
                <motion.div 
                  key={meeting.id} 
                  variants={item}
                  className={`group relative bg-white dark:bg-card rounded-2xl border p-5 sm:p-6 hover-elevate transition-all duration-300 ${
                    mergeMode && isSelected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-border"
                  }`}
                  data-testid={`card-meeting-${meeting.id}`}
                  onClick={mergeMode ? () => toggleMergeSelection(meeting.id) : undefined}
                >
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {mergeMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleMergeSelection(meeting.id)}
                            data-testid={`checkbox-merge-${meeting.id}`}
                          />
                        </div>
                      )}
                      <StatusBadge status={meeting.status as any} />
                      {clientName && (
                        <Badge variant="outline" className="rounded-lg text-xs">
                          {clientName}
                        </Badge>
                      )}
                    </div>
                    {!mergeMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="-mr-2 -mt-2 text-slate-400">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                          <DropdownMenuItem
                            className="rounded-lg cursor-pointer"
                            onClick={() => {
                              setMergeMode(true);
                              setSelectedForMerge(new Set([meeting.id]));
                            }}
                          >
                            <Merge className="mr-2 w-4 h-4" />
                            Merge with...
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                            onClick={() => setDeleteMeetingId(meeting.id)}
                          >
                            <Trash2 className="mr-2 w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {!mergeMode ? (
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
                  ) : (
                    <div className="cursor-pointer">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
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
                    </div>
                  )}
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
            {sortedMeetings.map((meeting) => {
              const clientName = getClientName(meeting.clientId);
              const isSelected = selectedForMerge.has(meeting.id);
              return (
                <motion.div
                  key={meeting.id}
                  variants={item}
                  className={`group relative bg-white dark:bg-card rounded-xl border hover-elevate transition-all duration-200 ${
                    mergeMode && isSelected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-border"
                  }`}
                  data-testid={`row-meeting-${meeting.id}`}
                  onClick={mergeMode ? () => toggleMergeSelection(meeting.id) : undefined}
                >
                  <div className="flex items-center gap-3 p-3">
                    {mergeMode && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMergeSelection(meeting.id)}
                          className="shrink-0"
                          data-testid={`checkbox-merge-list-${meeting.id}`}
                        />
                      </div>
                    )}
                    {!mergeMode ? (
                      <Link href={`/meeting/${meeting.id}`} className="flex-1 min-w-0" data-testid={`link-meeting-${meeting.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 cursor-pointer">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-primary transition-colors text-sm sm:text-base" data-testid={`text-meeting-title-${meeting.id}`}>
                              {meeting.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 shrink-0 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                              {format(new Date(meeting.date), "MMM d")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                              {format(new Date(meeting.date), "h:mm a")}
                            </span>
                            <StatusBadge status={meeting.status as any} />
                            {clientName && (
                              <Badge variant="outline" className="rounded-lg text-xs">
                                {clientName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex-1 min-w-0 cursor-pointer">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-foreground truncate text-sm sm:text-base">
                              {meeting.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 shrink-0 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                              {format(new Date(meeting.date), "MMM d")}
                            </span>
                            <StatusBadge status={meeting.status as any} />
                          </div>
                        </div>
                      </div>
                    )}
                    {!mergeMode && (
                      <>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-1 hidden sm:block" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-slate-400 shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                            <DropdownMenuItem
                              className="rounded-lg cursor-pointer"
                              onClick={() => {
                                setMergeMode(true);
                                setSelectedForMerge(new Set([meeting.id]));
                              }}
                            >
                              <Merge className="mr-2 w-4 h-4" />
                              Merge with...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                              onClick={() => setDeleteMeetingId(meeting.id)}
                            >
                              <Trash2 className="mr-2 w-4 h-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
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
            {selectedClientId ? "No sessions for this client" : "No sessions yet"}
          </h3>
          <p className="text-slate-500 mt-1 mb-6">
            {selectedClientId ? "Record or upload a session for this client." : "Record or upload your first session to get started."}
          </p>
          <Link href="/new">
            <Button variant="outline" className="rounded-xl">Create Session</Button>
          </Link>
        </div>
      )}

      <MergeDialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) exitMergeMode();
        }}
        selectedMeetings={selectedMeetingsForMerge}
        onMergeComplete={(targetId) => {
          exitMergeMode();
          setLocation(`/meeting/${targetId}`);
        }}
      />

      <AlertDialog open={deleteMeetingId !== null} onOpenChange={(open) => { if (!open) setDeleteMeetingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-meeting">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-meeting"
              onClick={() => {
                if (deleteMeetingId !== null) {
                  deleteMutation.mutate(deleteMeetingId);
                  setDeleteMeetingId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOfflineId !== null} onOpenChange={(open) => { if (!open) setDeleteOfflineId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offline Recording</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-offline">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-offline"
              onClick={() => {
                if (deleteOfflineId !== null) {
                  handleDeleteOffline(deleteOfflineId);
                  setDeleteOfflineId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
