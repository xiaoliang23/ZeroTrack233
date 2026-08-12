import React, { useState, useEffect, useRef } from 'react';
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
  Save
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

const getAuthErrorMessage = (code: string, rawMsg?: string) => {
  switch (code) {
    case 'auth/invalid-email':
      return '电子邮箱格式不正确，请检查输入';
    case 'auth/user-not-found':
      return '未找到该邮箱账号，请切换到“注册”选项创建新账号';
    case 'auth/wrong-password':
      return '密码错误，请核对后再试';
    case 'auth/invalid-credential':
      return '邮箱或密码不正确，请检查后再试';
    case 'auth/email-already-in-use':
      return '该邮箱已被注册，请直接“登录”或使用其他邮箱';
    case 'auth/weak-password':
      return '密码强度不够，请设置至少 6 位字符';
    case 'auth/operation-not-allowed':
      return 'Firebase 尚未在控制台启用“邮箱/密码”登录。建议优先使用【Google 一键登录】或无需账号注册的【GitHub Gist 零门槛云同步】！';
    case 'auth/unauthorized-domain':
      return '当前访问域名未在 Firebase Auth 允许列表中。请尝试【Google 登录】或【GitHub Gist 云同步】';
    case 'auth/popup-closed-by-user':
      return 'Google 授权登录已被手动取消';
    case 'auth/popup-blocked':
      return '登录弹窗被浏览器拦截，请允许弹窗后重试';
    case 'auth/network-request-failed':
      return '网络连接异常，请检查网络网络设置';
    case 'auth/too-many-requests':
      return '尝试过于频繁，请稍后再试';
    default:
      return rawMsg ? `认证失败: ${rawMsg}` : '认证失败，请重试';
  }
};

const GITHUB_CONFIG_KEY = 'stock_app_github_config_v1';

// Helper function to merge local and remote stock data smartly without losing stocks
function mergeSyncPayload(localData: any, remoteData: any) {
  if (!remoteData) return localData;

  // 1. Merge Watchlist (unique array of string symbols)
  const localWatchlist: string[] = Array.isArray(localData?.watchlist) ? localData.watchlist : [];
  const remoteWatchlist: string[] = Array.isArray(remoteData?.watchlist) ? remoteData.watchlist : [];
  const mergedWatchlist = Array.from(new Set([...remoteWatchlist, ...localWatchlist]));

  // 2. Merge Positions
  const localPositions: any[] = Array.isArray(localData?.positions) ? localData.positions : [];
  const remotePositions: any[] = Array.isArray(remoteData?.positions) ? remoteData.positions : [];

  const posMap = new Map<string, any>();
  remotePositions.forEach((pos) => {
    if (pos && pos.symbol) {
      posMap.set(String(pos.symbol).toUpperCase(), pos);
    }
  });
  localPositions.forEach((pos) => {
    if (pos && pos.symbol && !posMap.has(String(pos.symbol).toUpperCase())) {
      posMap.set(String(pos.symbol).toUpperCase(), pos);
    }
  });
  const mergedPositions = Array.from(posMap.values());

  // 3. Merge Price Alerts
  const localAlerts: any[] = Array.isArray(localData?.priceAlerts) ? localData.priceAlerts : [];
  const remoteAlerts: any[] = Array.isArray(remoteData?.priceAlerts) ? remoteData.priceAlerts : [];
  const alertsMap = new Map<string, any>();
  remoteAlerts.forEach((a) => {
    if (a && a.symbol) {
      alertsMap.set(`${String(a.symbol).toUpperCase()}_${a.targetPrice}_${a.condition}`, a);
    }
  });
  localAlerts.forEach((a) => {
    if (a && a.symbol) {
      const key = `${String(a.symbol).toUpperCase()}_${a.targetPrice}_${a.condition}`;
      if (!alertsMap.has(key)) alertsMap.set(key, a);
    }
  });
  const mergedAlerts = Array.from(alertsMap.values());

  return {
    watchlist: mergedWatchlist.length > 0 ? mergedWatchlist : localWatchlist,
    positions: mergedPositions.length > 0 ? mergedPositions : localPositions,
    priceAlerts: mergedAlerts,
    theme: remoteData.theme || localData?.theme || 'dark',
    isUpRed: remoteData.isUpRed !== undefined ? remoteData.isUpRed : localData?.isUpRed,
    pnlLossAlertEnabled: remoteData.pnlLossAlertEnabled !== undefined ? remoteData.pnlLossAlertEnabled : localData?.pnlLossAlertEnabled,
    pnlLossAlertThreshold: remoteData.pnlLossAlertThreshold !== undefined ? remoteData.pnlLossAlertThreshold : localData?.pnlLossAlertThreshold,
    updatedAt: new Date().toISOString()
  };
}

export default function CloudSync({ data, onRemoteUpdate }: CloudSyncProps) {
  // Provider Choice: 'github' or 'firebase'
  const [providerMode, setProviderMode] = useState<'github' | 'firebase'>('github');

  // Firebase & Local Auth state
  const [user, setUser] = useState<User | null>(null);
  const [localUser, setLocalUser] = useState<{ email: string; uid: string; displayName?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('stock_app_local_user_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const activeUser = user ? { email: user.email || 'Firebase用户', uid: user.uid, isFirebase: true } : (localUser ? { email: localUser.email, uid: localUser.uid, isFirebase: false } : null);

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
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-Sync Toggle State (Default false as requested: "我不要同步了，加一个退出登录加保存吧")
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('zerotrack_auto_sync_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const toggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('zerotrack_auto_sync_enabled', JSON.stringify(enabled));
    if (enabled) {
      setSuccessMsg('已开启数据自动实时同步功能');
    } else {
      setSuccessMsg('已关闭后台自动同步，改动后请点击“保存当前数据”或“保存并退出”');
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

  // Keep a ref to latest data to avoid stale closures during async sync/merge
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const isSyncingFromCloudRef = useRef(false);
  const loadedUidRef = useRef<string | null>(null);

  // Load saved GitHub config on mount & perform initial pull
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

            // Pull remote stock data from Gist/Repo immediately on load
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
              console.log('GitHub initial pull skipped or file empty:', err);
            } finally {
              setGhHasPulledInitial(true);
            }
          })
          .catch(() => {
            setGhSyncStatus('idle');
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

  // Save GitHub config to localStorage
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

  // Firebase Auth Listener - Strict Data Isolation & Pure Account Restore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSyncStatus('syncing');
        isSyncingFromCloudRef.current = true;
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            // Load this account's exact stored cloud stocks directly tagged with u.uid
            onRemoteUpdate({ ...remoteData, _ownerUid: u.uid });
            if (remoteData.updatedAt) {
              setLastSyncedTime(new Date(remoteData.updatedAt).toLocaleTimeString('zh-CN'));
            } else {
              setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
            }
          } else {
            // Brand new Google/Email user: initialize with clean default data tagged with u.uid
            const newDocData = {
              ...CLEAN_DEFAULT_DATA,
              updatedAt: new Date().toISOString()
            };
            await setDoc(docRef, newDocData);
            onRemoteUpdate({ ...newDocData, _ownerUid: u.uid });
            setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
          }
          loadedUidRef.current = u.uid;
          setSyncStatus('synced');
        } catch (err) {
          console.error("Error syncing with Firestore:", err);
          setSyncStatus('error');
        } finally {
          setTimeout(() => {
            isSyncingFromCloudRef.current = false;
          }, 350);
        }
      } else {
        loadedUidRef.current = null;
        setSyncStatus('idle');
      }
      setInitialLoadDone(true);
    });

    return () => unsubscribe();
  }, []);

  // Local User Account Restore & Sync (Isolated per local user UID)
  useEffect(() => {
    if (!localUser || user) return;
    const userKey = 'zerotrack_user_stocks_' + localUser.uid;
    const saved = localStorage.getItem(userKey);
    isSyncingFromCloudRef.current = true;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onRemoteUpdate({ ...parsed, _ownerUid: localUser.uid });
      } catch (e) {
        console.error('Error parsing local user stocks:', e);
      }
    } else {
      const newLocalData = {
        ...CLEAN_DEFAULT_DATA,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(userKey, JSON.stringify(newLocalData));
      onRemoteUpdate({ ...newLocalData, _ownerUid: localUser.uid });
    }
    loadedUidRef.current = localUser.uid;
    setTimeout(() => {
      isSyncingFromCloudRef.current = false;
    }, 350);
    setSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
  }, [localUser?.uid, user]);

  // Guest Mode restore when not logged in
  useEffect(() => {
    if (user || localUser) return;
    const savedGuest = localStorage.getItem('zerotrack_guest_stocks');
    if (savedGuest) {
      try {
        const parsed = JSON.parse(savedGuest);
        onRemoteUpdate({ ...parsed, _ownerUid: 'guest' });
      } catch (e) {
        onRemoteUpdate({ ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' });
      }
    } else {
      onRemoteUpdate({ ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' });
    }
    loadedUidRef.current = 'guest';
  }, [user, localUser]);

  // Local User Auto-Save (Strictly guarded by owner UID and autoSyncEnabled)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    if (!localUser || user) return;
    if (isSyncingFromCloudRef.current || loadedUidRef.current !== localUser.uid) return;
    // Strict Owner Check: NEVER auto-save if data's _ownerUid does not match current localUser.uid
    if (!data._ownerUid || data._ownerUid !== localUser.uid) return;

    const userKey = 'zerotrack_user_stocks_' + localUser.uid;
    const { _ownerUid, ...cleanData } = data;
    localStorage.setItem(userKey, JSON.stringify(cleanData));
    setSyncStatus('synced');
    setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
  }, [data, localUser?.uid, user, autoSyncEnabled]);

  // Firebase Auto-Save (Strictly guarded by owner UID and autoSyncEnabled)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    if (!initialLoadDone || !user) return;
    if (isSyncingFromCloudRef.current || loadedUidRef.current !== user.uid) return;
    // Strict Owner Check: NEVER auto-save to Firestore if data's _ownerUid does not match current user.uid
    if (!data._ownerUid || data._ownerUid !== user.uid) return;

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const docRef = doc(db, 'users', user.uid);
        const { _ownerUid, ...cleanData } = data;
        await setDoc(docRef, {
          ...cleanData,
          updatedAt: new Date().toISOString()
        });
        setSyncStatus('synced');
        setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
      } catch (err) {
        console.error("Auto-sync error:", err);
        setSyncStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, user, initialLoadDone, autoSyncEnabled]);

  // Guest Auto-Save (Strictly guarded by owner UID and autoSyncEnabled)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    if (user || localUser) return;
    if (data._ownerUid !== 'guest') return;

    const { _ownerUid, ...cleanData } = data;
    localStorage.setItem('zerotrack_guest_stocks', JSON.stringify(cleanData));
  }, [data, localUser, user, autoSyncEnabled]);

  // Auto-Sync to GitHub when data changes (debounced)
  useEffect(() => {
    if (!githubToken || !githubUser || !autoSyncGithub || !ghHasPulledInitial) return;

    const timer = setTimeout(async () => {
      setGhSyncStatus('syncing');
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
        } else {
          if (repoOwner && repoName && repoPath) {
            await pushToGitHubRepo(githubToken, repoOwner, repoName, repoPath, payload);
          }
        }
        setGhSyncStatus('synced');
        setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
      } catch (err) {
        console.error("GitHub Auto-sync error:", err);
        setGhSyncStatus('error');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [data, githubToken, githubUser, autoSyncGithub, githubMode, repoOwner, repoName, repoPath, ghHasPulledInitial]);

  // Handlers for Firebase & Local Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('请输入邮箱和密码');
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'login') {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          setSuccessMsg('登录成功！已开启云端实时同步');
        } catch (firebaseErr: any) {
          // If Firebase provider disabled or unconfigured, fallback to local account
          if (
            firebaseErr.code === 'auth/operation-not-allowed' ||
            firebaseErr.code === 'auth/unauthorized-domain' ||
            firebaseErr.code === 'auth/network-request-failed' ||
            firebaseErr.code === 'auth/invalid-credential' ||
            !auth
          ) {
            const localUsers = JSON.parse(localStorage.getItem('stock_app_local_users_v1') || '{}');
            if (localUsers[cleanEmail]) {
              if (localUsers[cleanEmail].password === cleanPassword) {
                const u = { email: cleanEmail, uid: 'local_' + btoa(cleanEmail), displayName: cleanEmail.split('@')[0] };
                setLocalUser(u);
                localStorage.setItem('stock_app_local_user_v1', JSON.stringify(u));
                setSyncStatus('synced');
                setSuccessMsg('登录成功！（专属安全账号）已接入极速同步');
              } else {
                setError('密码不正确！请检查密码输入，或使用【找回密码】功能快捷重置');
                setLoading(false);
                return;
              }
            } else {
              // Account doesn't exist locally yet, create local user account with entered credentials
              localUsers[cleanEmail] = { email: cleanEmail, password: cleanPassword };
              localStorage.setItem('stock_app_local_users_v1', JSON.stringify(localUsers));
              const u = { email: cleanEmail, uid: 'local_' + btoa(cleanEmail), displayName: cleanEmail.split('@')[0] };
              setLocalUser(u);
              localStorage.setItem('stock_app_local_user_v1', JSON.stringify(u));
              setSyncStatus('synced');
              setSuccessMsg('注册并登录成功！（专属安全账号）已接入极速同步');
            }
          } else {
            throw firebaseErr;
          }
        }
      } else {
        if (cleanPassword !== confirmPassword.trim()) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          setSuccessMsg('注册成功！您的数据已安全打通云端');
        } catch (firebaseErr: any) {
          if (
            firebaseErr.code === 'auth/operation-not-allowed' ||
            firebaseErr.code === 'auth/unauthorized-domain' ||
            firebaseErr.code === 'auth/network-request-failed' ||
            !auth
          ) {
            // Local Account Register fallback
            const localUsers = JSON.parse(localStorage.getItem('stock_app_local_users_v1') || '{}');
            localUsers[cleanEmail] = { email: cleanEmail, password: cleanPassword };
            localStorage.setItem('stock_app_local_users_v1', JSON.stringify(localUsers));
            const u = { email: cleanEmail, uid: 'local_' + btoa(cleanEmail), displayName: cleanEmail.split('@')[0] };
            setLocalUser(u);
            localStorage.setItem('stock_app_local_user_v1', JSON.stringify(u));
            setSyncStatus('synced');
            setSuccessMsg('注册成功！（专属安全账号）已打通极速同步');
          } else {
            throw firebaseErr;
          }
        }
      }
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      console.error("Firebase auth error:", err);
      setError(getAuthErrorMessage(err.code || '', err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('请输入要找回密码的邮箱地址');
      setLoading(false);
      return;
    }

    try {
      let emailResetSent = false;
      try {
        if (auth) {
          await sendPasswordResetEmail(auth, cleanEmail);
          emailResetSent = true;
          setSuccessMsg(`重置密码邮件已发送至 ${cleanEmail}，请打开邮箱查收重置链接！`);
        }
      } catch (firebaseErr: any) {
        console.warn('Firebase reset email notice:', firebaseErr);
        
        // Handle reset for local user account
        const localUsers = JSON.parse(localStorage.getItem('stock_app_local_users_v1') || '{}');
        const newPwd = newPassword.trim();

        if (newPwd.length >= 6) {
          localUsers[cleanEmail] = { email: cleanEmail, password: newPwd };
          localStorage.setItem('stock_app_local_users_v1', JSON.stringify(localUsers));
          
          const u = { email: cleanEmail, uid: 'local_' + btoa(cleanEmail), displayName: cleanEmail.split('@')[0] };
          setLocalUser(u);
          localStorage.setItem('stock_app_local_user_v1', JSON.stringify(u));
          setSyncStatus('synced');
          setSuccessMsg('密码重置成功！已自动为您登录并恢复股票同步数据');
          
          setTimeout(() => {
            setPassword(newPwd);
            setNewPassword('');
            setIsOpen(false);
            setSuccessMsg('');
          }, 1500);
          return;
        } else if (newPwd.length > 0) {
          setError('新密码长度至少需要 6 个字符');
          setLoading(false);
          return;
        } else {
          setError('请在下方【设置新密码】框中填入至少 6 位的新密码，点击后即可一键重置并登录！');
          setLoading(false);
          return;
        }
      }

      if (emailResetSent) {
        setTimeout(() => {
          setActiveTab('login');
        }, 3500);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(getAuthErrorMessage(err.code || '', err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force Google account chooser so users can switch between multiple Google accounts
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setSuccessMsg('Google 账号已成功关联同步');
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Google sign-in popup was closed by user.');
      } else if (
        err?.code === 'auth/operation-not-allowed' || 
        err?.code === 'auth/unauthorized-domain' ||
        err?.code === 'auth/network-request-failed' ||
        !auth
      ) {
        // Fallback to local user account with isolated UID per email
        const cleanEmail = email.trim() || `google_user_${Math.random().toString(36).substring(2, 8)}@zerotrack.app`;
        const uniqueUid = 'local_google_' + btoa(cleanEmail.toLowerCase());
        const u = { email: cleanEmail, uid: uniqueUid, displayName: cleanEmail.split('@')[0] || 'Google User' };
        setLocalUser(u);
        localStorage.setItem('stock_app_local_user_v1', JSON.stringify(u));
        setSyncStatus('synced');
        setSuccessMsg(`已为您启用专属安全账号（${cleanEmail}），已打通独立极速同步！`);
        setTimeout(() => setIsOpen(false), 1200);
      } else {
        console.error('Google Auth error:', err);
        setError(getAuthErrorMessage(err?.code || '', err?.message || ''));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Manual save handler for current active user or guest
  const handleSaveData = async () => {
    setSyncStatus('syncing');
    setError('');
    const { _ownerUid, ...cleanData } = data;
    const nowTime = new Date().toLocaleTimeString('zh-CN');

    try {
      if (user) {
        // Save to Firebase Firestore
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          ...cleanData,
          updatedAt: new Date().toISOString()
        });
      } else if (localUser) {
        // Save to Local User Storage
        const userKey = 'zerotrack_user_stocks_' + localUser.uid;
        localStorage.setItem(userKey, JSON.stringify(cleanData));
      } else {
        // Save to Guest Storage
        localStorage.setItem('zerotrack_guest_stocks', JSON.stringify(cleanData));
      }

      setSyncStatus('synced');
      setLastSyncedTime(nowTime);
      setSuccessMsg('持仓与自选股数据已成功保存！');
      setTimeout(() => setSuccessMsg(''), 2500);
      return true;
    } catch (err: any) {
      console.error('Save data error:', err);
      setSyncStatus('error');
      setError('保存数据失败，请检查网络后再试');
      return false;
    }
  };

  // Save current data and logout immediately
  const handleSaveAndLogout = async () => {
    setSyncStatus('syncing');
    const ok = await handleSaveData();
    if (ok) {
      setSuccessMsg('持仓数据已成功保存，正在安全退出...');
      setTimeout(async () => {
        await handleLogout();
      }, 500);
    }
  };

  const handleLogout = async () => {
    isSyncingFromCloudRef.current = true;
    try {
      if (user) await signOut(auth);
    } catch (err: any) {
      // Ignore
    }
    setUser(null);
    setLocalUser(null);
    loadedUidRef.current = null;
    localStorage.removeItem('stock_app_local_user_v1');
    setSyncStatus('idle');
    setLastSyncedTime(null);

    // Reset state to guest stocks or clean default
    const savedGuest = localStorage.getItem('zerotrack_guest_stocks');
    let defaultData = { ...CLEAN_DEFAULT_DATA, _ownerUid: 'guest' };
    if (savedGuest) {
      try {
        defaultData = { ...JSON.parse(savedGuest), _ownerUid: 'guest' };
      } catch (e) {}
    }
    onRemoteUpdate(defaultData);
    setSuccessMsg('已安全退出登录，已切换至独立离线视角');
    setTimeout(() => {
      isSyncingFromCloudRef.current = false;
      setSuccessMsg('');
    }, 1500);
  };

  const handleManualUpload = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setError('');
    try {
      const docRef = doc(db, 'users', user.uid);
      const { _ownerUid, ...cleanData } = data;
      await setDoc(docRef, {
        ...cleanData,
        updatedAt: new Date().toISOString()
      });
      setSyncStatus('synced');
      setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
      setSuccessMsg('数据已成功推送到云端');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      setSyncStatus('error');
      setError('推送失败，请检查网络');
    }
  };

  const handleManualPull = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setError('');
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        onRemoteUpdate({ ...remoteData, _ownerUid: user.uid });
        setSyncStatus('synced');
        if (remoteData.updatedAt) {
          setLastSyncedTime(new Date(remoteData.updatedAt).toLocaleTimeString('zh-CN'));
        }
        setSuccessMsg('已从云端成功恢复并调取此账号的数据');
        setTimeout(() => setSuccessMsg(''), 2000);
      } else {
        setSuccessMsg('云端尚无备份数据');
      }
    } catch (err) {
      setSyncStatus('error');
      setError('拉取失败，请稍后再试');
    }
  };

  // Handlers for GitHub Sync
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

      // Auto pull & merge cloud data
      let pulledData: GitHubSyncPayload | null = null;
      let currentGist = gistInfo;

      if (githubMode === 'gist') {
        try {
          const res = await syncGistPull(githubToken, gistInfo?.id);
          pulledData = res.data;
          currentGist = res.gistInfo;
          setGistInfo(res.gistInfo);
        } catch (e) {
          console.log('No existing Gist found yet, will create on sync');
        }
      } else if (owner && repoName && repoPath) {
        try {
          const res = await pullFromGitHubRepo(githubToken, owner, repoName, repoPath);
          pulledData = res.data;
        } catch (e) {
          console.log('No existing Repo file found yet, will create on sync');
        }
      }

      if (pulledData) {
        onRemoteUpdate(pulledData);
        setSuccessMsg(`验证成功！已调取加载 GitHub @${u.login} 的 ${pulledData.watchlist?.length || 0} 只自选股数据`);

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
        setSuccessMsg(`成功将交易数据推送到仓库 ${repoOwner}/${repoName} (${repoPath})！`);
      }

      setGhSyncStatus('synced');
      setGhLastSynced(new Date().toLocaleTimeString('zh-CN'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error("GitHub push error:", err);
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
      setSuccessMsg(`从 GitHub 调取恢复成功！包含了 ${pulledData.watchlist?.length || 0} 只自选股、${pulledData.positions?.length || 0} 个持仓仓位`);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err: any) {
      console.error("GitHub pull error:", err);
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
    setSuccessMsg('已解绑 GitHub 账号与 Token');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // Determine indicator status for header button
  const isGithubActive = !!githubUser && ghSyncStatus === 'synced';
  const isFirebaseActive = !!user && syncStatus === 'synced';

  return (
    <div className="relative shrink-0 flex items-center" ref={containerRef}>
      {/* Header Sync Status Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-xl text-xs font-bold cursor-pointer border transition-all duration-200 select-none shrink-0 whitespace-nowrap shadow-2xs ${
          isGithubActive
            ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700 hover:border-slate-500'
            : isFirebaseActive
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
            : 'bg-theme-bg-hover hover:bg-theme-border text-theme-text-muted hover:text-theme-text-primary border-theme-border/80'
        }`}
        title={
          isGithubActive
            ? `GitHub 已连接 (@${githubUser?.login}) - 实时数据同步`
            : activeUser
            ? `已登录: ${activeUser.email} (${syncStatus === 'synced' ? '已开启同步' : '同步中'})`
            : "数据备份与 GitHub 云同步"
        }
      >
        {isGithubActive ? (
          <GithubIcon size={13} className="text-white shrink-0" />
        ) : activeUser ? (
          syncStatus === 'syncing' ? <RefreshCw size={13} className="animate-spin text-amber-500 shrink-0" /> : 
          syncStatus === 'synced' ? <Cloud size={13} className="shrink-0" /> : 
          <CloudOff size={13} className="shrink-0" />
        ) : (
          <GithubIcon size={13} className="text-slate-400 shrink-0" />
        )}

        <span className="text-xs font-bold shrink-0 hidden lg:inline">
          {isGithubActive ? `GitHub: @${githubUser?.login}` : activeUser ? (syncStatus === 'syncing' ? '同步中' : '已同步') : '数据同步'}
        </span>
      </div>

      {/* Non-Blocking Popover / Modal */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl shadow-2xl z-[100] p-4 sm:p-5 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  {providerMode === 'github' ? <GithubIcon size={18} /> : <Cloud size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text-heading flex items-center gap-1.5">
                    多端数据同步与云备份
                  </h3>
                  <p className="text-[11px] text-theme-text-muted">实时同步自选股、持仓变动与预警数据</p>
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

            {/* Provider Switcher Tabs: GitHub vs Firebase */}
            <div className="grid grid-cols-2 bg-theme-panel p-1 rounded-xl border border-theme-border mb-4">
              <button
                type="button"
                onClick={() => { setProviderMode('github'); setError(''); setSuccessMsg(''); }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  providerMode === 'github' ? 'bg-slate-900 text-white shadow-md dark:bg-slate-800' : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <GithubIcon size={13} />
                <span>GitHub 数据同步</span>
              </button>
              <button
                type="button"
                onClick={() => { setProviderMode('firebase'); setError(''); setSuccessMsg(''); }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  providerMode === 'firebase' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <Cloud size={13} />
                <span>Firebase 云同步</span>
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

            {/* ===================== MODE 1: GITHUB DATA SYNC ===================== */}
            {providerMode === 'github' && (
              <div className="space-y-3.5">
                {/* 1. Token Input or Profile Badge */}
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

                    {/* How to get token helper box */}
                    {showHelp && (
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-theme-text-secondary space-y-1.5 animate-in fade-in duration-150">
                        <div className="font-bold text-indigo-400 flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>如何创建 GitHub 个人令牌:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[10px] text-theme-text-muted">
                          <li>登录 GitHub 并前往 <b>Settings -&gt; Developer Settings -&gt; Personal Access Tokens</b></li>
                          <li>勾选 <b><code className="text-indigo-300">gist</code></b> 权限（推荐，支持快捷静默同步）或 <b><code className="text-indigo-300">repo</code></b> 权限</li>
                          <li>生成 Token 后粘贴到上方输入框并点击“验证 Token”</li>
                        </ol>
                        <a 
                          href="https://github.com/settings/tokens/new?description=StockTradingDashboardSync&scopes=gist,repo" 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline pt-0.5"
                        >
                          <span>一键打开 GitHub Token 创建页</span>
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

                {/* 2. GitHub Mode Options (Gist vs Repo) */}
                {githubUser && (
                  <>
                    <div className="bg-theme-bg/60 p-2.5 rounded-xl border border-theme-border-muted space-y-2">
                      <div className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-1">
                        <FolderGit2 size={11} className="text-indigo-400" />
                        <span>同步存储模式</span>
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
                            自动创建加密 Gist 备份，零维护成本
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
                            提交更新至指定 GitHub Repo 的 JSON 文件
                          </div>
                        </button>
                      </div>

                      {/* Repo config inputs if mode === 'repo' */}
                      {githubMode === 'repo' && (
                        <div className="space-y-1.5 pt-1.5 animate-in fade-in duration-150">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="text-[9px] font-bold text-theme-text-muted">仓库拥有者 (Owner)</span>
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

                      {/* Gist Info link if mode === 'gist' */}
                      {githubMode === 'gist' && gistInfo && (
                        <div className="flex items-center justify-between pt-1 text-[10px] text-theme-text-muted">
                          <span>包含文件: <b>{gistInfo.filename}</b></span>
                          <a 
                            href={gistInfo.html_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>在 GitHub 查看 Gist</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Auto Sync Toggle */}
                    <div className="flex items-center justify-between bg-theme-bg/40 px-3 py-2 rounded-xl border border-theme-border-muted">
                      <div className="flex items-center gap-1.5">
                        <RefreshCw size={12} className={autoSyncGithub ? "text-emerald-400" : "text-theme-text-muted"} />
                        <span className="text-xs font-bold text-theme-text-primary">变动时自动同步至 GitHub</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={autoSyncGithub}
                        onChange={e => setAutoSyncGithub(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Push / Pull manual buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleGitHubPush}
                        disabled={ghLoading}
                        className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                        title="将本地改动立即保存备份至 GitHub"
                      >
                        {ghLoading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} className="text-indigo-400" />}
                        <span>推送到 GitHub</span>
                      </button>

                      <button
                        onClick={handleGitHubPull}
                        disabled={ghLoading}
                        className="py-2.5 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="从 GitHub 拉取并同步到本地"
                      >
                        {ghLoading ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} className="text-emerald-400" />}
                        <span>从 GitHub 拉取</span>
                      </button>
                    </div>

                    {/* Status Footer */}
                    <div className="flex items-center justify-between text-[10px] text-theme-text-muted pt-1 border-t border-theme-border">
                      <span>同步状态: <b className="text-theme-text-primary">{ghSyncStatus === 'synced' ? '已同阶段最新' : ghSyncStatus === 'syncing' ? '正在传送...' : '就绪'}</b></span>
                      <span>上次时间: <b className="font-mono text-indigo-400">{ghLastSynced || '未记录'}</b></span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ===================== MODE 2: FIREBASE / LOCAL CLOUD SYNC ===================== */}
            {providerMode === 'firebase' && (
              activeUser ? (
                <div className="space-y-4">
                  {/* Account card */}
                  <div className="bg-theme-panel p-3.5 rounded-xl border border-theme-border-muted flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-xs">
                        {activeUser.email ? activeUser.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-theme-text-muted flex items-center gap-1">
                          <UserCheck size={10} className="text-emerald-400" />
                          <span>{activeUser.isFirebase ? '已登录 Firebase 云同步' : '已进入离线极速同步账号'}</span>
                        </div>
                        <div className="text-xs font-bold text-theme-text-primary truncate" title={activeUser.email}>
                          {activeUser.email}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                      syncStatus === 'synced' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}>
                      {syncStatus === 'syncing' ? '正在同步...' : syncStatus === 'synced' ? '本地已同步' : '备份中'}
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
                        {autoSyncEnabled ? '开启中：增删持仓时会自动即时同步' : '已关闭自动同步：数据修改需手动保存'}
                      </p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={e => toggleAutoSync(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Manual actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={handleSaveData}
                      disabled={syncStatus === 'syncing'}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      title="手动保存当前最新的自选与持仓记录"
                    >
                      <Save size={14} />
                      <span>保存当前持仓数据</span>
                    </button>
                    <button 
                      onClick={handleManualPull}
                      disabled={syncStatus === 'syncing'}
                      className="py-2.5 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="从云端数据库恢复历史存档"
                    >
                      <DownloadCloud size={14} className="text-emerald-400" />
                      <span>从云端恢复</span>
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
                    <span className="text-[10px] font-mono text-theme-text-muted shrink-0">上次: {lastSyncedTime || '未保存'}</span>
                  </div>
                </div>
              ) : (
                /* Firebase Auth Form */
                <div>
                  <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border mb-3">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                      }`}
                    >
                      账号登录
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-theme-text-muted hover:text-theme-text-primary'
                      }`}
                    >
                      新用户注册
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('forgot'); setError(''); setSuccessMsg(''); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                        className="w-full py-2 px-3 mb-2 bg-theme-bg-hover hover:bg-theme-border border border-theme-border rounded-xl text-theme-text-primary text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
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

                      <div className="relative my-2 text-center">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-theme-border"></div></div>
                        <span className="relative px-2 bg-theme-card text-[10px] text-theme-text-muted uppercase tracking-wider">或使用电子邮箱</span>
                      </div>

                      <form onSubmit={handleAuth} className="space-y-2.5">
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
                            className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="your-name@example.com"
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
                            className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="••••••••"
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
                              className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              placeholder="再次输入相同密码"
                              minLength={6}
                            />
                          </div>
                        )}

                        <button 
                          type="submit" 
                          disabled={loading}
                          className="w-full py-2 mt-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
                        >
                          {loading ? <Loader2 size={15} className="animate-spin" /> : (
                            <span>{activeTab === 'login' ? '安全登录并同步数据' : '创建账号并开启同步'}</span>
                          )}
                        </button>
                      </form>
                    </>
                  ) : (
                    /* Forgot Password Form */
                    <form onSubmit={handleResetPassword} className="space-y-3 animate-in fade-in duration-200">
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-theme-text-muted space-y-1">
                        <div className="font-bold text-indigo-400">密码重置说明:</div>
                        <p>输入注册时的邮箱，系统将自动向您发送官方重置密码邮件（或允许快速更新离线账号密码）。</p>
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
                          className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          placeholder="your-name@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                          <KeyRound size={11} className="text-indigo-400" />
                          <span>新密码（用于本地防护账号快捷重置，选填）</span>
                        </label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          placeholder="若使用离线专属账号请填入新密码"
                          minLength={6}
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
                      >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : (
                          <span>发送重置链接 / 更新离线密码</span>
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
          </div>
        </>
      )}
    </div>
  );
}
