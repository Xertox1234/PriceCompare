import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, BookOpen, Users, Flame } from 'lucide-react';

interface ForumStatsProps {
  topicsCount: number;
  categoriesCount: number;
}

export function ForumStats({ topicsCount, categoriesCount }: ForumStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Topics</p>
              <p className="text-2xl font-semibold">{topicsCount}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-semibold">{categoriesCount}</p>
            </div>
            <BookOpen className="h-8 w-8 text-success" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-semibold">24</p>
            </div>
            <Users className="h-8 w-8 text-secondary" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Hot Topics</p>
              <p className="text-2xl font-semibold">12</p>
            </div>
            <Flame className="h-8 w-8 text-destructive" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
