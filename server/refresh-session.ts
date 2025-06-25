// Utility to refresh user session data
import { Request } from 'express';
import { findUserById } from './auth';

export async function refreshUserSession(req: Request): Promise<void> {
  if (req.user && (req.user as any).id) {
    const userId = (req.user as any).id;
    const updatedUser = await findUserById(userId);
    if (updatedUser) {
      // Update the session with fresh user data
      req.user = updatedUser;
    }
  }
}