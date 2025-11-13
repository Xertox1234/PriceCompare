import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Pin, Eye, Heart, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  topicCount: number;
  postCount: number;
  icon: string;
}

interface Topic {
  id: number;
  title: string;
  content: string;
  slug: string;
  views: number;
  likes: number;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatar?: string;
    trustLevel: number;
    badges: string[];
  };
  category: Category;
  tags: string[];
  lastPost?: {
    author: string;
    createdAt: string;
  };
}

interface ForumTopicListProps {
  topics: Topic[];
  isLoading: boolean;
  onTopicClick: (topic: Topic) => void;
}

export function ForumTopicList({ topics, isLoading, onTopicClick }: ForumTopicListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Latest Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Latest Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No topics found. Be the first to start a discussion!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Latest Topics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topics.map(topic => (
            <div
              key={topic.id}
              className="flex items-start gap-4 p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
              onClick={() => onTopicClick(topic)}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {topic.author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {topic.isPinned && <Pin className="h-4 w-4 text-primary" />}
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: topic.category.color + '20', color: topic.category.color }}
                      >
                        {topic.category.name}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-1 line-clamp-2">{topic.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>by {topic.author.username}</span>
                      <span>{formatDistanceToNow(new Date(topic.createdAt))} ago</span>
                      {topic.lastPost && (
                        <span>
                          last reply by {topic.lastPost.author} {formatDistanceToNow(new Date(topic.lastPost.createdAt))} ago
                        </span>
                      )}
                    </div>
                    {topic.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {topic.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {topic.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{topic.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {topic.views}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {topic.postCount}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {topic.likes}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
