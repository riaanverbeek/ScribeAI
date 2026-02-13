import { useState } from "react";
import { Link } from "wouter";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { useClients } from "@/hooks/use-clients";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Plus, ChevronRight, MoreVertical, Trash2, Calendar, Clock, Mic, Users, X } from "lucide-react";
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

export default function Dashboard() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const { data: meetings, isLoading, isError } = useMeetings();
  const { data: clients } = useClients();
  const deleteMutation = useDeleteMeeting();

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
      </div>

      {filteredMeetings && filteredMeetings.length > 0 ? (
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
                className="group relative bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-5 sm:p-6 hover:shadow-xl hover:border-primary/20 transition-all duration-300"
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
