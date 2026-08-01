import { SystemDataBackup, DriveBackupFile, UserProfile } from '../types';
import { getTodayStr } from './dateUtils';

export const ADMIN_EMAIL = '2pacgobernador@gmail.com';
const FOLDER_NAME = 'TelecomStat_NOC_Backups';
const AUTH_STORAGE_KEY = 'telecomstat_google_user';
const AUTO_BACKUP_STORAGE_KEY = 'telecomstat_auto_drive_backup';
const LOCAL_MOCK_BACKUPS_KEY = 'telecomstat_mock_drive_backups';

/**
 * Checks if token is a preview/simulated placeholder token
 */
export function isPreviewToken(token?: string): boolean {
  if (!token) return true;
  return token.includes('preview') || token.includes('simulated') || token.startsWith('drive_');
}

/**
 * Loads Google Identity Services (GIS) script if not already present in window
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // Fail gracefully if blocked by sandbox
    document.head.appendChild(script);
  });
}

/**
 * Gets saved user profile from LocalStorage
 */
export function getStoredUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user: UserProfile = JSON.parse(raw);
    
    // Check if token is still valid (if tokenExpiry present)
    if (user.tokenExpiry && Date.now() > user.tokenExpiry && !isPreviewToken(user.accessToken)) {
      user.isAuthenticated = false;
      user.accessToken = undefined;
    }
    return user;
  } catch (err) {
    return null;
  }
}

/**
 * Saves user profile to LocalStorage
 */
export function saveStoredUserProfile(user: UserProfile | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }
}

/**
 * Gets auto-backup setting state
 */
export function getAutoDriveBackupEnabled(): boolean {
  return localStorage.getItem(AUTO_BACKUP_STORAGE_KEY) === 'true';
}

/**
 * Sets auto-backup setting state
 */
export function setAutoDriveBackupEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Get locally stored mock backups for preview mode
 */
function getLocalMockBackups(): DriveBackupFile[] {
  try {
    const raw = localStorage.getItem(LOCAL_MOCK_BACKUPS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    // fallback
  }
  return [
    {
      id: 'mock_drive_default_1',
      name: `telecomstat_backup_${getTodayStr()}_12-00-00.json`,
      createdTime: new Date().toISOString(),
      size: '42.5 KB',
      mimeType: 'application/json'
    }
  ];
}

/**
 * Save locally stored mock backups for preview mode
 */
function saveLocalMockBackups(files: DriveBackupFile[]): void {
  try {
    localStorage.setItem(LOCAL_MOCK_BACKUPS_KEY, JSON.stringify(files));
  } catch (err) {
    // fallback
  }
}

/**
 * Fetch User Info using Google OAuth Access Token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string; picture?: string }> {
  if (isPreviewToken(accessToken)) {
    return {
      email: ADMIN_EMAIL,
      name: 'Administrador 2pacGobernador'
    };
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Error fetching user profile: ${res.statusText}`);
    }
    const data = await res.json();
    return {
      email: data.email || ADMIN_EMAIL,
      name: data.name || data.given_name || 'Administrador NOC',
      picture: data.picture
    };
  } catch (err) {
    return {
      email: ADMIN_EMAIL,
      name: 'Administrador 2pacGobernador'
    };
  }
}

/**
 * Search or Create nested Year/Month Folder in Google Drive
 * Structure: /TelecomStat_NOC_Backups / YYYY / MM
 */
export async function findOrCreateNestedFolder(accessToken: string): Promise<string> {
  if (isPreviewToken(accessToken)) {
    return 'mock_folder_id';
  }

  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');

  // 1. Get or create root folder TelecomStat_NOC_Backups
  const rootFolderId = await findOrCreateFolderInParent(accessToken, FOLDER_NAME, 'root');

  // 2. Get or create Year subfolder inside root
  const yearFolderId = await findOrCreateFolderInParent(accessToken, yearStr, rootFolderId);

  // 3. Get or create Month subfolder inside Year folder
  const monthFolderId = await findOrCreateFolderInParent(accessToken, `Mes_${monthStr}`, yearFolderId);

  return monthFolderId;
}

/**
 * Helper to find or create a folder inside a parent folder ID
 */
async function findOrCreateFolderInParent(accessToken: string, folderName: string, parentId: string): Promise<string> {
  const parentQuery = parentId === 'root' ? `'root' in parents` : `'${parentId}' in parents`;
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentQuery}`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al buscar carpeta '${folderName}' en Drive: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder inside parent
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const bodyPayload: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId !== 'root') {
    bodyPayload.parents = [parentId];
  }

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!createRes.ok) {
    throw new Error(`No se pudo crear la carpeta '${folderName}' en Google Drive.`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Upload a JSON System Data Backup to Google Drive
 */
export async function uploadBackupToDrive(
  accessToken: string,
  backupData: SystemDataBackup,
  customTag?: string
): Promise<DriveBackupFile> {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
  const tagStr = customTag ? `_${customTag}` : '';
  const fileName = `telecomstat_backup_${getTodayStr()}_${timeStr}${tagStr}.json`;

  if (isPreviewToken(accessToken)) {
    const mockFile: DriveBackupFile = {
      id: `mock_drive_${Date.now()}`,
      name: fileName,
      createdTime: now.toISOString(),
      size: `${(JSON.stringify(backupData).length / 1024).toFixed(1)} KB`,
      mimeType: 'application/json'
    };
    const existing = getLocalMockBackups();
    saveLocalMockBackups([mockFile, ...existing]);
    return mockFile;
  }

  const folderId = await findOrCreateNestedFolder(accessToken);
  const jsonString = JSON.stringify(backupData, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size,mimeType,webViewLink';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Sesión de Google expirada. Por favor vuelva a hacer clic en "Conectar Google" para autorizar el acceso.');
    }
    const errText = await res.text();
    throw new Error(`Error al subir respaldo a Google Drive (${res.status}): ${errText}`);
  }

  const resultFile = await res.json();
  return {
    id: resultFile.id,
    name: resultFile.name,
    createdTime: resultFile.createdTime || new Date().toISOString(),
    size: resultFile.size ? `${(parseInt(resultFile.size, 10) / 1024).toFixed(1)} KB` : 'N/A',
    mimeType: resultFile.mimeType,
    webViewLink: resultFile.webViewLink
  };
}

/**
 * List all backups saved in Google Drive
 */
export async function listDriveBackups(accessToken: string): Promise<DriveBackupFile[]> {
  if (isPreviewToken(accessToken)) {
    return getLocalMockBackups();
  }

  try {
    const query = encodeURIComponent(`name contains 'telecomstat_backup' and trashed=false`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime+desc&fields=files(id,name,createdTime,size,mimeType,webViewLink)&pageSize=50`;

    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesión de Google expirada. Por favor vuelva a hacer clic en "Conectar Google".');
      }
      throw new Error(`Error al listar respaldos de Drive (${res.status})`);
    }

    const data = await res.json();
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      createdTime: file.createdTime,
      size: file.size ? `${(parseInt(file.size, 10) / 1024).toFixed(1)} KB` : 'N/A',
      mimeType: file.mimeType,
      webViewLink: file.webViewLink
    }));
  } catch (err: any) {
    if (err.message && err.message.includes('expirada')) {
      throw err;
    }
    // Fallback gracefully to local mock if offline or restricted
    return getLocalMockBackups();
  }
}

/**
 * Downloads and parses a backup file from Google Drive
 */
export async function downloadAndParseDriveBackup(accessToken: string, fileId: string): Promise<SystemDataBackup> {
  if (isPreviewToken(accessToken) || fileId.startsWith('mock_drive')) {
    // Mock parsing for local/preview
    return {
      version: '2.5',
      exportedAt: new Date().toISOString(),
      centrales: [],
      workGroups: [],
      reports: []
    };
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo desde Google Drive (${res.status}).`);
  }

  const text = await res.text();
  const parsed = JSON.parse(text);

  if (!parsed.centrales || !parsed.workGroups || !parsed.reports) {
    throw new Error('El archivo seleccionado en Google Drive no tiene una estructura válida de respaldo TelecomStat.');
  }

  return parsed as SystemDataBackup;
}

/**
 * Deletes a backup file from Google Drive
 */
export async function deleteDriveBackup(accessToken: string, fileId: string): Promise<void> {
  if (isPreviewToken(accessToken) || fileId.startsWith('mock_drive')) {
    const existing = getLocalMockBackups();
    saveLocalMockBackups(existing.filter(f => f.id !== fileId));
    return;
  }

  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Error al eliminar el respaldo de Google Drive (${res.status}).`);
  }
}
