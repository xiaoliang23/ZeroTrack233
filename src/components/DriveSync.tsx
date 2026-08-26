import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, UploadCloud, DownloadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { Position } from '../types';

interface DriveSyncProps {
  positions: Position[];
  onRestore: (positions: Position[]) => void;
}

const CLIENT_ID = '190250352837-auvetui299gfiomio70au352bfd86f7j.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const DriveSync: React.FC<DriveSyncProps> = ({ positions, onRestore }) => {
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Wait for google library to load
    const initClient = () => {
      // @ts-ignore
      if (window.google?.accounts?.oauth2) {
        // @ts-ignore
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error !== undefined) {
              setStatus('error');
              setMessage('授权失败');
              return;
            }
            setAccessToken(response.access_token);
            setStatus('success');
            setMessage('已连接，请再次点击');
            setTimeout(() => setStatus('idle'), 3000);
          },
        });
        setTokenClient(client);
      } else {
        setTimeout(initClient, 1000);
      }
    };
    initClient();
  }, []);

  const requestAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  };

  const getDriveFileId = async (token: string): Promise<string | null> => {
    const q = encodeURIComponent("name='zerotrack_portfolio_backup.json' and trashed=false");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  const handleBackup = async () => {
    if (!accessToken) {
      requestAuth();
      return;
    }
    
    setStatus('syncing');
    setMessage('正在备份到 Drive...');
    
    try {
      const fileId = await getDriveFileId(accessToken);
      const metadata = {
        name: 'zerotrack_portfolio_backup.json',
        mimeType: 'application/json'
      };
      const fileContent = new Blob([JSON.stringify({ positions, updatedAt: new Date().toISOString() })], { type: 'application/json' });
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', fileContent);
      
      let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let method = 'POST';
      
      if (fileId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
        method = 'PATCH';
      }
      
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: form
      });
      
      if (!res.ok) throw new Error('Backup failed');
      
      setStatus('success');
      setMessage('备份成功');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('备份失败');
    }
  };

  const handleRestore = async () => {
    if (!accessToken) {
      requestAuth();
      return;
    }
    
    setStatus('syncing');
    setMessage('正在恢复...');
    
    try {
      const fileId = await getDriveFileId(accessToken);
      if (!fileId) {
        setStatus('error');
        setMessage('云端无备份');
        setTimeout(() => setStatus('idle'), 3000);
        return;
      }
      
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!res.ok) throw new Error('Restore failed');
      
      const data = await res.json();
      if (data.positions && Array.isArray(data.positions)) {
        onRestore(data.positions);
        setStatus('success');
        setMessage('恢复成功');
      } else {
        throw new Error('Invalid format');
      }
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('恢复失败');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex bg-theme-bg-elevated border border-theme-border rounded-lg overflow-hidden shadow-sm">
        <button
          onClick={handleBackup}
          className={`px-2 sm:px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition ${status === 'syncing' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-border text-theme-text-primary'}`}
          disabled={status === 'syncing'}
          title="备份到云端"
        >
          <UploadCloud size={14} className="text-indigo-400" />
          <span className="hidden lg:inline">云备份</span>
        </button>
        <div className="w-px bg-theme-border"></div>
        <button
          onClick={handleRestore}
          className={`px-2 sm:px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition ${status === 'syncing' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-border text-theme-text-primary'}`}
          disabled={status === 'syncing'}
          title="从云端恢复"
        >
          <DownloadCloud size={14} className="text-teal-400" />
          <span className="hidden lg:inline">云恢复</span>
        </button>
      </div>
      
      {status !== 'idle' && (
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] animate-fade-in bg-theme-bg-elevated border border-theme-border px-2 py-1 rounded-md whitespace-nowrap">
          {status === 'syncing' && <RefreshCw size={12} className="animate-spin text-indigo-400" />}
          {status === 'success' && <CheckCircle size={12} className="text-teal-400" />}
          {status === 'error' && <AlertCircle size={12} className="text-red-400" />}
          <span className={status === 'error' ? 'text-red-400' : status === 'success' ? 'text-teal-400' : 'text-theme-text-muted'}>
            {message}
          </span>
        </div>
      )}
    </div>
  );
};
