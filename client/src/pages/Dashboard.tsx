import { Link } from "wouter";
import { useMeetings, useDeleteMeeting } from "@/hooks/use-meetings";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Plus, ChevronRight, MoreVertical, Trash2, Calendar, Clock } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: meetings, isLoading, isError } = useMeetings();
  const deleteMutation = useDeleteMeeting();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
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

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Your Meetings</h1>
          <p className="text-slate-500 mt-1 font-body">Manage recordings and view AI insights.</p>
        </div>
        <Link href="/new">
          <Button 
            className="rounded-xl px-6 py-6 bg-primary hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5"
          >
            <Plus className="mr-2 w-5 h-5" />
            New Meeting
          </Button>
        </Link>
      </div>

      {/* Grid */}
      {meetings && meetings.length > 0 ? (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {meetings.map((meeting) => (
            <motion.div 
              key={meeting.id} 
              variants={item}
              className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-primary/20 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-4">
                <StatusBadge status={meeting.status as any} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 -mr-2 -mt-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
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
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Mic className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No meetings yet</h3>
          <p className="text-slate-500 mt-1 mb-6">Record or upload your first meeting to get started.</p>
          <Link href="/new">
            <Button variant="outline" className="rounded-xl">Create Meeting</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// Icon helper since Mic isn't imported in Dashboard
import { Mic } from "lucide-react";
