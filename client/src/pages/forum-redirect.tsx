import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, ExternalLink, ArrowRight } from 'lucide-react';

function ForumRedirect() {
  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      window.open('http://localhost:3000', '_blank');
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleRedirect = () => {
    window.open('http://localhost:3000', '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Forum Has Been Upgraded!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            We've upgraded to a full-featured Discourse forum platform for better community discussions and engagement.
          </p>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">You'll be automatically redirected in 5 seconds...</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Or click below to visit now</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <Button onClick={handleRedirect} className="w-full">
            <MessageSquare className="h-4 w-4 mr-2" />
            Visit New Community Forum
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
          
          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>Your existing account will work seamlessly with the new forum platform.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ForumRedirect;