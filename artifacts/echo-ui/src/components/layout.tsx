import { Link, useLocation } from "wouter";
import { Terminal, LayoutDashboard, Download, Search, ListTree, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/console", label: "Console", icon: Terminal },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/search", label: "Search", icon: Search },
  { href: "/jobs", label: "Jobs", icon: ListTree },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Terminal className="w-6 h-6 mr-2 text-primary" />
          <span className="font-mono font-bold text-lg tracking-tight">ECHO_OS</span>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 md:hidden shrink-0">
          <Terminal className="w-6 h-6 mr-2 text-primary" />
          <span className="font-mono font-bold text-lg tracking-tight">ECHO_OS</span>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}