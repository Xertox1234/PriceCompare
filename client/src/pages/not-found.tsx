import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="bg-muted flex min-h-screen w-full items-center justify-center">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <AlertCircle className="text-destructive h-8 w-8" />
            <h1 className="text-muted-foreground text-2xl font-bold">404 Page Not Found</h1>
          </div>

          <p className="text-muted-foreground mt-4 text-sm">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
