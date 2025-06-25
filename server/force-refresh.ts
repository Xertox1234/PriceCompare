// Force refresh user session - temporary utility
import { Request, Response } from 'express';
import { findUserById } from './auth';

export async function forceRefreshUserRole(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = (req.user as any).id;
  console.log('Refreshing user data for ID:', userId);
  
  const freshUser = await findUserById(userId);
  console.log('Fresh user from DB:', freshUser);
  
  if (freshUser) {
    req.user = freshUser;
    console.log('Updated session user:', req.user);
    
    res.json({
      success: true,
      user: {
        id: freshUser.id,
        username: freshUser.username,
        email: freshUser.email,
        role: freshUser.role || 'user'
      }
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
}