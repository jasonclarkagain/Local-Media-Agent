import { useState } from "react";
import { useListJobs, useGetJob, useCancelJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { formatDate } from "@/lib/format";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ListTree, XCircle, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function JobsPage() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const { data: jobs, isLoading } = useListJobs({}, { query: { refetchInterval: 3000 } });
  
  const queryClient = useQueryClient();
  const cancelCmd = useCancelJob();

  const handleCancel = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    cancelCmd.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() })
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <ListTree className="w-8 h-8 mr-3 text-primary" />
          Job History
        </h1>
      </div>

      <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden flex-1 flex flex-col">
        <Table>
          <TableHeader className="bg-black/40">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[100px] font-mono text-xs text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">Command</TableHead>
              <TableHead className="w-[150px] font-mono text-xs text-muted-foreground">Intent</TableHead>
              <TableHead className="w-[180px] font-mono text-xs text-muted-foreground">Date</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground font-mono">Loading job history...</TableCell>
              </TableRow>
            ) : jobs?.length ? (
              jobs.map((job) => (
                <TableRow 
                  key={job.id} 
                  className="group border-border/30 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground/90 max-w-[300px] truncate" title={job.command}>
                    {job.command}
                    <div className="text-xs text-muted-foreground mt-1 truncate">{job.summary}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {job.intentType || 'Unknown'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(job.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(job.status === 'pending' || job.status === 'running') && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 font-mono text-xs"
                        onClick={(e) => handleCancel(e, job.id)}
                        disabled={cancelCmd.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Stop
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-24 text-muted-foreground font-mono">
                  <ListTree className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  No jobs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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