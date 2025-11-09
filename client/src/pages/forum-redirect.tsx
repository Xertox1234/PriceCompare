import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Server, BookOpen, Users } from 'lucide-react';
import { Link } from 'wouter';

function ForumRedirect() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Community Forum Coming Soon!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            We're setting up a full-featured Discourse forum platform for better community discussions and engagement.
          </p>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium">Community Features</h3>
              <p className="text-sm text-muted-foreground">User profiles, badges, and reputation system</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-success rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-medium">Rich Discussions</h3>
              <p className="text-sm text-muted-foreground">Categories, tags, and advanced moderation</p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                <Server className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="font-medium">SSO Integration</h3>
              <p className="text-sm text-muted-foreground">Seamless login with your existing account</p>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <h4 className="font-medium mb-2">For Developers:</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The Discourse forum infrastructure is ready with Docker containerization and SSO authentication. 
                  To deploy the forum, run the setup script:
                </p>
                <code className="text-xs bg-background px-2 py-1 rounded border">
                  bash scripts/discourse-setup.sh
                </code>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button asChild variant="outline">
              <Link href="/">
                Return to Home
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products">
                Browse Products
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ForumRedirect;