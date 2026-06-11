import { Badge } from "@/components/ui/badge";
import { JobStatus } from "@workspace/api-client-react";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const variants: Record<JobStatus, string> = {
    pending: "bg-muted text-muted-foreground border-muted",
    running: "bg-primary/20 text-primary border-primary/30 animate-pulse",
    completed: "bg-green-500/20 text-green-500 border-green-500/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
    cancelled: "bg-muted text-muted-foreground border-muted opacity-50",
  };

  return (
    <Badge variant="outline" className={`font-mono uppercase text-xs ${variants[status]}`}>
      {status}
    </Badge>
  );
}