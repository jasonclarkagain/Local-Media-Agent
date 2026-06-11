import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useGetSettings, useUpdateSettings, useGetServicesStatus, getGetSettingsQueryKey, getGetServicesStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save, Activity, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const settingsSchema = z.object({
  ollamaUrl: z.string().optional().nullable(),
  ollamaModel: z.string().optional().nullable(),
  qbittorrentUrl: z.string().optional().nullable(),
  qbittorrentUsername: z.string().optional().nullable(),
  qbittorrentPassword: z.string().optional().nullable(),
  prowlarrUrl: z.string().optional().nullable(),
  prowlarrApiKey: z.string().optional().nullable(),
  lidarrUrl: z.string().optional().nullable(),
  lidarrApiKey: z.string().optional().nullable(),
  radarrUrl: z.string().optional().nullable(),
  radarrApiKey: z.string().optional().nullable(),
  sonarrUrl: z.string().optional().nullable(),
  sonarrApiKey: z.string().optional().nullable(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { data: servicesStatus, refetch: testConnections, isFetching: testing } = useGetServicesStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      ollamaUrl: "",
      ollamaModel: "",
      qbittorrentUrl: "",
      qbittorrentUsername: "",
      qbittorrentPassword: "",
      prowlarrUrl: "",
      prowlarrApiKey: "",
      lidarrUrl: "",
      lidarrApiKey: "",
      radarrUrl: "",
      radarrApiKey: "",
      sonarrUrl: "",
      sonarrApiKey: "",
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        ollamaUrl: settings.ollamaUrl || "",
        ollamaModel: settings.ollamaModel || "",
        qbittorrentUrl: settings.qbittorrentUrl || "",
        qbittorrentUsername: settings.qbittorrentUsername || "",
        qbittorrentPassword: settings.qbittorrentPassword || "",
        prowlarrUrl: settings.prowlarrUrl || "",
        prowlarrApiKey: settings.prowlarrApiKey || "",
        lidarrUrl: settings.lidarrUrl || "",
        lidarrApiKey: settings.lidarrApiKey || "",
        radarrUrl: settings.radarrUrl || "",
        radarrApiKey: settings.radarrApiKey || "",
        sonarrUrl: settings.sonarrUrl || "",
        sonarrApiKey: settings.sonarrApiKey || "",
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsValues) => {
    updateSettings.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Settings saved successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        testConnections();
      },
      onError: (err: any) => {
        toast({ title: "Failed to save", description: err?.error || "Unknown error", variant: "destructive" });
      }
    });
  };

  const getServiceStatus = (name: string) => {
    return servicesStatus?.services?.find(s => s.name.toLowerCase() === name.toLowerCase());
  };

  const StatusBadge = ({ name }: { name: string }) => {
    const status = getServiceStatus(name);
    if (!status) return null;
    
    if (status.reachable) {
      return <Badge variant="outline" className="ml-2 font-mono text-[10px] border-green-500/30 text-green-500 bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1"/> OK</Badge>;
    }
    if (status.configured && !status.reachable) {
       return <Badge variant="outline" className="ml-2 font-mono text-[10px] border-destructive/30 text-destructive bg-destructive/10"><AlertTriangle className="w-3 h-3 mr-1"/> ERR</Badge>;
    }
    return <Badge variant="outline" className="ml-2 font-mono text-[10px] border-white/10 text-muted-foreground bg-black/20">UNCONFIGURED</Badge>;
  };

  if (isLoading) return <div className="text-center py-20 text-muted-foreground font-mono">Loading configuration...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3 text-primary" />
          Configuration
        </h1>
        <Button 
          variant="outline" 
          onClick={() => testConnections()} 
          disabled={testing}
          className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
        >
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
          Test Connections
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* LLM Engine */}
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center">
                LLM Engine <StatusBadge name="ollama" />
              </CardTitle>
              <CardDescription className="font-mono text-xs">Local AI model configuration</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="ollamaUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">Ollama URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://localhost:11434" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="ollamaModel" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">Model Name</FormLabel>
                  <FormControl>
                    <Input placeholder="llama3:8b" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </CardContent>
          </Card>

          {/* qBittorrent */}
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center">
                qBittorrent <StatusBadge name="qbittorrent" />
              </CardTitle>
              <CardDescription className="font-mono text-xs">Download client</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="qbittorrentUrl" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="font-mono text-xs text-muted-foreground">URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://localhost:8080" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="qbittorrentUsername" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">Username</FormLabel>
                  <FormControl>
                    <Input className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="qbittorrentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">Password</FormLabel>
                  <FormControl>
                    <Input type="password" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </CardContent>
          </Card>

          {/* Indexers */}
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center">
                Prowlarr <StatusBadge name="prowlarr" />
              </CardTitle>
              <CardDescription className="font-mono text-xs">Indexer manager</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="prowlarrUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://localhost:9696" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="prowlarrApiKey" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">API Key</FormLabel>
                  <FormControl>
                    <Input type="password" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </CardContent>
          </Card>

          {/* Lidarr */}
          <Card className="border-border/50 bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono text-lg flex items-center">
                Lidarr <StatusBadge name="lidarr" />
              </CardTitle>
              <CardDescription className="font-mono text-xs">Music collection manager</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="lidarrUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">URL</FormLabel>
                  <FormControl>
                    <Input placeholder="http://localhost:8686" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="lidarrApiKey" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs text-muted-foreground">API Key</FormLabel>
                  <FormControl>
                    <Input type="password" className="font-mono text-sm bg-black/40 border-border/50 focus:border-primary/50" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </CardContent>
          </Card>
          
          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              className="bg-primary text-primary-foreground font-mono tracking-wide px-8" 
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              SAVE CONFIGURATION
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}