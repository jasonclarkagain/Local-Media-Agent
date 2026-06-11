import { useListDownloads, useDeleteDownload, getListDownloadsQueryKey } from "@workspace/api-client-react";
import { formatBytes, formatDuration } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2, HardDriveDownload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Downloads() {
  const { data: downloads, isLoading } = useListDownloads({ query: { refetchInterval: 3000 } });
  const deleteDownload = useDeleteDownload();
  const queryClient = useQueryClient();

  const handleDelete = (hash: string) => {
    deleteDownload.mutate({ hash }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey() })
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <HardDriveDownload className="w-8 h-8 mr-3 text-primary" />
          Active Downloads
        </h1>
      </div>

      <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden flex-1 flex flex-col">
        <Table>
          <TableHeader className="bg-black/40">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-mono text-xs text-muted-foreground">Name</TableHead>
              <TableHead className="w-[100px] font-mono text-xs text-muted-foreground">State</TableHead>
              <TableHead className="w-[200px] font-mono text-xs text-muted-foreground">Progress</TableHead>
              <TableHead className="w-[120px] text-right font-mono text-xs text-muted-foreground">Size</TableHead>
              <TableHead className="w-[120px] text-right font-mono text-xs text-muted-foreground">Speed</TableHead>
              <TableHead className="w-[100px] text-right font-mono text-xs text-muted-foreground">ETA</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-mono text-sm">Loading downloads...</TableCell>
              </TableRow>
            ) : downloads?.length ? (
              downloads.map((d) => (
                <TableRow key={d.hash} className="group border-border/30 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium truncate max-w-[300px] font-mono text-sm" title={d.name}>{d.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] font-mono border-primary/30 text-primary/80 bg-primary/10">{d.state}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress value={d.progress * 100} className="h-1.5 flex-1 bg-white/10" />
                      <span className="text-[10px] font-mono text-muted-foreground w-8">{(d.progress * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatBytes(d.size)}</TableCell>
                  <TableCell className="text-right text-xs font-mono text-primary/80">{formatBytes(d.downloadSpeed)}/s</TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatDuration(d.eta)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => handleDelete(d.hash)}
                      disabled={deleteDownload.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground font-mono">
                  <HardDriveDownload className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  No active downloads
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}