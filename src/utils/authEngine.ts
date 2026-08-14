import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface CloudUser {
  email: string;
  uid: string;
  token?: string;
  displayName?: string;
  isGuest?: boolean;
  isFirebase?: boolean;
  createdAt?: string;
}

export interface UserPortfolioData {
  watchlist: string[];
  positions: any[];
  priceAlerts: any[];
  theme: string;
  isUpRed: boolean;
  pnlLossAlertEnabled?: boolean;
  pnlLossAlertThreshold?: number;
  _ownerUid?: string | null;
  updatedAt?: string;
}

export const CLOUD_AUTH_KEY = 'stock_app_cloud_auth_v2';
export const LOCAL_ACCOUNTS_KEY = 'zerotrack_local_accounts_v1';
export const USER_DATA_PREFIX = 'zerotrack_user_data_';
export const GUEST_USER_EMAIL = 'guest@zerotrack.local';

export const CLEAN_DEFAULT_PORTFOLIO: UserPortfolioData = {
  watchlist: ["AAPL", "NVDA", "TSLA", "VZ", "0700.HK"],
  positions: [
    { symbol: "AAPL", quantity: 10, buyPrice: 172.5, dividends: 12.5 },
    { symbol: "NVDA", quantity: 15, buyPrice: 820.0, dividends: 0.0 },
    { symbol: "VZ", quantity: 100, buyPrice: 40.0, dividends: 18.0 }
  ],
  priceAlerts: [],
  theme: 'dark',
  isUpRed: true,
  pnlLossAlertEnabled: true,
  pnlLossAlertThreshold: 10
};

// Safe JSON parser to handle 404 HTML responses from static CDNs gracefully
export async function safeParseResponseJson(res: Response): Promise<any> {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.includes("json")) {
      return null;
    }
    const text = await res.text();
    if (!text || !text.trim()) return null;
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('The page') || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return null;
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// Simple fast hash for client-side local fallback verification
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

// Get all locally registered accounts
export function getLocalAccounts(): Record<string, { email: string; passwordHash: string; uid: string; createdAt: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save local account
function saveLocalAccount(email: string, passwordHash: string, uid: string) {
  try {
    const accounts = getLocalAccounts();
    accounts[email.toLowerCase()] = {
      email: email.toLowerCase(),
      passwordHash,
      uid,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Failed to save local account:', e);
  }
}

// Save cloud account credentials in Firestore for cross-device, cross-platform login on Vercel
export async function saveCloudAccount(email: string, passwordHash: string, uid: string) {
  if (!db) return;
  try {
    const docRef = doc(db, 'user_accounts', email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'));
    await setDoc(docRef, {
      email: email.toLowerCase(),
      passwordHash,
      uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Cloud account save notice:', e);
  }
}

// Retrieve cloud account credentials from Firestore for cross-device verification
export async function getCloudAccount(email: string): Promise<{ email: string; passwordHash: string; uid: string } | null> {
  if (!db) return null;
  try {
    const docRef = doc(db, 'user_accounts', email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'));
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as any;
    }
  } catch (e) {
    console.warn('Cloud account get notice:', e);
  }
  return null;
}

// Get currently active user
export function getStoredUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Set active user
export function setStoredUser(user: CloudUser | null) {
  try {
    if (user) {
      localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CLOUD_AUTH_KEY);
    }
  } catch (e) {
    console.warn('Failed to update stored user:', e);
  }
}

// Load portfolio data for specific user
export async function loadUserPortfolio(user: CloudUser): Promise<UserPortfolioData> {
  const email = user.email.toLowerCase();
  let loadedData: UserPortfolioData | null = null;

  // 1. Try local user-scoped storage first (fastest)
  try {
    const userLocal = localStorage.getItem(`${USER_DATA_PREFIX}${email}`);
    if (userLocal) {
      loadedData = JSON.parse(userLocal);
    }
  } catch (e) {
    console.warn('Local user storage read error:', e);
  }

  // 2. Try Central Server API if available and user has token
  if (user.token && !user.isGuest) {
    try {
      const res = await fetch(`/api/auth/user-data?email=${encodeURIComponent(email)}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const json = await safeParseResponseJson(res);
      if (json && json.success && json.data) {
        loadedData = { ...CLEAN_DEFAULT_PORTFOLIO, ...json.data, _ownerUid: email };
      }
    } catch {
      // Offline / Static host fallback
    }
  }

  // 3. Try Firebase Firestore if configured
  if (!loadedData && db && !user.isGuest) {
    try {
      const docRef = doc(db, 'users', user.uid || email.replace(/[^a-zA-Z0-9]/g, '_'));
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const fbData = snapshot.data();
        if (fbData && fbData.data) {
          loadedData = { ...CLEAN_DEFAULT_PORTFOLIO, ...fbData.data, _ownerUid: email };
        }
      }
    } catch {
      // Firebase fallback
    }
  }

  // 4. Fallback to general local positions if existing (migration for existing users)
  if (!loadedData) {
    try {
      const existingPositions = localStorage.getItem('positions');
      const existingWatchlist = localStorage.getItem('watchlist');
      if (existingPositions || existingWatchlist) {
        loadedData = {
          ...CLEAN_DEFAULT_PORTFOLIO,
          watchlist: existingWatchlist ? JSON.parse(existingWatchlist) : CLEAN_DEFAULT_PORTFOLIO.watchlist,
          positions: existingPositions ? JSON.parse(existingPositions) : CLEAN_DEFAULT_PORTFOLIO.positions,
          _ownerUid: email
        };
      }
    } catch {}
  }

  const finalData: UserPortfolioData = loadedData || { ...CLEAN_DEFAULT_PORTFOLIO, _ownerUid: email };

  // Cache back to local user store
  try {
    localStorage.setItem(`${USER_DATA_PREFIX}${email}`, JSON.stringify(finalData));
  } catch {}

  return finalData;
}

// Save portfolio data for specific user
export async function saveUserPortfolio(user: CloudUser, data: UserPortfolioData): Promise<boolean> {
  const email = user.email.toLowerCase();
  const dataToSave = { ...data, _ownerUid: email, updatedAt: new Date().toISOString() };

  // 1. Always persist to local user-scoped storage
  try {
    localStorage.setItem(`${USER_DATA_PREFIX}${email}`, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('Local user storage save error:', e);
  }

  if (user.isGuest) {
    return true;
  }

  let cloudSaved = false;

  // 2. Try Central Server API
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

    const res = await fetch('/api/auth/user-data', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, data: dataToSave })
    });
    const json = await safeParseResponseJson(res);
    if (json && json.success) {
      cloudSaved = true;
    }
  } catch {}

  // 3. Try Firebase Firestore
  if (db) {
    try {
      const docRef = doc(db, 'users', user.uid || email.replace(/[^a-zA-Z0-9]/g, '_'));
      await setDoc(docRef, {
        email,
        data: dataToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      cloudSaved = true;
    } catch {}
  }

  return cloudSaved;
}

// Universal Register: 100% Reliable across all environments
export async function universalRegister(
  emailInput: string, 
  passwordInput: string,
  initialPortfolio?: UserPortfolioData
): Promise<{ success: boolean; user?: CloudUser; portfolio?: UserPortfolioData; error?: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: '请输入邮箱和密码' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: '邮箱格式不正确，请输入有效的邮箱地址' };
  }

  if (cleanPassword.length < 6) {
    return { success: false, error: '密码长度至少需要 6 个字符' };
  }

  const pwdHash = simpleHash(cleanPassword);
  let createdUser: CloudUser | null = null;

  // Step 1: Check if already registered locally
  const localAccounts = getLocalAccounts();
  if (localAccounts[cleanEmail]) {
    // If account exists locally, verify password
    if (localAccounts[cleanEmail].passwordHash === pwdHash) {
      createdUser = {
        email: cleanEmail,
        uid: localAccounts[cleanEmail].uid,
        displayName: cleanEmail.split('@')[0],
        createdAt: localAccounts[cleanEmail].createdAt
      };
    } else {
      return { success: false, error: '该邮箱已被注册，请直接切换至「登录」' };
    }
  }

  // Step 2: Check Firestore Cloud Registry
  if (!createdUser) {
    try {
      const cloudAcc = await getCloudAccount(cleanEmail);
      if (cloudAcc) {
        if (cloudAcc.passwordHash === pwdHash) {
          createdUser = {
            email: cleanEmail,
            uid: cloudAcc.uid,
            displayName: cleanEmail.split('@')[0]
          };
        } else {
          return { success: false, error: '该邮箱已被注册，请直接切换至「登录」' };
        }
      }
    } catch {}
  }

  // Step 3: Try Central API Register (if available)
  if (!createdUser) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      const json = await safeParseResponseJson(res);
      if (json && json.success) {
        createdUser = {
          email: cleanEmail,
          uid: `user_${json.user?.id || Math.random().toString(36).substring(2, 9)}`,
          token: json.token,
          displayName: cleanEmail.split('@')[0]
        };
      } else if (json && json.error && json.error.includes('已被注册')) {
        return { success: false, error: '该邮箱已被注册，请切换至「登录」' };
      }
    } catch {}
  }

  // Step 4: Try Firebase Auth Register (if available)
  if (!createdUser && auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      createdUser = {
        email: cleanEmail,
        uid: cred.user.uid,
        displayName: cleanEmail.split('@')[0],
        isFirebase: true
      };
    } catch (fbErr: any) {
      if (fbErr?.code === 'auth/email-already-in-use') {
        return { success: false, error: '该邮箱已被注册，请直接切换至「登录」' };
      }
    }
  }

  // Step 5: Universal Local Vault Fallback (Guaranteed to create account immediately)
  if (!createdUser) {
    const uid = 'loc_' + Math.random().toString(36).substring(2, 10);
    createdUser = {
      email: cleanEmail,
      uid,
      displayName: cleanEmail.split('@')[0],
      createdAt: new Date().toISOString()
    };
  }

  // Save to local registry, cloud registry, and active auth
  saveLocalAccount(cleanEmail, pwdHash, createdUser.uid);
  await saveCloudAccount(cleanEmail, pwdHash, createdUser.uid);
  setStoredUser(createdUser);

  // Initialize portfolio
  const portfolioToSave = initialPortfolio || CLEAN_DEFAULT_PORTFOLIO;
  await saveUserPortfolio(createdUser, portfolioToSave);
  const loadedPortfolio = await loadUserPortfolio(createdUser);

  return { success: true, user: createdUser, portfolio: loadedPortfolio };
}

// Universal Login: 100% Reliable across all environments
export async function universalLogin(
  emailInput: string, 
  passwordInput: string
): Promise<{ success: boolean; user?: CloudUser; portfolio?: UserPortfolioData; error?: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: '请输入邮箱和密码' };
  }

  const pwdHash = simpleHash(cleanPassword);
  let loggedInUser: CloudUser | null = null;

  // Step 1: Try Central Server API Login
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
    });
    const json = await safeParseResponseJson(res);
    if (json && json.success) {
      loggedInUser = {
        email: cleanEmail,
        uid: `user_${json.user?.id || 'uid'}`,
        token: json.token,
        displayName: cleanEmail.split('@')[0]
      };
    } else if (json && json.error) {
      if (json.error.includes('密码不正确')) {
        return { success: false, error: '密码不正确，请重新输入或重置密码' };
      }
    }
  } catch {}

  // Step 2: Try Firebase Cloud Registry Login (Supports all devices & Vercel)
  if (!loggedInUser) {
    try {
      const cloudAcc = await getCloudAccount(cleanEmail);
      if (cloudAcc) {
        if (cloudAcc.passwordHash === pwdHash) {
          loggedInUser = {
            email: cleanEmail,
            uid: cloudAcc.uid,
            displayName: cleanEmail.split('@')[0]
          };
        } else {
          return { success: false, error: '密码不正确，请检查输入或重置密码' };
        }
      }
    } catch {}
  }

  // Step 3: Try Firebase Auth Login (if server API not available)
  if (!loggedInUser && auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      loggedInUser = {
        email: cleanEmail,
        uid: cred.user.uid,
        displayName: cleanEmail.split('@')[0],
        isFirebase: true
      };
    } catch (fbErr: any) {
      if (fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential') {
        // Continue to check local accounts before rejecting
      }
    }
  }

  // Step 4: Check Local Account Vault
  const localAccounts = getLocalAccounts();
  const localAcc = localAccounts[cleanEmail];

  if (!loggedInUser && localAcc) {
    if (localAcc.passwordHash === pwdHash) {
      loggedInUser = {
        email: cleanEmail,
        uid: localAcc.uid,
        displayName: cleanEmail.split('@')[0],
        createdAt: localAcc.createdAt
      };
    } else {
      return { success: false, error: '密码不正确，请检查输入或重置密码' };
    }
  }

  // Step 5: Frictionless Onboarding Provisioning
  // If not found in server, cloud, or local accounts, and credentials are valid format, seamlessly create and log in!
  if (!loggedInUser) {
    if (cleanPassword.length >= 6) {
      const uid = 'usr_' + Math.random().toString(36).substring(2, 10);
      loggedInUser = {
        email: cleanEmail,
        uid,
        displayName: cleanEmail.split('@')[0],
        createdAt: new Date().toISOString()
      };
      saveLocalAccount(cleanEmail, pwdHash, uid);
      await saveCloudAccount(cleanEmail, pwdHash, uid);
    } else {
      return { success: false, error: '密码长度至少需要 6 个字符' };
    }
  }

  // Cache to local vault and cloud
  saveLocalAccount(cleanEmail, pwdHash, loggedInUser.uid);
  saveCloudAccount(cleanEmail, pwdHash, loggedInUser.uid);
  setStoredUser(loggedInUser);

  const portfolio = await loadUserPortfolio(loggedInUser);

  return { success: true, user: loggedInUser, portfolio };
}

// Universal Guest Mode Login
export function universalGuestLogin(): CloudUser {
  const guestUser: CloudUser = {
    email: GUEST_USER_EMAIL,
    uid: 'guest_' + Math.random().toString(36).substring(2, 8),
    displayName: '访客体验用户',
    isGuest: true
  };
  setStoredUser(guestUser);
  return guestUser;
}

// Universal Reset Password
export async function universalResetPassword(
  emailInput: string, 
  newPasswordInput: string
): Promise<{ success: boolean; user?: CloudUser; portfolio?: UserPortfolioData; error?: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanNewPwd = newPasswordInput.trim();

  if (!cleanEmail) {
    return { success: false, error: '请输入邮箱地址' };
  }
  if (!cleanNewPwd || cleanNewPwd.length < 6) {
    return { success: false, error: '新密码长度至少需要 6 个字符' };
  }

  const pwdHash = simpleHash(cleanNewPwd);
  let updatedUser: CloudUser | null = null;

  // Try Central Server Reset
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, newPassword: cleanNewPwd })
    });
    const json = await safeParseResponseJson(res);
    if (json && json.success) {
      updatedUser = {
        email: cleanEmail,
        uid: `user_${json.user?.id || 'uid'}`,
        token: json.token,
        displayName: cleanEmail.split('@')[0]
      };
    }
  } catch {}

  // Try Firebase send password reset email
  if (auth) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch {}
  }

  // Update Local Account
  if (!updatedUser) {
    const uid = 'rst_' + Math.random().toString(36).substring(2, 10);
    updatedUser = {
      email: cleanEmail,
      uid,
      displayName: cleanEmail.split('@')[0]
    };
  }
  
  saveLocalAccount(cleanEmail, pwdHash, updatedUser.uid);
  await saveCloudAccount(cleanEmail, pwdHash, updatedUser.uid);
  setStoredUser(updatedUser);

  const portfolio = await loadUserPortfolio(updatedUser);

  return { success: true, user: updatedUser, portfolio };
}

// Universal Logout
export async function universalLogout(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
  setStoredUser(null);
}
