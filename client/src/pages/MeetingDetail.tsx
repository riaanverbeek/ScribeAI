import { useState } from "react";
import { useMeeting, useUpdateMeetingClient } from "@/hooks/use-meetings";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useRoute, Link } from "wouter";
import { ChevronLeft, Calendar, User, LayoutList, FileText, CheckSquare, Sparkles, Users, Plus, Loader2, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function MeetingDetail() {
  const [, params] = useRoute("/meeting/:id");
  const id = params ? parseInt(params.id) : null;
  const { data: meeting, isLoading, error } = useMeeting(id);
  const { data: clients } = useClients();
  const updateClientMutation = useUpdateMeetingClient();
  const createClientMutation = useCreateClient();
  const { toast } = useToast();

  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");

  if (isLoading) return <div className="p-10 text-center text-slate-500">Loading details...</div>;
  if (error || !meeting) return <div className="p-10 text-center text-red-500">Meeting not found</div>;

  const linkedClient = meeting.clientId && clients ? clients.find(c => c.id === meeting.clientId) : null;

  const handleLinkClient = async (clientIdStr: string) => {
    if (!id) return;
    const clientId = clientIdStr ? Number(clientIdStr) : null;
    await updateClientMutation.mutateAsync({ meetingId: id, clientId });
    setIsEditingClient(false);
    setSelectedClientId("");
  };

  const handleUnlinkClient = async () => {
    if (!id) return;
    await updateClientMutation.mutateAsync({ meetingId: id, clientId: null });
    setIsEditingClient(false);
    setSelectedClientId("");
  };

  const handleCreateAndLink = async () => {
    if (!newClientName.trim() || !id) {
      toast({ title: "Name Required", description: "Please enter a client name.", variant: "destructive" });
      return;
    }
    try {
      const client = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        company: newClientCompany.trim() || null,
      });
      await updateClientMutation.mutateAsync({ meetingId: id, clientId: client.id });
      setNewClientName("");
      setNewClientEmail("");
      setNewClientCompany("");
      setDialogOpen(false);
      setIsEditingClient(false);
    } catch (error) {}
  };

  const startEditing = () => {
    setSelectedClientId(meeting.clientId ? String(meeting.clientId) : "");
    setIsEditingClient(true);
  };

  const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        <header className="bg-white dark:bg-background border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold" data-testid="text-meeting-title">{meeting.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(meeting.date), "MMMM d, yyyy")}
                </span>
                <StatusBadge status={meeting.status as any} />
              </div>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
            
            <motion.section {...fadeIn}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Linked Client</p>
                        {linkedClient ? (
                          <Link href={`/client/${linkedClient.id}`}>
                            <span className="text-sm font-semibold hover:underline cursor-pointer" data-testid="text-linked-client">
                              {linkedClient.name}
                              {linkedClient.company && <span className="text-muted-foreground font-normal"> — {linkedClient.company}</span>}
                            </span>
                          </Link>
                        ) : (
                          <p className="text-sm text-muted-foreground" data-testid="text-no-client">No client linked</p>
                        )}
                      </div>
                    </div>

                    {!isEditingClient ? (
                      <div className="flex items-center gap-2">
                        {linkedClient && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUnlinkClient}
                            disabled={updateClientMutation.isPending}
                            data-testid="button-unlink-client"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Unlink
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startEditing}
                          data-testid="button-change-client"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          {linkedClient ? "Change" : "Link Client"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedClientId}
                          onValueChange={(val) => handleLinkClient(val)}
                        >
                          <SelectTrigger className="w-[220px]" data-testid="select-link-client">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={String(client.id)} data-testid={`select-client-option-${client.id}`}>
                                <span>{client.name}</span>
                                {client.company && <span className="text-xs text-muted-foreground ml-1">({client.company})</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" data-testid="button-create-new-client">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create & Link Client</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-name">Name *</Label>
                                <Input
                                  id="detail-client-name"
                                  placeholder="e.g. John Smith"
                                  value={newClientName}
                                  onChange={(e) => setNewClientName(e.target.value)}
                                  data-testid="input-new-client-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-email">Email</Label>
                                <Input
                                  id="detail-client-email"
                                  type="email"
                                  placeholder="e.g. john@example.com"
                                  value={newClientEmail}
                                  onChange={(e) => setNewClientEmail(e.target.value)}
                                  data-testid="input-new-client-email"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-company">Company</Label>
                                <Input
                                  id="detail-client-company"
                                  placeholder="e.g. Acme Corp"
                                  value={newClientCompany}
                                  onChange={(e) => setNewClientCompany(e.target.value)}
                                  data-testid="input-new-client-company"
                                />
                              </div>
                              <Button
                                onClick={handleCreateAndLink}
                                disabled={createClientMutation.isPending || updateClientMutation.isPending}
                                className="w-full"
                                data-testid="button-save-and-link-client"
                              >
                                {createClientMutation.isPending || updateClientMutation.isPending ? (
                                  <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Creating...</>
                                ) : (
                                  "Create & Link"
                                )}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingClient(false)}
                          data-testid="button-cancel-edit-client"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            {meeting.audioUrl && (
              <motion.section {...fadeIn} className="mb-8">
                 <AudioPlayer url={meeting.audioUrl} />
              </motion.section>
            )}

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b p-0 h-auto rounded-none gap-8 mb-6">
                <TabsTrigger 
                  value="summary" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Executive Summary
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger 
                  value="actions" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Action Items
                </TabsTrigger>
                <TabsTrigger 
                  value="topics" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium"
                >
                  <LayoutList className="w-4 h-4 mr-2" />
                  Topics
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[400px]">
                <TabsContent value="summary" className="outline-none">
                  {meeting.summary ? (
                    <motion.div {...fadeIn} className="bg-card rounded-2xl border p-8">
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-display">
                        <div dangerouslySetInnerHTML={{ __html: meeting.summary.content }} />
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="summary" status={meeting.status} />
                  )}
                </TabsContent>

                <TabsContent value="transcript" className="outline-none">
                  {meeting.transcript ? (
                    <motion.div {...fadeIn} className="bg-card rounded-2xl border overflow-hidden">
                      <div className="p-6 space-y-6">
                        {meeting.transcript.content.split('\n\n').map((block, idx) => (
                          <div key={idx} className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <User className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold mb-1">Speaker {idx % 2 === 0 ? 'A' : 'B'}</p>
                              <p className="text-muted-foreground leading-relaxed">{block}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="transcript" status={meeting.status} />
                  )}
                </TabsContent>

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
                           <Card>
                             <CardContent className="p-6 flex items-start gap-4">
                               <div className="mt-0.5">
                                 <input type="checkbox" className="w-5 h-5 rounded border-input cursor-pointer" />
                               </div>
                               <div className="flex-1">
                                 <p className="font-medium">{item.content}</p>
                                 {item.assignee && (
                                   <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground">
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
                           <Card className="h-full">
                             <CardHeader>
                               <CardTitle className="text-lg font-bold flex justify-between items-start gap-2">
                                 {topic.title}
                                 {topic.relevanceScore && (
                                   <Badge variant="secondary" className="shrink-0">
                                     {topic.relevanceScore}%
                                   </Badge>
                                 )}
                               </CardTitle>
                             </CardHeader>
                             <CardContent>
                               <p className="text-muted-foreground text-sm leading-relaxed">{topic.summary}</p>
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
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
        </div>
        <h3 className="font-semibold">AI is working on it</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          We are currently generating the {type}. This typically takes 1-2 minutes depending on the audio length.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-muted/30">
      <p className="text-muted-foreground">No {type} available for this meeting.</p>
    </div>
  );
}
