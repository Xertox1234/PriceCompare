import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Users } from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuspended?: boolean;
  reputation: number;
  createdAt: string;
}

interface AdminUserManagementProps {
  users: User[];
  isLoading: boolean;
}

export function AdminUserManagement({ users, isLoading }: AdminUserManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User role updated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to update user role', variant: 'destructive' });
    },
  });

  const handleUpdateUserRole = (userId: number, role: string) => {
    updateUserRoleMutation.mutate({ userId, role });
  };

  const updateUserSuspensionMutation = useMutation({
    mutationFn: async ({ userId, isSuspended }: { userId: number; isSuspended: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}/suspension`, {
        method: 'PATCH',
        body: JSON.stringify({
          isSuspended,
          reason: isSuspended ? 'Suspended by administrator' : undefined,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUser(null);
      toast({ title: 'User status updated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to update user status', variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>Manage user roles and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <div>Loading users...</div>
          ) : Array.isArray(users) && users.length > 0 ? (
            users.map((user: User) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium">{user.username}</h3>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                    <p className="text-muted-foreground text-xs">
                      Reputation: {user.reputation} • Joined:{' '}
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    data-testid={`admin-user-view-${user.id}`}
                  >
                    View
                  </Button>
                  <Select
                    value={user.role}
                    onValueChange={(role) => handleUpdateUserRole(user.id, role)}
                  >
                    <SelectTrigger className="w-32" aria-label={`Role for ${user.username}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {user.isSuspended ? <Badge variant="destructive">Suspended</Badge> : null}
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-center">No users found</div>
          )}
        </div>

        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>View user info and take actions</DialogDescription>
            </DialogHeader>

            {selectedUser ? (
              <div className="space-y-3">
                <div>
                  <div className="font-medium">{selectedUser.username}</div>
                  <div className="text-muted-foreground text-sm">{selectedUser.email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Role: {selectedUser.role}</Badge>
                  <Badge variant={selectedUser.isActive ? 'default' : 'secondary'}>
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {selectedUser.isSuspended ? <Badge variant="destructive">Suspended</Badge> : null}
                </div>
                <div className="text-muted-foreground text-sm">
                  Reputation: {selectedUser.reputation} • Joined:{' '}
                  {new Date(selectedUser.createdAt).toLocaleDateString()}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              {selectedUser && selectedUser.role !== 'admin' ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleUpdateUserRole(selectedUser.id, 'admin')}
                >
                  Make Admin
                </Button>
              ) : null}

              {selectedUser ? (
                <Button
                  type="button"
                  variant={selectedUser.isSuspended ? 'secondary' : 'destructive'}
                  onClick={() =>
                    updateUserSuspensionMutation.mutate({
                      userId: selectedUser.id,
                      isSuspended: !selectedUser.isSuspended,
                    })
                  }
                  disabled={updateUserSuspensionMutation.isPending}
                  data-testid={`admin-user-toggle-suspension-${selectedUser.id}`}
                >
                  {selectedUser.isSuspended ? 'Reinstate User' : 'Suspend User'}
                </Button>
              ) : null}

              <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
