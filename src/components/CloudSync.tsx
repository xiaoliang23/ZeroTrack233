import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Cloud, 
  CloudOff, 
  Loader2, 
  LogOut, 
  UploadCloud, 
  DownloadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  UserCheck,
  GitBranch,
  ExternalLink,
  Key,
  FolderGit2,
  FileJson,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Save,
  User as UserIcon,
  Smartphone,
  Monitor,
  Check
} from 'lucide-react';

function GithubIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

import { 
  verifyGitHubToken, 
  syncGistSave, 
  syncGistPull, 
  pushToGitHubRepo, 
  pullFromGitHubRepo, 
  GitHubUser, 
  GitHubGistInfo, 
  GitHubSyncPayload 
} from '../utils/githubSync';

interface CloudSyncProps {
  data: {
    watchlist: string[];
    positions: any[];
    priceAlerts: any[];
    theme: string;
    isUpRed: boolean;
    pnlLossAlertEnabled?: boolean;
    pnlLossAlertThreshold?: number;
    _ownerUid?: string | null;
  };
  onRemoteUpdate: (data: any) => void;
}

export interface CloudUser {
  email: string;
  uid: string;
  token?: string;
  displayName?: string;
  isFirebase?: boolean;
}

const GITHUB_CONFIG_KEY = 'stock_app_github_config_v1';
const CLOUD_AUTH_KEY = 'stock_app_cloud_auth_v2';
const GUEST_DATA_KEY = 'zerotrack_guest_stocks';

// Clean default template for brand new accounts
const CLEAN_DEFAULT_DATA = {
  watchlist: ["AAPL", "NVDA", "TSLA", "0700.HK"],
  positions: [
    { symbol: "AAPL", quantity: 10, buyPrice: 172.5, dividends: 12.5 },
    { symbol: "NVDA", quantity: 15, buyPrice: 820.0, dividends: 0.0 }
  ],
  priceAlerts: [],
  theme: 'dark',
  isUpRed: true,
  pnlLossAlertEnabled: true,
  pnlLossAlertThreshold: 10
};

export default function CloudSync({ data, onRemoteUpdate }: CloudSyncProps) {
  // Provider Mode: 'cloud' (Universal Multi-Device Cloud Sync) or 'github'
  const [providerMode, setProviderMode] = useState<'cloud' | 'github'>('cloud');

  // Unified Multi-Device Cloud User State
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(() => {
    try {
      const saved = localStorage.getItem(CLOUD_AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Computed Active User
  const activeUser: CloudUser | null = cloudUser 
    ? cloudUser 
    : (firebaseUser ? { email: firebaseUser.email || 'Google User', uid: firebaseUser.uid, isFirebase: true } : null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-Sync Toggle State (Default true for multi-device sync)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('zerotrack_auto_sync_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('zerotrack_auto_sync_enabled', JSON.stringify(enabled));
    if (enabled) {
      setSuccessMsg('已开启后台多端实时同步功能');
    } else {
      setSuccessMsg('已关闭自动同步，改动后请点击“保存当前持仓”');
    }
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // GitHub Sync State
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubMode, setGithubMode] = useState<'gist' | 'repo'>('gist');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoPath, setRepoPath] = useState('stock_trading_data.json');
  const [gistInfo, setGistInfo] = useState<GitHubGistInfo | null>(null);
  const [autoSyncGithub, setAutoSyncGithub] = useState(true);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSyncStatus, setGhSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [ghLastSynced, setGhLastSynced] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [ghHasPulledInitial, setGhHasPulledInitial] = useState(false);

  // Keep a ref to latest data to avoid stale closures
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const isSyncingFromCloudRef = useRef(false);
  const loadedUidRef = useRef<string | null>(null);

  // Helper to fetch user data from server API & Firestore
  const fetchCloudUserData = async (targetEmail: string, userToken?: string) => {
    if (!targetEmail) return null;
    isSyncingFromCloudRef.current = true;
    setSyncStatus('syncing');

    let pulledData: any = null;

    // 1. Fetch from Express Central Cloud Database API
    try {
      const headers: Record<string, string> = {};
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      const res = await fetch(`/api/auth/user-data?email=${encodeURIComponent(targetEmail)}`, {
        headers
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          pulledData = json.data;
          if (json.updatedAt) {
            setLastSyncedTime(new Date(json.updatedAt).toLocaleTimeString('zh-CN'));
          }
        }
      }
    } catch (err) {
      console.warn('Central API fetch failed, trying Firestore fallback:', err);
    }

    // 2. Fallback or augment with Firestore if available
    if (!pulledData && auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          pulledData = docSnap.data();
          if (pulledData.updatedAt) {
            setLastSyncedTime(new Date(pulledData.updatedAt).toLocaleTimeString('zh-CN'));
          }
        }
      } catch (err) {
        console.warn('Firestore fetch notice:', err);
      }
    }

    if (pulledData) {
      onRemoteUpdate({ ...pulledData, _ownerUid: targetEmail });
      setSyncStatus('synced');
    } else {
      // First time user on cloud database: push current clean default data
      const initData = {
        ...CLEAN_DEFAULT_DATA,
        updatedAt: new Date().toISOString()
      };
      onRemoteUpdate({ ...initData, _ownerUid: targetEmail });
      saveCloudUserData(targetEmail, initData, userToken).catch(() => {});
      setSyncStatus('synced');
      setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
    }

    loadedUidRef.current = targetEmail;
    setTimeout(() => {
      isSyncingFromCloudRef.current = false;
    }, 400);

    return pulledData;
  };

  // Helper to save user data to server API & Firestore
  const saveCloudUserData = async (targetEmail: string, payload: any, userToken?: string) => {
    if (!targetEmail || !payload) return;
    setSyncStatus('syncing');

    const { _ownerUid, ...cleanData } = payload;
    const dataToSave = {
      ...cleanData,
      updatedAt: new Date().toISOString()
    };

    let serverSaved = false;

    // 1. Save to Central Cloud Database API
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      const res = await fetch('/api/auth/user-data', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: targetEmail, data: dataToSave })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          serverSaved = true;
          setLastSyncedTime(new Date(json.updatedAt || Date.now()).toLocaleTimeString('zh-CN'));
        }
      }
    } catch (err) {
      console.warn('Central API save failed:', err);
    }

    // 2. Also save to Firestore if user is authenticated with Firebase
    if (auth?.currentUser) {
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(docRef, dataToSave);
        serverSaved = true;
      } catch (err) {
        console.warn('Firestore setDoc notice:', err);
      }
    }

    if (serverSaved) {
      setSyncStatus('synced');
    } else {
      setSyncStatus('error');
    }
  };

  // 1. Initial Mount: Restore Cloud User or Guest Data
  useEffect(() => {
    if (cloudUser && cloudUser.email) {
      fetchCloudUserData(cloudUser.email, cloudUser.token);
    } else {
      // Guest restore
      const savedGuest = localStorage.getItem(GUEST_DATA_KEY);
      if (savedGuest) {
        try {
          const parsed = JSON.parse(savedGuest);
          onRemoteUpdate({ ...parsed, _ownerUid: 'guest' });
        } catch {
          onRemoteUpdate({ ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' });
        }
      } else {
        onRemoteUpdate({ ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' });
      }
      loadedUidRef.current = 'guest';
    }
  }, []);

  // 2. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u && !cloudUser) {
        const userEmail = u.email || `firebase_${u.uid.substring(0, 8)}@zerotrack.app`;
        const newUser: CloudUser = {
          email: userEmail,
          uid: u.uid,
          isFirebase: true,
          displayName: u.displayName || userEmail.split('@')[0]
        };
        setCloudUser(newUser);
        localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(newUser));
        fetchCloudUserData(userEmail);
      }
    });

    return () => unsubscribe();
  }, [cloudUser]);

  // 3. Auto-Sync to Cloud when data changes (debounced)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    if (!activeUser || !activeUser.email) {
      // Auto-save guest data locally
      if (data._ownerUid === 'guest') {
        const { _ownerUid, ...cleanData } = data;
        localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(cleanData));
      }
      return;
    }

    if (isSyncingFromCloudRef.current || loadedUidRef.current !== activeUser.email) return;
    if (data._ownerUid && data._ownerUid !== activeUser.email) return;

    const timer = setTimeout(() => {
      saveCloudUserData(activeUser.email, data, activeUser.token);
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, activeUser?.email, autoSyncEnabled]);

  // Load saved GitHub config on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
      let tokenToVerify = ((import.meta as any).env?.VITE_GITHUB_TOKEN as string) || '';
      let savedMode: 'gist' | 'repo' = 'gist';
      let savedOwner = '';
      let savedRepo = '';
      let savedPath = 'stock_trading_data.json';
      let savedGist: GitHubGistInfo | null = null;
      let savedAutoSync = true;
      
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          tokenToVerify = parsed.token;
          if (parsed.mode) { setGithubMode(parsed.mode); savedMode = parsed.mode; }
          if (parsed.repoOwner) { setRepoOwner(parsed.repoOwner); savedOwner = parsed.repoOwner; }
          if (parsed.repoName) { setRepoName(parsed.repoName); savedRepo = parsed.repoName; }
          if (parsed.repoPath) { setRepoPath(parsed.repoPath); savedPath = parsed.repoPath; }
          if (parsed.gistInfo) { setGistInfo(parsed.gistInfo); savedGist = parsed.gistInfo; }
          if (typeof parsed.autoSync === 'boolean') { setAutoSyncGithub(parsed.autoSync); savedAutoSync = parsed.autoSync; }
        }
      }

      setGithubToken(tokenToVerify);
      if (tokenToVerify) {
        verifyGitHubToken(tokenToVerify)
          .then(async (u) => {
            setGithubUser(u);
            const owner = savedOwner || u.login;
            if (!repoOwner) setRepoOwner(owner);
            setGhSyncStatus('synced');

            if (!activeUser) {
              try {
                let pulledData: GitHubSyncPayload | null = null;
                if (savedMode === 'gist') {
                  const res = await syncGistPull(tokenToVerify, savedGist?.id);
                  pulledData = res.data;
                  setGistInfo(res.gistInfo);
                } else if (owner && savedRepo && savedPath) {
                  const res = await pullFromGitHubRepo(tokenToVerify, owner, savedRepo, savedPath);
                  pulledData = res.data;
                }

                if (pulledData) {
                  onRemoteUpdate(pulledData);
                  setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
                }
              } catch (err) {
                console.log('GitHub initial pull skipped:', err);
              }
            }
          })
          .catch(() => {
            setGhSyncStatus('idle');
          })
          .finally(() => {
            setGhHasPulledInitial(true);
          });
      } else {
        setGhHasPulledInitial(true);
      }
    } catch (e) {
      console.error('Failed to parse saved github config', e);
      setGhHasPulledInitial(true);
    }
  }, []);

  // Save GitHub config
  const saveGitHubConfig = (
    token: string,
    mode: 'gist' | 'repo',
    owner: string,
    repo: string,
    path: string,
    gist: GitHubGistInfo | null,
    auto: boolean
  ) => {
    localStorage.setItem(
      GITHUB_CONFIG_KEY,
      JSON.stringify({
        token,
        mode,
        repoOwner: owner,
        repoName: repo,
        repoPath: path,
        gistInfo: gist,
        autoSync: auto,
      })
    );
  };

  // Close popover on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auth Handler for Universal Cloud Account
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('请输入邮箱和密码');
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'login') {
        // 1. Call Central API Login
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
        });

        const json = await res.json();

        if (res.ok && json.success) {
          const userObj: CloudUser = {
            email: cleanEmail,
            uid: `user_${json.user?.id || 'id'}`,
            token: json.token,
            displayName: cleanEmail.split('@')[0]
          };
          setCloudUser(userObj);
          localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(userObj));
          
          // Also attempt Firebase Auth in background if configured
          try {
            await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          } catch {}

          // Pull user data from cloud
          await fetchCloudUserData(cleanEmail, json.token);

          setSuccessMsg('登录成功！电脑与手机端全平台数据已实时打通');
          setTimeout(() => {
            setIsOpen(false);
            setSuccessMsg('');
          }, 1200);
        } else {
          setError(json.error || '登录失败，请检查账号和密码');
        }
      } else {
        // Register Tab
        if (cleanPassword !== confirmPassword.trim()) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
        });

        const json = await res.json();

        if (res.ok && json.success) {
          const userObj: CloudUser = {
            email: cleanEmail,
            uid: `user_${json.user?.id || 'id'}`,
            token: json.token,
            displayName: cleanEmail.split('@')[0]
          };
          setCloudUser(userObj);
          localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(userObj));

          // Also attempt Firebase register in background
          try {
            await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          } catch {}

          // Initialize cloud data with current local data or defaults
          await saveCloudUserData(cleanEmail, dataRef.current || CLEAN_DEFAULT_DATA, json.token);
          onRemoteUpdate({ ...(dataRef.current || CLEAN_DEFAULT_DATA), _ownerUid: cleanEmail });

          setSuccessMsg('注册成功！已开通全平台多端云同步');
          setTimeout(() => {
            setIsOpen(false);
            setSuccessMsg('');
          }, 1200);
        } else {
          setError(json.error || '注册失败，请稍后重试');
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || '网络连接异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanNewPwd = newPassword.trim();

    if (!cleanEmail) {
      setError('请输入要找回密码的邮箱地址');
      setLoading(false);
      return;
    }
    if (!cleanNewPwd || cleanNewPwd.length < 6) {
      setError('请输入至少 6 位的新密码');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, newPassword: cleanNewPwd })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const userObj: CloudUser = {
          email: cleanEmail,
          uid: `user_${json.user?.id || 'id'}`,
          token: json.token,
          displayName: cleanEmail.split('@')[0]
        };
        setCloudUser(userObj);
        localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(userObj));

        // Pull latest data
        await fetchCloudUserData(cleanEmail, json.token);

        setSuccessMsg('密码重置成功！已自动为您登录并恢复全平台持仓数据');
        setTimeout(() => {
          setPassword(cleanNewPwd);
          setNewPassword('');
          setIsOpen(false);
          setSuccessMsg('');
        }, 1500);
      } else {
        setError(json.error || '密码重置失败');
      }
    } catch (err: any) {
      setError('重置密码失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      if (u && u.email) {
        const userObj: CloudUser = {
          email: u.email,
          uid: u.uid,
          isFirebase: true,
          displayName: u.displayName || u.email.split('@')[0]
        };
        setCloudUser(userObj);
        localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(userObj));
        await fetchCloudUserData(u.email);
        setSuccessMsg(`Google 账号（${u.email}）已成功连接并全端同步！`);
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMsg('');
        }, 1200);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Google login cancelled by user');
      } else {
        console.warn('Google auth warning:', err);
        setError('Google 登录未完成或弹窗被拦截，请优先使用上方邮箱账号一键登录/注册');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Manual Save to Cloud
  const handleSaveData = async () => {
    if (!activeUser || !activeUser.email) return;
    setError('');
    setSuccessMsg('');
    await saveCloudUserData(activeUser.email, data, activeUser.token);
    setSuccessMsg('当前持仓与自选股数据已成功保存至云端，全平台已同步！');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Manual Pull from Cloud
  const handleManualPull = async () => {
    if (!activeUser || !activeUser.email) return;
    setError('');
    setSuccessMsg('');
    const pulled = await fetchCloudUserData(activeUser.email, activeUser.token);
    if (pulled) {
      setSuccessMsg(`成功从云端恢复数据！包含 ${pulled.watchlist?.length || 0} 只自选股、${pulled.positions?.length || 0} 个持仓仓位`);
    } else {
      setSuccessMsg('已检查云端，当前已是最新状态');
    }
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Save and Logout
  const handleSaveAndLogout = async () => {
    if (activeUser && activeUser.email) {
      await saveCloudUserData(activeUser.email, data, activeUser.token);
    }
    handleLogout();
  };

  // Logout
  const handleLogout = async () => {
    isSyncingFromCloudRef.current = true;
    try {
      if (firebaseUser) await signOut(auth);
    } catch {}
    setCloudUser(null);
    setFirebaseUser(null);
    loadedUidRef.current = null;
    localStorage.removeItem(CLOUD_AUTH_KEY);
    setSyncStatus('idle');
    setLastSyncedTime(null);

    // Reset state to guest stocks
    const savedGuest = localStorage.getItem(GUEST_DATA_KEY);
    let defaultData = { ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' };
    if (savedGuest) {
      try {
        defaultData = { ...JSON.parse(savedGuest), _ownerUid: 'guest' };
      } catch {}
    }
    onRemoteUpdate(defaultData);
    setSuccessMsg('已安全退出登录，当前已切换至独立离线视角');
    setTimeout(() => {
      isSyncingFromCloudRef.current = false;
      setSuccessMsg('');
    }, 1500);
  };

  // GitHub Handlers
  const handleVerifyGitHubToken = async () => {
    if (!githubToken.trim()) {
      setError('请先输入 GitHub Personal Access Token');
      return;
    }

    setGhLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const u = await verifyGitHubToken(githubToken);
      setGithubUser(u);
      
      const owner = repoOwner || u.login;
      if (!repoOwner) setRepoOwner(u.login);

      let pulledData: GitHubSyncPayload | null = null;
      let currentGist = gistInfo;

      if (githubMode === 'gist') {
        try {
          const res = await syncGistPull(githubToken, gistInfo?.id);
          pulledData = res.data;
          currentGist = res.gistInfo;
          setGistInfo(res.gistInfo);
        } catch {
          console.log('No existing Gist found yet, will create on sync');
        }
      } else if (owner && repoName && repoPath) {
        try {
          const res = await pullFromGitHubRepo(githubToken, owner, repoName, repoPath);
          pulledData = res.data;
        } catch {
          console.log('No existing Repo file found yet, will create on sync');
        }
      }

      if (pulledData) {
        onRemoteUpdate(pulledData);
        setSuccessMsg(`验证成功！已调取加载 GitHub @${u.login} 的自选股数据`);
        if (githubMode === 'gist') {
          saveGitHubConfig(githubToken, githubMode, owner, repoName, repoPath, currentGist, autoSyncGithub);
        } else if (owner && repoName && repoPath) {
          saveGitHubConfig(githubToken, githubMode, owner, repoName, repoPath, gistInfo, autoSyncGithub);
        }
      } else {
        saveGitHubConfig(githubToken, githubMode, owner, repoName, repoPath, gistInfo, autoSyncGithub);
        setSuccessMsg(`验证成功！已关联 GitHub 账号: @${u.login}`);
      }

      setGhSyncStatus('synced');
      setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
      setGhHasPulledInitial(true);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'GitHub Token 验证失败');
      setGithubUser(null);
      setGhSyncStatus('error');
    } finally {
      setGhLoading(false);
    }
  };

  const handleGitHubPush = async () => {
    if (!githubToken || !githubUser) {
      setError('请先验证 GitHub Token');
      return;
    }

    setGhLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload: GitHubSyncPayload = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        watchlist: data.watchlist,
        positions: data.positions,
        priceAlerts: data.priceAlerts,
        theme: data.theme,
        isUpRed: data.isUpRed,
        pnlLossAlertEnabled: data.pnlLossAlertEnabled,
        pnlLossAlertThreshold: data.pnlLossAlertThreshold,
      };

      if (githubMode === 'gist') {
        const info = await syncGistSave(githubToken, payload, gistInfo?.id);
        setGistInfo(info);
        saveGitHubConfig(githubToken, githubMode, repoOwner, repoName, repoPath, info, autoSyncGithub);
        setSuccessMsg('成功将交易数据备份推送到 GitHub Gist！');
      } else {
        if (!repoOwner || !repoName || !repoPath) {
          throw new Error('请填写完整的仓库 Owner、Repo 名与文件路径');
        }
        await pushToGitHubRepo(githubToken, repoOwner, repoName, repoPath, payload);
        saveGitHubConfig(githubToken, githubMode, repoOwner, repoName, repoPath, gistInfo, autoSyncGithub);
        setSuccessMsg(`成功推送到仓库 ${repoOwner}/${repoName} (${repoPath})！`);
      }

      setGhSyncStatus('synced');
      setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '推送数据到 GitHub 失败');
      setGhSyncStatus('error');
    } finally {
      setGhLoading(false);
    }
  };

  const handleGitHubPull = async () => {
    if (!githubToken || !githubUser) {
      setError('请先验证 GitHub Token');
      return;
    }

    setGhLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      let pulledData: GitHubSyncPayload;
      if (githubMode === 'gist') {
        const result = await syncGistPull(githubToken, gistInfo?.id);
        pulledData = result.data;
        setGistInfo(result.gistInfo);
      } else {
        if (!repoOwner || !repoName || !repoPath) {
          throw new Error('请填写完整的仓库 Owner、Repo 名与文件路径');
        }
        const result = await pullFromGitHubRepo(githubToken, repoOwner, repoName, repoPath);
        pulledData = result.data;
      }

      onRemoteUpdate(pulledData);
      setGhSyncStatus('synced');
      setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
      setSuccessMsg(`从 GitHub 调取恢复成功！包含 ${pulledData.watchlist?.length || 0} 只自选股、${pulledData.positions?.length || 0} 个持仓`);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err: any) {
      setError(err.message || '从 GitHub 拉取数据失败');
      setGhSyncStatus('error');
    } finally {
      setGhLoading(false);
    }
  };

  const handleUnlinkGitHub = () => {
    setGithubToken('');
    setGithubUser(null);
    setGistInfo(null);
    setGhSyncStatus('idle');
    setGhLastSynced(null);
    localStorage.removeItem(GITHUB_CONFIG_KEY);
    setSuccessMsg('已解绑 GitHub 账号');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // Determine button styles
  const isCloudLoggedIn = !!activeUser;
  const isGithubActive = !isCloudLoggedIn && !!githubUser && ghSyncStatus === 'synced';

  return (
    <div className="relative shrink-0 flex items-center" ref={containerRef}>
      {/* Header Sync / Login Trigger Button */}
      <button 
        type="button"
        id="btn-cloud-sync-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1.5 h-8 px-2 sm:px-3 rounded-xl text-xs font-bold cursor-pointer border transition-all duration-200 select-none shrink-0 whitespace-nowrap shadow-2xs active:scale-95 ${
          isCloudLoggedIn
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
            : isGithubActive
            ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700 hover:border-slate-500'
            : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border-indigo-500/30'
        }`}
        title={
          isCloudLoggedIn
            ? `已登录云账号: ${activeUser.email} (PC端与手机端 100% 数据互通同步)`
            : isGithubActive
            ? `GitHub 已连接 (@${githubUser?.login}) - 数据已备份`
            : "点击登录账号，实现电脑端与手机端全平台数据互通"
        }
      >
        {isCloudLoggedIn ? (
          <>
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-extrabold shrink-0">
              {activeUser.email.charAt(0).toUpperCase()}
            </div>
            <Cloud size={13} className="shrink-0 text-emerald-400" />
            <span className="text-xs font-bold shrink-0 hidden md:inline truncate max-w-[110px]">
              {activeUser.email.split('@')[0]}
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded font-mono hidden xl:inline">
              全端已同步
            </span>
          </>
        ) : isGithubActive ? (
          <>
            <GithubIcon size={13} className="text-white shrink-0" />
            <span className="text-xs font-bold shrink-0 hidden md:inline">
              @{githubUser?.login}
            </span>
          </>
        ) : (
          <>
            <UserIcon size={13} className="shrink-0 text-indigo-400" />
            <span className="text-xs font-bold shrink-0">
              登录 / 云同步
            </span>
          </>
        )}
      </button>

      {/* Responsive Modal / Popover */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsOpen(false)}
        >
          <div 
            id="modal-cloud-sync-dialog"
            className="w-full max-w-[95vw] sm:max-w-[480px] my-auto bg-theme-card border border-theme-border rounded-2xl sm:rounded-3xl shadow-2xl p-3.5 sm:p-5 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100dvh-3rem)] sm:max-h-[85vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-theme-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Cloud size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text-heading flex items-center gap-1.5">
                    多端云账号与数据同步
                  </h3>
                  <p className="text-[11px] text-theme-text-muted">电脑端、手机端、平板数据 100% 实时互通</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-theme-bg-hover hover:bg-theme-border text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer"
                title="关闭面板 (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Provider Switcher Tabs: Cloud vs GitHub */}
            <div className="grid grid-cols-2 bg-theme-panel p-1 rounded-xl border border-theme-border mb-3">
              <button
                type="button"
                onClick={() => { setProviderMode('cloud'); setError(''); setSuccessMsg(''); }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  providerMode === 'cloud' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <Cloud size={13} />
                <span>多端云账号同步 (推荐)</span>
              </button>
              <button
                type="button"
                onClick={() => { setProviderMode('github'); setError(''); setSuccessMsg(''); }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  providerMode === 'github' ? 'bg-slate-900 text-white shadow-md dark:bg-slate-800' : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <GithubIcon size={13} />
                <span>GitHub 备份</span>
              </button>
            </div>

            {/* Feedback Messages */}
            {successMsg && (
              <div className="p-2.5 mb-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center gap-1.5 animate-in fade-in duration-200">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {error && (
              <div className="p-2.5 mb-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ===================== MODE 1: UNIVERSAL CLOUD ACCOUNT SYNC ===================== */}
            {providerMode === 'cloud' && (
              activeUser ? (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Logged in Account Card */}
                  <div className="bg-theme-panel p-3.5 rounded-xl border border-theme-border-muted flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 font-extrabold text-sm">
                        {activeUser.email ? activeUser.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-theme-text-muted flex items-center gap-1">
                          <UserCheck size={11} className="text-emerald-400" />
                          <span>已登录云同步账号</span>
                        </div>
                        <div className="text-xs font-bold text-theme-text-primary truncate" title={activeUser.email}>
                          {activeUser.email}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                      syncStatus === 'synced' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}>
                      {syncStatus === 'syncing' ? (
                        <>
                          <RefreshCw size={10} className="animate-spin" />
                          <span>同步中...</span>
                        </>
                      ) : (
                        <>
                          <Check size={10} />
                          <span>全平台已互通</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Multi-Device Support Highlight */}
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center -space-x-1 text-indigo-400">
                        <Monitor size={15} />
                        <Smartphone size={14} />
                      </div>
                      <div className="text-[11px] text-theme-text-secondary">
                        <b>PC 与手机已无缝互通</b>：在任意设备登录该账号，持仓与自选股均完全一致。
                      </div>
                    </div>
                  </div>

                  {/* Auto-Sync Toggle Control */}
                  <div className="flex items-center justify-between bg-theme-bg/60 p-3 rounded-xl border border-theme-border-muted">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
                        <RefreshCw size={12} className={autoSyncEnabled ? "text-emerald-400" : "text-theme-text-muted"} />
                        <span>后台修改时自动实时同步</span>
                      </div>
                      <p className="text-[10px] text-theme-text-muted">
                        {autoSyncEnabled ? '开启中：在电脑或手机增删持仓时会自动即时广播' : '已关闭自动同步：数据修改需手动保存'}
                      </p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={e => toggleAutoSync(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Manual Save / Pull Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={handleSaveData}
                      disabled={syncStatus === 'syncing'}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                      title="立即将当前持仓与自选股保存至云端"
                    >
                      <Save size={14} />
                      <span>保存当前持仓数据</span>
                    </button>
                    <button 
                      onClick={handleManualPull}
                      disabled={syncStatus === 'syncing'}
                      className="py-2.5 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                      title="从云端刷新调取最新数据"
                    >
                      <DownloadCloud size={14} className="text-emerald-400" />
                      <span>从云端刷新拉取</span>
                    </button>
                  </div>

                  {/* Logout buttons */}
                  <div className="pt-3 border-t border-theme-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleSaveAndLogout}
                        disabled={syncStatus === 'syncing'}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="先保存当前数据，然后再安全退出登录"
                      >
                        <Save size={13} />
                        <span>保存并退出登录</span>
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="text-xs text-theme-text-muted hover:text-red-400 font-medium flex items-center gap-1 hover:bg-theme-bg-hover px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
                        title="不保存直接退出登录"
                      >
                        <LogOut size={13} />
                        <span>直接退出</span>
                      </button>
                    </div>
                    <span className="text-[10px] font-mono text-theme-text-muted shrink-0">
                      上次: {lastSyncedTime || '未记录'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Cloud Auth Form: Login / Register / Forgot */
                <div className="animate-in fade-in duration-150">
                  {/* Multi-Device Guarantee Banner */}
                  <div className="p-3 mb-3.5 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-start gap-2.5 text-xs">
                    <div className="flex items-center -space-x-1 text-indigo-400 mt-0.5 shrink-0">
                      <Monitor size={15} />
                      <Smartphone size={14} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-indigo-400">全平台互通保障</div>
                      <div className="text-[11px] text-theme-text-secondary leading-relaxed">
                        在电脑端和手机端登录同一个邮箱账号，所有自选股、持仓记录与设置将 <b>100% 自动实时同步</b>！
                      </div>
                    </div>
                  </div>

                  {/* Tabs: 账号登录 / 免费注册 / 找回密码 */}
                  <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border mb-3.5">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                      }`}
                    >
                      账号登录
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                      }`}
                    >
                      新用户注册
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('forgot'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === 'forgot' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                      }`}
                    >
                      找回密码
                    </button>
                  </div>

                  {activeTab !== 'forgot' ? (
                    <>
                      {/* Google Quick Login */}
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={googleLoading}
                        className="w-full py-2.5 px-3 mb-3 bg-theme-bg-hover hover:bg-theme-border border border-theme-border rounded-xl text-theme-text-primary text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 active:scale-98"
                      >
                        {googleLoading ? <Loader2 size={14} className="animate-spin" /> : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Google 账号一键{activeTab === 'login' ? '登录' : '注册'}</span>
                          </>
                        )}
                      </button>

                      <div className="relative my-3 text-center">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-theme-border"></div></div>
                        <span className="relative px-2.5 bg-theme-card text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">
                          或输入邮箱与密码
                        </span>
                      </div>

                      <form onSubmit={handleAuth} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                            <Mail size={11} className="text-indigo-400" />
                            <span>邮箱账号</span>
                          </label>
                          <input 
                            type="email" 
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="例如：your-name@gmail.com"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-theme-text-secondary uppercase flex items-center gap-1">
                              <KeyRound size={11} className="text-indigo-400" />
                              <span>登录密码</span>
                            </label>
                            {activeTab === 'login' && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('forgot'); setError(''); setSuccessMsg(''); }}
                                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                              >
                                忘记密码？
                              </button>
                            )}
                          </div>
                          <input 
                            type="password" 
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="至少 6 位字符"
                            minLength={6}
                          />
                        </div>

                        {activeTab === 'register' && (
                          <div>
                            <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                              <ShieldCheck size={11} className="text-indigo-400" />
                              <span>确认密码</span>
                            </label>
                            <input 
                              type="password" 
                              required
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              placeholder="再次输入相同密码"
                              minLength={6}
                            />
                          </div>
                        )}

                        <button 
                          type="submit" 
                          disabled={loading}
                          className="w-full py-2.5 mt-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 shadow-md active:scale-98"
                        >
                          {loading ? <Loader2 size={15} className="animate-spin" /> : (
                            <span>{activeTab === 'login' ? '立即登录并同步数据' : '创建账号并开启多端互通'}</span>
                          )}
                        </button>
                      </form>
                    </>
                  ) : (
                    /* Forgot Password Form */
                    <form onSubmit={handleResetPassword} className="space-y-3 animate-in fade-in duration-200">
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-theme-text-muted space-y-1">
                        <div className="font-bold text-indigo-400">快速重置密码说明:</div>
                        <p>输入您的注册邮箱并直接设置新密码，系统将即时更新并自动完成安全登录！</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                          <Mail size={11} className="text-indigo-400" />
                          <span>注册邮箱账号</span>
                        </label>
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          placeholder="例如：your-name@gmail.com"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                          <KeyRound size={11} className="text-indigo-400" />
                          <span>设置新密码</span>
                        </label>
                        <input 
                          type="password" 
                          required
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          placeholder="输入至少 6 位的新密码"
                          minLength={6}
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
                      >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : (
                          <span>一键重置密码并登录</span>
                        )}
                      </button>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                          className="text-xs text-indigo-400 hover:underline font-bold cursor-pointer"
                        >
                          返回账号登录
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            )}

            {/* ===================== MODE 2: GITHUB BACKUP ===================== */}
            {providerMode === 'github' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                {githubUser ? (
                  <div className="bg-theme-panel p-3 rounded-xl border border-theme-border-muted flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={githubUser.avatar_url} 
                        alt={githubUser.login} 
                        className="w-9 h-9 rounded-full border border-slate-600 shrink-0 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] text-theme-text-muted flex items-center gap-1">
                          <CheckCircle2 size={10} className="text-emerald-400" />
                          <span>已连接 GitHub 账号</span>
                        </div>
                        <div className="text-xs font-bold text-theme-text-primary truncate">
                          @{githubUser.login} {githubUser.name ? `(${githubUser.name})` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleUnlinkGitHub}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-all"
                      title="解绑 Token"
                    >
                      解绑
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-1">
                        <Key size={11} className="text-indigo-400" />
                        <span>GitHub Personal Access Token</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHelp(!showHelp)}
                        className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                      >
                        <HelpCircle size={10} />
                        <span>如何获取 Token?</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input 
                        type={showToken ? "text" : "password"}
                        value={githubToken}
                        onChange={e => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx 或 github_pat_xxxx..."
                        className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-2 pr-9 text-xs font-mono text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-theme-text-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text-primary"
                      >
                        {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>

                    {showHelp && (
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-theme-text-secondary space-y-1.5 animate-in fade-in duration-150">
                        <div className="font-bold text-indigo-400 flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>如何创建 GitHub 个人令牌:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[10px] text-theme-text-muted">
                          <li>前往 GitHub <b>Settings -&gt; Developer Settings -&gt; Personal Access Tokens</b></li>
                          <li>勾选 <b><code className="text-indigo-300">gist</code></b> 权限（推荐）或 <b><code className="text-indigo-300">repo</code></b> 权限</li>
                          <li>生成 Token 后粘贴至输入框并验证</li>
                        </ol>
                        <a 
                          href="https://github.com/settings/tokens/new?description=StockTradingDashboardSync&scopes=gist,repo" 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline pt-0.5"
                        >
                          <span>打开 GitHub Token 创建页</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleVerifyGitHubToken}
                      disabled={ghLoading || !githubToken.trim()}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {ghLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      <span>验证并绑定 GitHub 账号</span>
                    </button>
                  </div>
                )}

                {githubUser && (
                  <>
                    <div className="bg-theme-bg/60 p-2.5 rounded-xl border border-theme-border-muted space-y-2">
                      <div className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-1">
                        <FolderGit2 size={11} className="text-indigo-400" />
                        <span>同步模式</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setGithubMode('gist')}
                          className={`p-2 rounded-lg border text-left font-semibold transition-all cursor-pointer ${
                            githubMode === 'gist'
                              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
                              : 'border-theme-border text-theme-text-muted hover:text-theme-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-1 font-bold text-[11px]">
                            <FileJson size={12} />
                            <span>Gist 私密单文件</span>
                          </div>
                          <div className="text-[9px] text-theme-text-muted font-normal mt-0.5">
                            自动创建私密 Gist 备份
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setGithubMode('repo')}
                          className={`p-2 rounded-lg border text-left font-semibold transition-all cursor-pointer ${
                            githubMode === 'repo'
                              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
                              : 'border-theme-border text-theme-text-muted hover:text-theme-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-1 font-bold text-[11px]">
                            <GitBranch size={12} />
                            <span>GitHub 仓库文件</span>
                          </div>
                          <div className="text-[9px] text-theme-text-muted font-normal mt-0.5">
                            提交更新至指定仓库
                          </div>
                        </button>
                      </div>

                      {githubMode === 'repo' && (
                        <div className="space-y-1.5 pt-1.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="text-[9px] font-bold text-theme-text-muted">拥有者 (Owner)</span>
                              <input 
                                type="text"
                                value={repoOwner}
                                onChange={e => setRepoOwner(e.target.value)}
                                placeholder="username"
                                className="w-full bg-theme-bg border border-theme-border rounded-lg px-2 py-1 text-[11px] font-mono text-theme-text-primary"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-theme-text-muted">仓库名称 (Repo)</span>
                              <input 
                                type="text"
                                value={repoName}
                                onChange={e => setRepoName(e.target.value)}
                                placeholder="my-stock-data"
                                className="w-full bg-theme-bg border border-theme-border rounded-lg px-2 py-1 text-[11px] font-mono text-theme-text-primary"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-theme-text-muted">文件相对路径 (File Path)</span>
                            <input 
                              type="text"
                              value={repoPath}
                              onChange={e => setRepoPath(e.target.value)}
                              placeholder="data/stock_trading_data.json"
                              className="w-full bg-theme-bg border border-theme-border rounded-lg px-2 py-1 text-[11px] font-mono text-theme-text-primary"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleGitHubPush}
                        disabled={ghLoading}
                        className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {ghLoading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} className="text-indigo-400" />}
                        <span>推送到 GitHub</span>
                      </button>

                      <button
                        onClick={handleGitHubPull}
                        disabled={ghLoading}
                        className="py-2.5 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {ghLoading ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} className="text-emerald-400" />}
                        <span>从 GitHub 拉取</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
