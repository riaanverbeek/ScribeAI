import { useMeeting } from "@/hooks/use-meetings";
import { useClients } from "@/hooks/use-clients";
import { useRoute, Link } from "wouter";
import { ChevronLeft, Calendar, User, LayoutList, FileText, CheckSquare, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

export default function MeetingDetail() {
  const [, params] = useRoute("/meeting/:id");
  const id = params ? parseInt(params.id) : null;
  const { data: meeting, isLoading, error } = useMeeting(id);
  const { data: clients } = useClients();

  if (isLoading) return <div className="p-10 text-center text-slate-500">Loading details...</div>;
  if (error || !meeting) return <div className="p-10 text-center text-red-500">Meeting not found</div>;

  const clientName = meeting.clientId && clients ? clients.find(c => c.id === meeting.clientId)?.name : null;

  const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                <ChevronLeft className="w-5 h-5 text-slate-500" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold text-slate-900">{meeting.title}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(meeting.date), "MMMM d, yyyy")}
                </span>
                <StatusBadge status={meeting.status as any} />
                {clientName && (
                  <Link href={`/client/${meeting.clientId}`}>
                    <Badge variant="outline" className="rounded-lg cursor-pointer">
                      <Users className="w-3 h-3 mr-1" />
                      {clientName}
                    </Badge>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
            
            {/* Audio Player Section */}
            {meeting.audioUrl && (
              <motion.section {...fadeIn} className="mb-8">
                 <AudioPlayer url={meeting.audioUrl} />
              </motion.section>
            )}

            {/* Analysis Tabs */}
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b border-slate-200 p-0 h-auto rounded-none gap-8 mb-6">
                <TabsTrigger 
                  value="summary" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700 data-[state=active]:shadow-none font-medium"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Executive Summary
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700 data-[state=active]:shadow-none font-medium"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger 
                  value="actions" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700 data-[state=active]:shadow-none font-medium"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Action Items
                </TabsTrigger>
                <TabsTrigger 
                  value="topics" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700 data-[state=active]:shadow-none font-medium"
                >
                  <LayoutList className="w-4 h-4 mr-2" />
                  Topics
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[400px]">
                {/* Summary Tab */}
                <TabsContent value="summary" className="outline-none">
                  {meeting.summary ? (
                    <motion.div {...fadeIn} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                      <div className="prose prose-slate max-w-none prose-headings:font-display prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed">
                        <div dangerouslySetInnerHTML={{ __html: meeting.summary.content }} />
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="summary" status={meeting.status} />
                  )}
                </TabsContent>

                {/* Transcript Tab */}
                <TabsContent value="transcript" className="outline-none">
                  {meeting.transcript ? (
                    <motion.div {...fadeIn} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 space-y-6">
                        {meeting.transcript.content.split('\n\n').map((block, idx) => (
                          <div key={idx} className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <User className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900 mb-1">Speaker {idx % 2 === 0 ? 'A' : 'B'}</p>
                              <p className="text-slate-600 leading-relaxed">{block}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="transcript" status={meeting.status} />
                  )}
                </TabsContent>

                {/* Action Items Tab */}
                <TabsContent value="actions" className="outline-none">
                  {meeting.actionItems && meeting.actionItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {meeting.actionItems.map((item, idx) => (
                        <motion.div 
                          key={item.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                           <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                             <CardContent className="p-6 flex items-start gap-4">
                               <div className="mt-0.5">
                                 <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" />
                               </div>
                               <div className="flex-1">
                                 <p className="text-slate-900 font-medium">{item.content}</p>
                                 {item.assignee && (
                                   <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-600">
                                     <User className="w-3 h-3 mr-1" />
                                     {item.assignee}
                                   </div>
                                 )}
                               </div>
                             </CardContent>
                           </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState type="action items" status={meeting.status} />
                  )}
                </TabsContent>

                {/* Topics Tab */}
                <TabsContent value="topics" className="outline-none">
                  {meeting.topics && meeting.topics.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {meeting.topics.map((topic, idx) => (
                         <motion.div 
                           key={topic.id}
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ delay: idx * 0.1 }}
                         >
                           <Card className="h-full border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                             <CardHeader>
                               <CardTitle className="text-lg font-bold text-slate-900 flex justify-between items-start">
                                 {topic.title}
                                 {topic.relevanceScore && (
                                   <span className="text-xs font-normal px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                                     {topic.relevanceScore}% relevant
                                   </span>
                                 )}
                               </CardTitle>
                             </CardHeader>
                             <CardContent>
                               <p className="text-slate-600 text-sm leading-relaxed">{topic.summary}</p>
                             </CardContent>
                           </Card>
                         </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState type="topics" status={meeting.status} />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function EmptyState({ type, status }: { type: string, status: string | undefined }) {
  if (status === 'processing' || status === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
        </div>
        <h3 className="font-semibold text-slate-900">AI is working on it</h3>
        <p className="text-slate-500 mt-1 max-w-sm">
          We are currently generating the {type}. This typically takes 1-2 minutes depending on the audio length.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
      <p className="text-slate-500">No {type} available for this meeting.</p>
    </div>
  );
}
