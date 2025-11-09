import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  User, Edit3, MapPin, Globe, Calendar, MessageSquare, Heart, 
  Award, Trophy, Star, Bell, Settings, Mail
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  trustLevel: number;
  reputation: number;
  postCount: number;
  topicCount: number;
  likesReceived: number;
  likesGiven: number;
  daysVisited: number;
  lastSeenAt: string;
  createdAt: string;
  badges?: Array<{
    id: number;
    name: string;
    description: string;
    icon: string;
    color: string;
    type: string;
    grantedAt: string;
  }>;
  unreadNotifications?: number;
  trustLevelName: string;
}

interface UserActivity {
  recentPosts: Array<{
    id: number;
    content: string;
    topicTitle: string;
    createdAt: string;
  }>;
  recentTopics: Array<{
    id: number;
    title: string;
    postCount: number;
    createdAt: string;
  }>;
}

interface EnhancedUserProfileProps {
  userId: number;
  isOwnProfile?: boolean;
}

export function EnhancedUserProfile({ userId, isOwnProfile = false }: EnhancedUserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async (): Promise<UserProfile> => {
      const response = await apiRequest(`/api/users/${userId}/profile`);
      return response;
    },
  });

  const { data: activity } = useQuery({
    queryKey: ['user-activity', userId],
    queryFn: async (): Promise<UserActivity> => {
      const response = await apiRequest(`/api/users/${userId}/activity`);
      return response;
    },
    enabled: !!profile,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      return apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      setIsEditing(false);
    },
  });

  const getTrustLevelColor = (level: number) => {
    const colors = ['gray', 'blue', 'green', 'yellow', 'purple'];
    return colors[level] || 'gray';
  };

  const getTrustLevelIcon = (level: number) => {
    if (level >= 4) return <Trophy className="h-4 w-4" />;
    if (level >= 3) return <Award className="h-4 w-4" />;
    if (level >= 2) return <Star className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-4"></div>
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">User not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-10"></div>
        <CardContent className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold">{profile.username}</h1>
                  <Badge 
                    variant="outline" 
                    className={`bg-${getTrustLevelColor(profile.trustLevel)}-100 text-${getTrustLevelColor(profile.trustLevel)}-800 border-${getTrustLevelColor(profile.trustLevel)}-200`}
                  >
                    {getTrustLevelIcon(profile.trustLevel)}
                    <span className="ml-1">{profile.trustLevelName}</span>
                  </Badge>
                  {profile.unreadNotifications && profile.unreadNotifications > 0 && (
                    <Badge variant="destructive" className="flex items-center space-x-1">
                      <Bell className="h-3 w-3" />
                      <span>{profile.unreadNotifications}</span>
                    </Badge>
                  )}
                </div>
                
                {profile.bio && (
                  <p className="text-muted-foreground max-w-md">{profile.bio}</p>
                )}
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {profile.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center space-x-1">
                      <Globe className="h-4 w-4" />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" 
                         className="text-primary hover:underline">
                        Website
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {formatDistanceToNow(new Date(profile.createdAt))} ago</span>
                  </div>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Bio</label>
                      <Textarea
                        placeholder="Tell us about yourself..."
                        value={editData.bio || profile.bio || ''}
                        onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Location</label>
                      <Input
                        placeholder="Where are you based?"
                        value={editData.location || profile.location || ''}
                        onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Website</label>
                      <Input
                        placeholder="https://your-website.com"
                        value={editData.website || profile.website || ''}
                        onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Avatar URL</label>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={editData.avatarUrl || profile.avatarUrl || ''}
                        onChange={(e) => setEditData({ ...editData, avatarUrl: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold text-primary">{profile.postCount}</span>
          </div>
          <p className="text-sm text-muted-foreground">Posts</p>
        </Card>
        
        <Card className="text-center p-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Heart className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-destructive">{profile.likesReceived}</span>
          </div>
          <p className="text-sm text-muted-foreground">Likes Received</p>
        </Card>
        
        <Card className="text-center p-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Award className="h-5 w-5 text-warning" />
            <span className="text-2xl font-bold text-warning">{profile.reputation}</span>
          </div>
          <p className="text-sm text-muted-foreground">Reputation</p>
        </Card>
        
        <Card className="text-center p-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Calendar className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-success">{profile.daysVisited}</span>
          </div>
          <p className="text-sm text-muted-foreground">Days Visited</p>
        </Card>
      </div>

      {/* Badges */}
      {profile.badges && profile.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>Badges</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.badges.map((badge) => (
                <div key={badge.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div 
                    className="p-2 rounded-full"
                    style={{ backgroundColor: badge.color + '20', color: badge.color }}
                  >
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{badge.name}</p>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Earned {formatDistanceToNow(new Date(badge.grantedAt))} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Tabs */}
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts">Recent Posts</TabsTrigger>
          <TabsTrigger value="topics">Recent Topics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="posts" className="space-y-4">
          {activity?.recentPosts?.length ? (
            activity.recentPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-primary hover:underline cursor-pointer">
                      {post.topicTitle}
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt))} ago
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2">{post.content}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No recent posts
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="topics" className="space-y-4">
          {activity?.recentTopics?.length ? (
            activity.recentTopics.map((topic) => (
              <Card key={topic.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-primary hover:underline cursor-pointer">
                      {topic.title}
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(topic.createdAt))} ago
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{topic.postCount} replies</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No recent topics
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {!isOwnProfile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </Button>
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                View Posts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}