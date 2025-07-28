import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bell, Heart, MessageSquare, Trophy, UserPlus, Flag, 
  Mail, CheckCheck, X
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  relatedUser?: {
    id: number;
    username: string;
    avatarUrl?: string;
  };
  relatedPost?: {
    id: number;
    topicId: number;
  };
  relatedTopic?: {
    id: number;
    title: string;
  };
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<Notification[]> => {
      const response = await apiRequest('/api/notifications');
      return response || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async (): Promise<number> => {
      const response = await apiRequest('/api/notifications?unreadOnly=true');
      return response?.length || 0;
    },
    refetchInterval: 10000, // Check unread count every 10 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds?: number[]) => {
      return apiRequest('/api/notifications/mark-read', {
        method: 'PUT',
        body: JSON.stringify({ notificationIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'mention':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'reply':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'badge':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'follow':
        return <UserPlus className="h-4 w-4 text-purple-500" />;
      case 'private_message':
        return <Mail className="h-4 w-4 text-indigo-500" />;
      case 'moderation':
        return <Flag className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'like':
        return 'bg-red-50 border-red-200';
      case 'mention':
        return 'bg-blue-50 border-blue-200';
      case 'reply':
        return 'bg-green-50 border-green-200';
      case 'badge':
        return 'bg-yellow-50 border-yellow-200';
      case 'follow':
        return 'bg-purple-50 border-purple-200';
      case 'private_message':
        return 'bg-indigo-50 border-indigo-200';
      case 'moderation':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications
      .filter(n => !n.isRead)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      markAsReadMutation.mutate(unreadIds);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsReadMutation.mutate([notification.id]);
    }

    // Navigate to related content
    if (notification.relatedPost && notification.relatedTopic) {
      // Navigate to post
      console.log(`Navigate to topic ${notification.relatedTopic.id}, post ${notification.relatedPost.id}`);
    } else if (notification.relatedTopic) {
      // Navigate to topic
      console.log(`Navigate to topic ${notification.relatedTopic.id}`);
    }

    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    disabled={markAsReadMutation.isPending}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex space-x-3">
                        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`
                        p-4 cursor-pointer transition-colors hover:bg-gray-50
                        ${!notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                        ${getNotificationColor(notification.type)}
                      `}
                    >
                      <div className="flex space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {notification.relatedUser ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage 
                                src={notification.relatedUser.avatarUrl} 
                                alt={notification.relatedUser.username} 
                              />
                              <AvatarFallback className="text-xs">
                                {notification.relatedUser.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                              {getNotificationIcon(notification.type)}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {notification.content}
                              </p>
                              {notification.relatedTopic && (
                                <p className="text-xs text-blue-600 mt-1 truncate">
                                  in "{notification.relatedTopic.title}"
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-2">
                              {getNotificationIcon(notification.type)}
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt))} ago
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-gray-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-center text-blue-600 hover:text-blue-700"
                >
                  View all notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}