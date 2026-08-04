import { PortalUser, UserProfile } from '../types';
import { ADMIN_EMAIL } from './googleDriveService';

const PORTAL_USERS_KEY = 'telecomstat_portal_users_v2';
const ACTIVE_SESSION_KEY = 'telecomstat_active_portal_session';

export const DEFAULT_ADMIN_USER: PortalUser = {
  id: 'usr_admin_default',
  username: 'Admin',
  password: 'Rafael1974**',
  name: 'Administrador General',
  role: 'admin',
  permissions: ['report_analysis', 'ip_analysis', 'repairs_analysis'],
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z'
};

/**
 * Loads all portal users from LocalStorage.
 * Ensures the default Admin user always exists and has valid credentials.
 */
export function getPortalUsers(): PortalUser[] {
  try {
    const raw = localStorage.getItem(PORTAL_USERS_KEY);
    if (!raw) {
      const initialList = [DEFAULT_ADMIN_USER];
      savePortalUsers(initialList);
      return initialList;
    }
    const users: PortalUser[] = JSON.parse(raw);
    
    // Ensure default Admin user exists and has correct password 'Rafael1974**'
    const adminIndex = users.findIndex(u => u.username.toLowerCase() === 'admin');
    if (adminIndex === -1) {
      users.unshift(DEFAULT_ADMIN_USER);
      savePortalUsers(users);
    } else {
      // Keep Admin credentials and permissions updated
      users[adminIndex].password = 'Rafael1974**';
      users[adminIndex].active = true;
      users[adminIndex].role = 'admin';
      savePortalUsers(users);
    }
    return users;
  } catch (err) {
    console.error('Error loading portal users:', err);
    return [DEFAULT_ADMIN_USER];
  }
}

/**
 * Saves list of portal users to LocalStorage
 */
export function savePortalUsers(users: PortalUser[]): void {
  try {
    localStorage.setItem(PORTAL_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving portal users:', err);
  }
}

/**
 * Validates login credentials against stored portal users
 */
export function authenticatePortalUser(usernameInput: string, passwordInput: string): PortalUser | null {
  const users = getPortalUsers();
  const cleanUsername = usernameInput.trim().toLowerCase();
  
  const user = users.find(u => u.username.toLowerCase() === cleanUsername && u.active);
  if (!user) return null;

  if (user.password === passwordInput.trim()) {
    // Update lastLogin timestamp
    user.lastLogin = new Date().toISOString();
    savePortalUsers(users);
    return user;
  }

  return null;
}

/**
 * Saves active portal session
 */
export function saveActivePortalSession(user: PortalUser | null, driveAccessToken?: string): UserProfile | null {
  if (!user) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return null;
  }

  const profile: UserProfile = {
    email: ADMIN_EMAIL,
    name: user.name,
    role: user.role === 'admin' ? 'admin' : 'user',
    isAuthenticated: true,
    accessToken: driveAccessToken || 'drive_preview_access_token',
    tokenExpiry: Date.now() + 3600 * 1000 * 24,
    portalUsername: user.username
  };

  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
      portalUser: user,
      userProfile: profile
    }));
  } catch (err) {
    console.error('Error saving active portal session:', err);
  }

  return profile;
}

/**
 * Gets active portal session
 */
export function getActivePortalSession(): { portalUser: PortalUser; userProfile: UserProfile } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Clears active portal session
 */
export function clearActivePortalSession(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/**
 * Add a new user (Admin function)
 */
export function createPortalUser(newUser: Omit<PortalUser, 'id' | 'createdAt'>): PortalUser {
  const users = getPortalUsers();
  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  const created: PortalUser = {
    ...newUser,
    id,
    createdAt: new Date().toISOString()
  };

  users.push(created);
  savePortalUsers(users);
  return created;
}

/**
 * Update an existing user (Admin function)
 */
export function updatePortalUser(id: string, updates: Partial<PortalUser>): void {
  const users = getPortalUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    savePortalUsers(users);
  }
}

/**
 * Delete a user (Admin function)
 */
export function deletePortalUser(id: string): boolean {
  const users = getPortalUsers();
  const user = users.find(u => u.id === id);
  if (user && user.username.toLowerCase() === 'admin') {
    // Cannot delete primary admin
    return false;
  }
  const filtered = users.filter(u => u.id !== id);
  savePortalUsers(filtered);
  return true;
}
