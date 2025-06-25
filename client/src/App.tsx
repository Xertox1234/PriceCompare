import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SharedNavigation } from "@/components/shared-navigation";
import Home from "@/pages/home";
import ForumPage from "@/pages/forum";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <SharedNavigation />
      <main className="container mx-auto px-4 py-6">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/forum" component={ForumPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Skip to main content link for accessibility */}
          <a 
            href="#main-content" 
            className="skip-link focus-visible"
            tabIndex={0}
          >
            Skip to main content
          </a>
          <Router />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
