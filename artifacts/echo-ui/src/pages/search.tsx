import { useState } from "react";
import { useSearchTorrents, useAddTorrent } from "@workspace/api-client-react";
import { formatBytes } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const searchCmd = useSearchTorrents();
  const addCmd = useAddTorrent();
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchCmd.mutate({ data: { query } });
  };

  const handleAdd = (result: any) => {
    addCmd.mutate({ 
      data: { 
        magnetUrl: result.magnetUrl, 
        torrentUrl: result.downloadUrl, 
        name: result.title 
      } 
    }, {
      onSuccess: () => {
        toast({
          title: "Torrent added",
          description: "Download has started in qBittorrent.",
        });
      },
      onError: (err: any) => {
         toast({
          title: "Failed to add torrent",
          description: err?.error || "Unknown error occurred.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="flex-shrink-0">
        <form onSubmit={handleSearch} className="relative group flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <input
              type="text"
              className="w-full bg-black/40 border border-primary/20 focus:border-primary focus:ring-1 focus:ring-primary text-foreground font-mono text-lg rounded-lg py-4 pl-12 pr-4 outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
              placeholder="Search indexers..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={searchCmd.isPending}
            />
          </div>
          <Button 
            type="submit" 
            className="h-[60px] px-8 font-mono tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={searchCmd.isPending || !query.trim()}
          >
            {searchCmd.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SEARCH'}
          </Button>
        </form>
      </div>

      <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden flex-1 flex flex-col">
        <Table>
          <TableHeader className="bg-black/40">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-mono text-xs text-muted-foreground">Title</TableHead>
              <TableHead className="w-[120px] font-mono text-xs text-muted-foreground">Indexer</TableHead>
              <TableHead className="w-[100px] text-right font-mono text-xs text-muted-foreground">Size</TableHead>
              <TableHead className="w-[80px] text-right font-mono text-xs text-green-400">Seed</TableHead>
              <TableHead className="w-[80px] text-right font-mono text-xs text-red-400">Leech</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searchCmd.isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-mono">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                  Searching indexers...
                </TableCell>
              </TableRow>
            ) : searchCmd.data?.length ? (
              searchCmd.data.map((result, idx) => (
                <TableRow key={idx} className="group border-border/30 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium font-mono text-sm max-w-[400px] truncate" title={result.title}>{result.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground bg-black/20">{result.indexer}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatBytes(result.size)}</TableCell>
                  <TableCell className="text-right text-xs font-mono text-green-400/80">{result.seeders}</TableCell>
                  <TableCell className="text-right text-xs font-mono text-red-400/80">{result.leechers}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/20 hover:text-primary"
                      onClick={() => handleAdd(result)}
                      disabled={addCmd.isPending}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : searchCmd.isSuccess ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-mono">
                  No results found for "{searchCmd.variables?.data?.query}"
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-24 text-muted-foreground font-mono">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  Ready to search connected indexers
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}