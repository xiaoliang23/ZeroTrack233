import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  UserCheck, 
  Sparkles, 
  Globe, 
  Smartphone, 
  Monitor, 
  KeyRound,
  Compass,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { 
  CloudUser, 
  universalLogin, 
  universalRegister, 
  universalGuestLogin, 
  universalResetPassword,
  loadUserPortfolio,
  UserPortfolioData
} from '../utils/authEngine';
import { verifyGitHubToken, syncGistPull } from '../utils/githubSync';
import { EasterEggLogo } from './EasterEggLogo';

interface AuthGuardProps {
  isOpen: boolean;
  onAuthenticated: (user: CloudUser, data: UserPortfolioData) => void;
  onClose?: () => void;
  allowDismiss?: boolean;
}

export default function AuthGuard({ isOpen, onAuthenticated, onClose, allowDismiss = false }: AuthGuardProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'guest' | 'github' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await universalLogin(email, password);
      if (result.success && result.user) {
        setSuccessMsg('登录成功！正在加载您的专属持仓数据...');
        const portfolioData = await loadUserPortfolio(result.user);
        setTimeout(() => {
          onAuthenticated(result.user!, portfolioData);
        }, 600);
      } else {
        setError(result.error || '登录失败，请检查账号密码');
      }
    } catch (err: any) {
      setError(err?.message || '登录遇到异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const result = await universalRegister(email, password);
      if (result.success && result.user) {
        setSuccessMsg('注册成功！已为您建立全平台多端云账户');
        const portfolioData = await loadUserPortfolio(result.user);
        setTimeout(() => {
          onAuthenticated(result.user!, portfolioData);
        }, 800);
      } else {
        setError(result.error || '注册失败，请稍后重试');
      }
    } catch (err: any) {
      setError(err?.message || '注册发生异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const guest = universalGuestLogin();
      setSuccessMsg('已开启免密体验模式！随时可在右上角注册绑定');
      const portfolioData = await loadUserPortfolio(guest);
      setTimeout(() => {
        onAuthenticated(guest, portfolioData);
      }, 500);
    } catch (err: any) {
      setError('开启体验模式失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await universalResetPassword(email, newPassword);
      if (result.success && result.user) {
        setSuccessMsg('密码已重置并自动登录！正在同步持仓...');
        const portfolioData = await loadUserPortfolio(result.user);
        setTimeout(() => {
          onAuthenticated(result.user!, portfolioData);
        }, 800);
      } else {
        setError(result.error || '重置密码失败');
      }
    } catch (err: any) {
      setError(err?.message || '重置密码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!ghToken.trim()) {
      setError('请输入 GitHub Personal Access Token');
      return;
    }

    setLoading(true);
    try {
      const ghUser = await verifyGitHubToken(ghToken.trim());
      setSuccessMsg(`GitHub 账号 @${ghUser.login} 验证成功，正在恢复持仓...`);
      
      const gistRes = await syncGistPull(ghToken.trim());
      const gistData = gistRes.data;
      const customUser: CloudUser = {
        email: `${ghUser.login}@github.oauth`,
        uid: `gh_${ghUser.login}`,
        displayName: ghUser.name || ghUser.login
      };

      const finalPortfolio: UserPortfolioData = {
        watchlist: gistData.watchlist || ["AAPL", "NVDA", "TSLA"],
        positions: gistData.positions || [],
        priceAlerts: gistData.priceAlerts || [],
        theme: gistData.theme || 'dark',
        isUpRed: gistData.isUpRed !== undefined ? gistData.isUpRed : true,
        pnlLossAlertEnabled: gistData.pnlLossAlertEnabled !== undefined ? gistData.pnlLossAlertEnabled : true,
        pnlLossAlertThreshold: gistData.pnlLossAlertThreshold || 10,
        _ownerUid: customUser.email
      };

      setTimeout(() => {
        onAuthenticated(customUser, finalPortfolio);
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'GitHub 同步失败，请检查 Token 权限');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-xl animate-fade-in font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-[140px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg bg-slate-900/95 border border-slate-800/90 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden relative z-10 backdrop-blur-2xl text-slate-100"
      >
        {/* Top brand header */}
        <div className="p-6 sm:p-8 pb-4 text-center relative border-b border-slate-800/60 bg-gradient-to-b from-slate-800/40 to-transparent">
          {allowDismiss && onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          )}

          <div className="flex justify-center mb-4">
            <EasterEggLogo size="lg" showTitle={false} />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            ZeroTrack 资产守卫
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            全平台（PC / iPhone / Android）实时行情盯盘与持仓云端同步
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl mt-5">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                tab === 'login' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              账号登录
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                tab === 'register' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              快速注册
            </button>
            <button
              type="button"
              onClick={() => { setTab('guest'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                tab === 'guest' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              免密体验
            </button>
            <button
              type="button"
              onClick={() => { setTab('github'); setError(''); setSuccessMsg(''); }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                tab === 'github' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="GitHub Gist 同步"
            >
              GitHub
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 pt-6">
          {/* Alerts / Error / Success message */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-xs sm:text-sm">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-400" />
              <div className="leading-snug">{successMsg}</div>
            </div>
          )}

          {/* TAB: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  登录邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    登录密码
                  </label>
                  <button
                    type="button"
                    onClick={() => { setTab('reset'); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码（至少 6 位）"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm mt-6 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在登录并同步持仓...</span>
                  </>
                ) : (
                  <>
                    <span>立即登录</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-400">
                  还没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('register'); setError(''); setSuccessMsg(''); }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-2"
                  >
                    立即免费注册
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* TAB: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  注册邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  设置密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="设置密码（至少 6 位）"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入相同密码"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm mt-6 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在创建账号...</span>
                  </>
                ) : (
                  <>
                    <span>立即免费开通</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-400">
                  已有账号？{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-2"
                  >
                    直接登录
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* TAB: GUEST MODE */}
          {tab === 'guest' && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles size={28} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">
                  免账号直接体验
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  无需输入密码或邮箱，您的持仓记录将完整保存在本台设备（PC / iPhone）本地。随时可以在右上角无缝注册绑定云端。
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-left space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>实时美股/港股全行情盯盘与盈亏核算</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>自主录入买入成本与加权均价核算</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>支持随时一键升级并跨端同步到手机</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>进入免密体验</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB: GITHUB GIST SYNC */}
          {tab === 'github' && (
            <form onSubmit={handleGitHubSync} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  GitHub Personal Access Token
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  仅需勾选 GitHub Token 的 <code className="text-indigo-300 font-mono">gist</code> 权限，即可通过私人 Gist 跨设备无缝同步持仓。
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 text-sm mt-4 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在连接 GitHub...</span>
                  </>
                ) : (
                  <>
                    <span>连接 GitHub 并同步</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB: RESET PASSWORD */}
          {tab === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  账号邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  设置新密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入新密码（至少 6 位）"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm mt-4 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <span>确认重置并登录</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-slate-400 hover:text-slate-200 font-bold"
                >
                  返回登录
                </button>
              </div>
            </form>
          )}

          {/* Bottom Trust Badge */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>端到端持久化与安全防护</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Monitor size={12} /> PC
              </span>
              <span className="flex items-center gap-1">
                <Smartphone size={12} /> iOS / Android
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
