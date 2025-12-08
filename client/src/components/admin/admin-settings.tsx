import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PlatformSettings {
  platformName: string;
  defaultCurrency: string;
}

interface ForumSettings {
  allowGuestPosting: boolean;
  autoModerateNewPosts: boolean;
}

export function AdminSettings() {
  const { toast } = useToast();

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    platformName: 'PriceCompare Community',
    defaultCurrency: 'usd',
  });

  const [forumSettings, setForumSettings] = useState<ForumSettings>({
    allowGuestPosting: false,
    autoModerateNewPosts: false,
  });

  const [originalPlatformSettings, setOriginalPlatformSettings] =
    useState<PlatformSettings>(platformSettings);
  const [originalForumSettings, setOriginalForumSettings] = useState<ForumSettings>(forumSettings);

  const hasPlatformChanges =
    JSON.stringify(platformSettings) !== JSON.stringify(originalPlatformSettings);
  const hasForumChanges = JSON.stringify(forumSettings) !== JSON.stringify(originalForumSettings);

  const savePlatformSettingsMutation = useMutation({
    mutationFn: async (settings: PlatformSettings) => {
      return apiRequest('/api/admin/settings/platform', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      setOriginalPlatformSettings(platformSettings);
      toast({ title: 'Platform settings saved successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to save platform settings', variant: 'destructive' });
    },
  });

  const saveForumSettingsMutation = useMutation({
    mutationFn: async (settings: ForumSettings) => {
      return apiRequest('/api/admin/settings/forum', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      setOriginalForumSettings(forumSettings);
      toast({ title: 'Forum settings saved successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to save forum settings', variant: 'destructive' });
    },
  });

  const handleSavePlatformSettings = () => {
    savePlatformSettingsMutation.mutate(platformSettings);
  };

  const handleResetPlatformSettings = () => {
    setPlatformSettings(originalPlatformSettings);
    toast({ title: 'Platform settings reset', description: 'Changes have been discarded' });
  };

  const handleSaveForumSettings = () => {
    saveForumSettingsMutation.mutate(forumSettings);
  };

  const handleResetForumSettings = () => {
    setForumSettings(originalForumSettings);
    toast({ title: 'Forum settings reset', description: 'Changes have been discarded' });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Platform Settings</span>
            {hasPlatformChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Configure main platform settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input
              id="platform-name"
              value={platformSettings.platformName}
              onChange={(e) =>
                setPlatformSettings((prev) => ({ ...prev, platformName: e.target.value }))
              }
              placeholder="Enter platform name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-currency">Default Currency</Label>
            <Select
              value={platformSettings.defaultCurrency}
              onValueChange={(value) =>
                setPlatformSettings((prev) => ({ ...prev, defaultCurrency: value }))
              }
            >
              <SelectTrigger id="default-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD ($)</SelectItem>
                <SelectItem value="eur">EUR (€)</SelectItem>
                <SelectItem value="gbp">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSavePlatformSettings}
              disabled={!hasPlatformChanges || savePlatformSettingsMutation.isPending}
            >
              {savePlatformSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetPlatformSettings}
              disabled={!hasPlatformChanges}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Forum Settings</span>
            {hasForumChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Configure forum-specific settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allow-guest-posting">Allow Guest Posting</Label>
            <Select
              value={forumSettings.allowGuestPosting.toString()}
              onValueChange={(value) =>
                setForumSettings((prev) => ({ ...prev, allowGuestPosting: value === 'true' }))
              }
            >
              <SelectTrigger id="allow-guest-posting">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-moderate-posts">Auto-moderate New Posts</Label>
            <Select
              value={forumSettings.autoModerateNewPosts.toString()}
              onValueChange={(value) =>
                setForumSettings((prev) => ({ ...prev, autoModerateNewPosts: value === 'true' }))
              }
            >
              <SelectTrigger id="auto-moderate-posts">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveForumSettings}
              disabled={!hasForumChanges || saveForumSettingsMutation.isPending}
            >
              {saveForumSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetForumSettings}
              disabled={!hasForumChanges}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
