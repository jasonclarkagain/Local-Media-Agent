import { useGetStats, useGetServicesStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/format";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Activity, Download, HardDrive, Server, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { refetchInterval: 5000 } });
  const { data: services, isLoading: servicesLoading } = useGetServicesStatus({ query: { refetchInterval: 10000 } });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Jobs" value={stats?.runningJobs} icon={Activity} loading={statsLoading} />
        <StatCard title="Pending Jobs" value={stats?.pendingJobs} icon={Server} loading={statsLoading} />
        <StatCard title="Active Downloads" value={stats?.activeDownloads} icon={Download} loading={statsLoading} />
        <StatCard title="Total Data" value={stats?.totalDownloadedBytes ? formatBytes(stats.totalDownloadedBytes) : "0 B"} icon={HardDrive} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : stats?.recentJobs?.length ? (
              <div className="space-y-4">
                {stats.recentJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate font-mono text-primary/80">{job.command}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{job.summary || "Processing..."}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <JobStatusBadge status={job.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">No recent jobs</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
          </CardHeader>
          <CardContent>
             {servicesLoading ? (
               <div className="space-y-2">
                 <Skeleton className="h-8 w-full" />
                 <Skeleton className="h-8 w-full" />
               </div>
             ) : services?.services?.length ? (
               <div className="space-y-3">
                 {services.services.map(svc => (
                   <div key={svc.name} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                     <span className="text-sm font-medium font-mono">{svc.name}</span>
                     {svc.reachable ? (
                       <CheckCircle2 className="w-4 h-4 text-green-500" />
                     ) : (
                       <AlertTriangle className="w-4 h-4 text-destructive" />
                     )}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-4 text-muted-foreground font-mono text-sm">No services configured</div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string, value?: React.ReactNode, icon: any, loading: boolean }) {
  return (
    <Card className="border-border/50 shadow-none bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold font-mono">{value !== undefined ? value : "-"}</div>}
      </CardContent>
    </Card>
  );
}