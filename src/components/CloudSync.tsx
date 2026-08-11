import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithPopup 
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
  EyeOff
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
  };
  onRemoteUpdate: (data: any) => void;
}

const getAuthErrorMessage = (code: string) => {
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
    case 'auth/popup-closed-by-user':
      return 'Google 授权登录已被手动取消';
    case 'auth/popup-blocked':
      return '登录弹窗被浏览器拦截，请允许弹窗后重试';
    case 'auth/network-request-failed':
      return '网络连接异常，请检查网络';
    case 'auth/too-many-requests':
      return '尝试过于频繁，请稍后再试';
    default:
      return '认证失败，请重试';
  }
};

const GITHUB_CONFIG_KEY = 'stock_app_github_config_v1';

export default function CloudSync({ data, onRemoteUpdate }: CloudSyncProps) {
  // Provider Choice: 'github' or 'firebase'
  const [providerMode, setProviderMode] = useState<'github' | 'firebase'>('github');

  // Firebase state
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Load saved GitHub config on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
      let tokenToVerify = ((import.meta as any).env?.VITE_GITHUB_TOKEN as string) || '';
      
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          tokenToVerify = parsed.token;
          if (parsed.mode) setGithubMode(parsed.mode);
          if (parsed.repoOwner) setRepoOwner(parsed.repoOwner);
          if (parsed.repoName) setRepoName(parsed.repoName);
          if (parsed.repoPath) setRepoPath(parsed.repoPath);
          if (parsed.gistInfo) setGistInfo(parsed.gistInfo);
          if (typeof parsed.autoSync === 'boolean') setAutoSyncGithub(parsed.autoSync);
        }
      }

      setGithubToken(tokenToVerify);
      if (tokenToVerify) {
        verifyGitHubToken(tokenToVerify)
          .then(u => {
            setGithubUser(u);
            if (!repoOwner) setRepoOwner(u.login);
            setGhSyncStatus('synced');
          })
          .catch(() => {
            setGhSyncStatus('idle');
          });
      }
    } catch (e) {
      console.error('Failed to parse saved github config', e);
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

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSyncStatus('syncing');
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            onRemoteUpdate(remoteData);
            if (remoteData.updatedAt) {
              setLastSyncedTime(new Date(remoteData.updatedAt).toLocaleTimeString('zh-CN'));
            } else {
              setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
            }
          } else {
            // New user registered: upload local data immediately
            await setDoc(docRef, {
              ...data,
              updatedAt: new Date().toISOString()
            });
            setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
          }
          setSyncStatus('synced');
        } catch (err) {
          console.error("Error syncing with Firestore:", err);
          setSyncStatus('error');
        }
      } else {
        setSyncStatus('idle');
      }
      setInitialLoadDone(true);
    });

    return () => unsubscribe();
  }, []);

  // Auto-Sync to Firebase when data changes
  useEffect(() => {
    if (!initialLoadDone || !user) return;

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          ...data,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('synced');
        setLastSyncedTime(new Date().toLocaleTimeString('zh-CN'));
      } catch (err) {
        console.error("Auto-sync error:", err);
        setSyncStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [data, user, initialLoadDone]);

  // Auto-Sync to GitHub when data changes (debounced)
  useEffect(() => {
    if (!githubToken || !githubUser || !autoSyncGithub) return;

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
  }, [data, githubToken, githubUser, autoSyncGithub, githubMode, repoOwner, repoName, repoPath]);

  // Handlers for Firebase
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (activeTab === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg('登录成功！已自动开启实时数据同步');
      } else {
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMsg('注册成功！您的数据已安全打通云端');
      }
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      const provider = new (window as any).firebase.auth.GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSuccessMsg('Google 账号已成功关联同步');
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Google sign-in popup was closed by user.');
      } else {
        console.error('Google Auth error:', err);
        setError(getAuthErrorMessage(err?.code || ''));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSyncStatus('idle');
      setLastSyncedTime(null);
      setSuccessMsg('已退出登录');
      setTimeout(() => setSuccessMsg(''), 1500);
    } catch (err: any) {
      setError('退出失败，请重试');
    }
  };

  const handleManualUpload = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setError('');
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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
        onRemoteUpdate(remoteData);
        setSyncStatus('synced');
        if (remoteData.updatedAt) {
          setLastSyncedTime(new Date(remoteData.updatedAt).toLocaleTimeString('zh-CN'));
        }
        setSuccessMsg('已从云端恢复最新数据');
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
      
      // Auto fill owner if empty
      if (!repoOwner) setRepoOwner(u.login);

      saveGitHubConfig(githubToken, githubMode, repoOwner || u.login, repoName, repoPath, gistInfo, autoSyncGithub);
      setGhSyncStatus('synced');
      setSuccessMsg(`验证成功！已连接 GitHub 账号: @${u.login}`);
      setTimeout(() => setSuccessMsg(''), 2500);
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
      setSuccessMsg(`从 GitHub 恢复成功！包含了 ${pulledData.watchlist?.length || 0} 只自选股、${pulledData.positions?.length || 0} 个持仓仓位`);
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
    <div className="relative" ref={containerRef}>
      {/* Header Sync Status Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer border transition-all duration-200 select-none shadow-sm ${
          isGithubActive
            ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700 hover:border-slate-500'
            : isFirebaseActive
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
            : 'bg-theme-bg-hover hover:bg-theme-border text-theme-text-muted hover:text-theme-text-primary border-theme-border'
        }`}
        title={
          isGithubActive
            ? `GitHub 已连接 (@${githubUser?.login}) - 实时数据同步`
            : user
            ? `已登录: ${user.email} (${syncStatus === 'synced' ? '云端已同步' : '同步中'})`
            : "数据备份与 GitHub 云同步"
        }
      >
        {isGithubActive ? (
          <GithubIcon size={13} className="text-white shrink-0" />
        ) : user ? (
          syncStatus === 'syncing' ? <RefreshCw size={13} className="animate-spin text-amber-500" /> : 
          syncStatus === 'synced' ? <Cloud size={13} /> : 
          <CloudOff size={13} />
        ) : (
          <GithubIcon size={13} className="text-slate-400 shrink-0" />
        )}

        <span className="text-[10px] font-bold hidden md:inline">
          {isGithubActive ? `GitHub: @${githubUser?.login}` : user ? (syncStatus === 'syncing' ? '同步中' : '已同步') : '数据同步'}
        </span>
      </div>

      {/* Non-Blocking Popover */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[1px] transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-[350px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl shadow-2xl z-[100] p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

            {/* ===================== MODE 2: FIREBASE CLOUD SYNC ===================== */}
            {providerMode === 'firebase' && (
              user ? (
                <div className="space-y-4">
                  {/* Account card */}
                  <div className="bg-theme-panel p-3.5 rounded-xl border border-theme-border-muted flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-xs">
                        {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-theme-text-muted flex items-center gap-1">
                          <UserCheck size={10} className="text-emerald-400" />
                          <span>已登录 Firebase</span>
                        </div>
                        <div className="text-xs font-bold text-theme-text-primary truncate" title={user.email || ''}>
                          {user.email || '已连接账号'}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                      syncStatus === 'synced' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}>
                      {syncStatus === 'syncing' ? '正在同步...' : syncStatus === 'synced' ? '云端已同步' : '网络异常'}
                    </div>
                  </div>

                  {/* Manual actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={handleManualUpload}
                      disabled={syncStatus === 'syncing'}
                      className="py-2 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <UploadCloud size={14} className="text-indigo-400" />
                      <span>手动推送</span>
                    </button>
                    <button 
                      onClick={handleManualPull}
                      disabled={syncStatus === 'syncing'}
                      className="py-2 px-3 rounded-xl bg-theme-bg-hover hover:bg-theme-border border border-theme-border text-theme-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <DownloadCloud size={14} className="text-emerald-400" />
                      <span>云端拉取</span>
                    </button>
                  </div>

                  {/* Logout button */}
                  <div className="pt-2 border-t border-theme-border flex justify-between items-center">
                    <button 
                      onClick={handleLogout}
                      className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>退出 Firebase 登录</span>
                    </button>
                    <span className="text-[10px] text-theme-text-muted">上次: {lastSyncedTime || '刚刚'}</span>
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
                  </div>

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
                      <label className="block text-[10px] font-bold text-theme-text-secondary uppercase mb-1 flex items-center gap-1">
                        <KeyRound size={11} className="text-indigo-400" />
                        <span>登录密码</span>
                      </label>
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
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
