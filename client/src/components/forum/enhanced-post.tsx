import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart, MessageSquare, Share2, Flag, Edit3, Trash2,
  Clock, User, Award, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { sanitizeMarkdown } from '@/lib/sanitize';
import { sanitizeHtml } from '@/utils/sanitize';

interface EnhancedPostProps {
  post: {
    id: number;
    content: string;
    rawContent: string;
    postNumber: number;
    likeCount: number;
    replyCount: number;
    isFirstPost: boolean;
    createdAt: string;
    editedAt?: string;
    author: {
      id: number;
      username: string;
      avatarUrl?: string;
      trustLevel: number;
      trustLevelName: string;
      reputation: number;
      badges?: Array<{
        name: string;
        icon: string;
        color: string;
        type: string;
      }>;
    };
    likes?: Array<{
      id: number;
      user: {
        username: string;
        avatarUrl?: string;
      };
    }>;
    mentions?: Array<{
      mentionedUser: {
        username: string;
      };
    }>;
    userHasLiked?: boolean;
    userCanEdit?: boolean;
    userCanDelete?: boolean;
  };
  currentUserId?: number;
  onReply?: () => void;
}

export function EnhancedPost({ post, currentUserId, onReply }: EnhancedPostProps) {
  const [showLikes, setShowLikes] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.rawContent);
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/forum/posts/${post.id}/like`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/forum/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      setIsEditing(false);
    },
  });

  const getTrustLevelColor = (level: number) => {
    const colors = ['gray', 'blue', 'green', 'yellow', 'purple'];
    return colors[level] || 'gray';
  };

  const getTrustLevelIcon = (level: number) => {
    if (level >= 4) return '👑';
    if (level >= 3) return '⭐';
    if (level >= 2) return '🔥';
    return '👤';
  };

  const handleLike = () => {
    if (currentUserId) {
      likeMutation.mutate();
    }
  };

  const handleEdit = () => {
    editMutation.mutate(editContent);
  };

  const renderContent = (content: string) => {
    // Basic markdown-like rendering with XSS protection
    // First, do the replacements on the raw content
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/@(\w+)/g, '<span class="text-primary font-medium">@$1</span>')
      .replace(/\n/g, '<br>');

    // Then sanitize to remove any malicious content
    return sanitizeMarkdown(formatted);
  };

  return (
    <Card className={`${post.isFirstPost ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-6">
        <div className="flex space-x-4">
          {/* Author Avatar */}
          <div className="flex-shrink-0">
            <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
              <AvatarImage src={post.author.avatarUrl} alt={post.author.username} />
              <AvatarFallback className={`bg-gradient-to-br from-${getTrustLevelColor(post.author.trustLevel)}-400 to-${getTrustLevelColor(post.author.trustLevel)}-600 text-white font-bold`}>
                {post.author.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            {/* Post Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-muted-foreground">{post.author.username}</h4>
                  <Badge 
                    variant="outline" 
                    className={`text-xs bg-${getTrustLevelColor(post.author.trustLevel)}-100 text-${getTrustLevelColor(post.author.trustLevel)}-800 border-${getTrustLevelColor(post.author.trustLevel)}-200`}
                  >
                    <span className="mr-1">{getTrustLevelIcon(post.author.trustLevel)}</span>
                    {post.author.trustLevelName}
                  </Badge>
                  {post.author.badges?.slice(0, 2).map((badge, index) => (
                    <Badge 
                      key={index}
                      variant="secondary" 
                      className="text-xs"
                      style={{ backgroundColor: badge.color + '20', color: badge.color }}
                    >
                      {badge.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>#{post.postNumber}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                  {post.editedAt && (
                    <>
                      <span>•</span>
                      <span className="text-warning">edited</span>
                    </>
                  )}
                </div>
              </div>

              {/* Post Actions */}
              <div className="flex items-center space-x-1">
                {post.userCanEdit && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}
                {post.userCanDelete && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Post Content */}
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Edit your post..."
                />
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    onClick={handleEdit}
                    disabled={editMutation.isPending}
                  >
                    {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(post.rawContent);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none text-muted-foreground mb-4"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(renderContent(post.content))
                }}
              />
            )}

            {/* Mentions */}
            {post.mentions && post.mentions.length > 0 && (
              <div className="mb-4 p-3 bg-primary rounded-lg border border-blue-200">
                <p className="text-sm text-primary font-medium">Mentions:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {post.mentions.map((mention, index) => (
                    <Badge key={index} variant="outline" className="text-primary">
                      @{mention.mentionedUser.username}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Post Footer Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Like Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  disabled={!currentUserId || likeMutation.isPending}
                  className={`${post.userHasLiked ? 'text-destructive bg-destructive hover:bg-destructive' : 'hover:text-destructive hover:bg-destructive'} transition-colors`}
                >
                  <Heart className={`h-4 w-4 mr-1 ${post.userHasLiked ? 'fill-current' : ''}`} />
                  {post.likeCount}
                </Button>

                {/* Reply Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReply}
                  className="hover:text-primary hover:bg-primary transition-colors"
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Reply
                </Button>

                {/* Share Button */}
                <Button variant="ghost" size="sm" className="hover:text-success hover:bg-success transition-colors">
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>

              {/* Likes Display */}
              {post.likes && post.likes.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLikes(!showLikes)}
                    className="text-sm text-muted-foreground hover:text-muted-foreground"
                  >
                    {showLikes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    View likes
                  </Button>
                </div>
              )}
            </div>

            {/* Expanded Likes */}
            {showLikes && post.likes && post.likes.length > 0 && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-2">Liked by:</p>
                <div className="flex flex-wrap gap-2">
                  {post.likes.map((like) => (
                    <div key={like.id} className="flex items-center space-x-1 bg-card px-2 py-1 rounded-full border">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={like.user.avatarUrl} alt={like.user.username} />
                        <AvatarFallback className="text-xs">
                          {like.user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{like.user.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}