import { useClient } from "@/hooks/use-clients";
import { useRoute, Link } from "wouter";
import { ChevronLeft, Calendar, Clock, ChevronRight, Users, Building2, Mail } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import { ViewToggle } from "@/components/ViewToggle";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function ClientDetail() {
  const [, params] = useRoute("/client/:id");
  const id = params ? parseInt(params.id) : null;
  const { data: client, isLoading, error } = useClient(id);

  const [viewMode, setViewMode] = useViewMode("client-detail-view");

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
            <span className="hidden sm:inline">New Meeting</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">
                Meetings ({client.meetings?.length || 0})
              </h2>
            </div>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {client.meetings && client.meetings.length > 0 ? (
            viewMode === "tile" ? (
              <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              >
                {client.meetings.map((meeting) => (
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
                {client.meetings.map((meeting) => (
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-foreground">No meetings yet</h3>
              <p className="text-slate-500 mt-1 mb-6 text-center px-4">No meetings have been recorded for this client.</p>
              <Link href="/new">
                <Button variant="outline" className="rounded-xl">Create Meeting</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
