import { useState } from "react";
import { useSubmitCommand, useListJobs, useGetJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, ChevronRight, Loader2 } from "lucide-react";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { formatDate } from "@/lib/format";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Console() {
  const [command, setCommand] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const submitCmd = useSubmitCommand();
  const { data: jobs, isLoading: jobsLoading } = useListJobs({ limit: 20 }, { query: { refetchInterval: 3000 } });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    submitCmd.mutate({ data: { text: command } }, {
      onSuccess: () => {
        setCommand("");
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      }
    });
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex-shrink-0">
        <form onSubmit={onSubmit} className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <ChevronRight className="w-6 h-6 text-primary" />
          </div>
          <input
            type="text"
            className="w-full bg-black/40 border border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary text-foreground font-mono text-lg rounded-lg py-4 pl-12 pr-4 outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
            placeholder="Download latest Ubuntu ISO..."
            value={command}
            onChange={e => setCommand(e.target.value)}
            disabled={submitCmd.isPending}
            autoFocus
          />
          {submitCmd.isPending && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
        </form>
      </div>

      <div className="flex-1 border border-border/50 rounded-lg bg-card/30 overflow-hidden flex flex-col">
        <div className="h-10 border-b border-border bg-card/80 flex items-center px-4 shrink-0">
          <Terminal className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Process Feed</span>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {jobsLoading ? (
              <div className="text-center text-sm text-muted-foreground font-mono py-8">Loading feed...</div>
            ) : jobs?.map(job => (
              <div 
                key={job.id} 
                onClick={() => setSelectedJobId(job.id)}
                className="group p-3 border border-border/30 rounded-md bg-black/20 hover:border-primary/50 hover:bg-black/40 transition-all cursor-pointer flex items-center gap-4"
              >
                <div className="w-24 shrink-0">
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="flex-1 min-w-0 font-mono">
                  <div className="text-sm truncate font-medium text-primary/90">{job.command}</div>
                  {job.summary && <div className="text-xs text-muted-foreground truncate mt-1">{job.summary}</div>}
                </div>
                <div className="text-xs text-muted-foreground font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  ID: {job.id}
                </div>
              </div>
            ))}
            {jobs?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground font-mono py-8">No recent jobs. Waiting for commands...</div>
            )}
          </div>
        </ScrollArea>
      </div>

      <JobDetailDrawer 
        jobId={selectedJobId} 
        onClose={() => setSelectedJobId(null)} 
      />
    </div>
  );
}

function JobDetailDrawer({ jobId, onClose }: { jobId: number | null, onClose: () => void }) {
  const { data: job } = useGetJob(jobId!, { query: { enabled: !!jobId, refetchInterval: 3000 } });
  
  return (
    <Drawer open={!!jobId} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] bg-background/95 backdrop-blur-xl border-t border-border">
        <DrawerHeader className="border-b border-border text-left pb-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 max-w-6xl mx-auto w-full">
            <div>
              <DrawerTitle className="font-mono text-xl text-primary">{job?.command || 'Loading...'}</DrawerTitle>
              <DrawerDescription className="font-mono mt-2 flex items-center gap-4 text-xs">
                <span>ID: <span className="text-foreground">{jobId}</span></span>
                <span>TYPE: <span className="text-foreground">{job?.intentType || 'Unknown'}</span></span>
              </DrawerDescription>
            </div>
            {job && <JobStatusBadge status={job.status} />}
          </div>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-black/60 font-mono text-xs max-w-6xl mx-auto w-full rounded-md mt-4 mb-8 border border-white/5 shadow-inner">
           <ScrollArea className="flex-1 pr-4">
             <div className="space-y-1 pb-8">
               {job?.logs?.map(log => {
                 const color = 
                   log.level === 'error' ? 'text-red-400' :
                   log.level === 'warn' ? 'text-yellow-400' :
                   log.level === 'info' ? 'text-primary' : 'text-gray-500';
                 
                 return (
                   <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-1 rounded">
                     <span className="text-gray-500 shrink-0">{formatDate(log.createdAt).split(', ')[1]}</span>
                     <span className={`shrink-0 w-14 uppercase ${color}`}>[{log.level}]</span>
                     <span className="text-gray-300 break-words">{log.message}</span>
                   </div>
                 );
               })}
               {!job?.logs?.length && (
                 <div className="text-gray-500 italic">No logs available.</div>
               )}
             </div>
           </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}