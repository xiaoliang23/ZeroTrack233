// GitHub Data Synchronization Utility

export interface GitHubSyncPayload {
  version: string;
  updatedAt: string;
  watchlist: string[];
  positions: any[];
  priceAlerts: any[];
  theme: string;
  isUpRed: boolean;
  pnlLossAlertEnabled?: boolean;
  pnlLossAlertThreshold?: number;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubGistInfo {
  id: string;
  html_url: string;
  updated_at: string;
  filename: string;
}

// UTF-8 safe Base64 encoding/decoding for GitHub API
export function toBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function fromBase64(base64Str: string): string {
  const cleanBase64 = base64Str.replace(/\s/g, '');
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(cleanBase64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

const GIST_FILENAME = 'stock_trading_dashboard_data.json';
const GIST_DESCRIPTION = '股票交易数据备份与多端同步文件 (Stock Trading Dashboard Data)';

// Safe parse JSON from response
async function safeParseJson(res: Response): Promise<any> {
  try {
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

/**
 * Validate GitHub Personal Access Token & return User info
 */
export async function verifyGitHubToken(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('GitHub Personal Access Token 无效或已过期');
    }
    throw new Error(`GitHub API 验证失败 (${res.status})`);
  }

  const user = await safeParseJson(res);
  if (!user || !user.login) {
    throw new Error('GitHub 响应格式无效，请检查网络或 Token 权限');
  }
  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
  };
}

/**
 * Find existing Gist or create a new Gist for Stock App data
 */
export async function syncGistSave(
  token: string,
  data: GitHubSyncPayload,
  gistId?: string
): Promise<GitHubGistInfo> {
  const cleanToken = token.trim();
  const jsonContent = JSON.stringify(data, null, 2);

  // 1. If gistId provided, try to update it directly
  if (gistId) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          files: {
            [GIST_FILENAME]: {
              content: jsonContent,
            },
          },
        }),
      });

      if (res.ok) {
        const gist = await safeParseJson(res);
        if (gist && gist.id) {
          return {
            id: gist.id,
            html_url: gist.html_url,
            updated_at: gist.updated_at,
            filename: GIST_FILENAME,
          };
        }
      }
    } catch {
      // Fall through to auto search or create
    }
  }

  // 2. Search user's existing Gists for matching filename
  const listRes = await fetch('https://api.github.com/gists', {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (listRes.ok) {
    const gists = await safeParseJson(listRes);
    const existingGist = Array.isArray(gists) ? gists.find((g) => g.files && g.files[GIST_FILENAME]) : null;

    if (existingGist) {
      // Update existing gist found
      const patchRes = await fetch(`https://api.github.com/gists/${existingGist.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          files: {
            [GIST_FILENAME]: {
              content: jsonContent,
            },
          },
        }),
      });

      if (patchRes.ok) {
        const updated = await safeParseJson(patchRes);
        if (updated && updated.id) {
          return {
            id: updated.id,
            html_url: updated.html_url,
            updated_at: updated.updated_at,
            filename: GIST_FILENAME,
          };
        }
      }
    }
  }

  // 3. Create a brand new Gist
  const createRes = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false, // Secret Gist
      files: {
        [GIST_FILENAME]: {
          content: jsonContent,
        },
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`创建 GitHub Gist 失败 (${createRes.status})，请确认 Token 具备 'gist' 权限`);
  }

  const created = await safeParseJson(createRes);
  if (!created || !created.id) {
    throw new Error('创建 Gist 失败，GitHub 返回数据异常');
  }
  return {
    id: created.id,
    html_url: created.html_url,
    updated_at: created.updated_at,
    filename: GIST_FILENAME,
  };
}

/**
 * Pull data from a GitHub Gist
 */
export async function syncGistPull(
  token: string,
  gistId?: string
): Promise<{ data: GitHubSyncPayload; gistInfo: GitHubGistInfo }> {
  const cleanToken = token.trim();
  let targetId = gistId;

  if (!targetId) {
    // Find gist ID from user's gists list
    const listRes = await fetch('https://api.github.com/gists', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!listRes.ok) {
      throw new Error(`获取 GitHub Gist 列表失败 (${listRes.status})`);
    }

    const gists = await safeParseJson(listRes);
    const existing = Array.isArray(gists) ? gists.find((g: any) => g.files && g.files[GIST_FILENAME]) : null;
    if (!existing) {
      throw new Error('未在您的 GitHub 账号中找到包含股票数据的 Gist 备份文件');
    }
    targetId = existing.id;
  }

  const getRes = await fetch(`https://api.github.com/gists/${targetId}`, {
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!getRes.ok) {
    throw new Error(`拉取 Gist 失败 (${getRes.status})`);
  }

  const gist = await safeParseJson(getRes);
  if (!gist || !gist.files) {
    throw new Error('Gist 数据格式异常');
  }
  const fileObj = gist.files?.[GIST_FILENAME] || Object.values(gist.files || {})[0] as any;

  if (!fileObj || !fileObj.content) {
    throw new Error('Gist 文件内容为空或格式无效');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fileObj.content);
  } catch {
    throw new Error('Gist 数据格式解析失败，非有效 JSON 格式');
  }

  return {
    data: parsed,
    gistInfo: {
      id: gist.id,
      html_url: gist.html_url,
      updated_at: gist.updated_at,
      filename: fileObj.filename || GIST_FILENAME,
    },
  };
}

/**
 * Save data to GitHub Repo file
 */
export async function pushToGitHubRepo(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  data: GitHubSyncPayload
): Promise<{ sha: string; html_url: string; updated_at: string }> {
  const cleanToken = token.trim();
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const cleanPath = filePath.trim().replace(/^\//, '');

  if (!cleanOwner || !cleanRepo || !cleanPath) {
    throw new Error('请完整填写 GitHub 仓库 Owner、Repo 名字与文件路径');
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const base64Content = toBase64(jsonContent);

  // Get current file SHA if exists
  let existingSha: string | undefined;
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/contents/${cleanPath}`,
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (getRes.ok) {
      const fileData = await safeParseJson(getRes);
      if (fileData) existingSha = fileData.sha;
    }
  } catch {
    // File may not exist yet
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/contents/${cleanPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `sync: update stock dashboard data (${new Date().toLocaleString('zh-CN')})`,
        content: base64Content,
        sha: existingSha,
      }),
    }
  );

  if (!putRes.ok) {
    if (putRes.status === 404) {
      throw new Error('找不到指定的 GitHub 仓库或文件路径，请检查仓库权限与名称');
    }
    throw new Error(`更新 GitHub 仓库文件失败 (${putRes.status})`);
  }

  const resData = await safeParseJson(putRes);
  if (!resData || !resData.content) {
    throw new Error('更新 GitHub 仓库失败，响应格式异常');
  }
  return {
    sha: resData.content.sha,
    html_url: resData.content.html_url,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Pull data from GitHub Repo file
 */
export async function pullFromGitHubRepo(
  token: string,
  owner: string,
  repo: string,
  filePath: string
): Promise<{ data: GitHubSyncPayload; html_url: string }> {
  const cleanToken = token.trim();
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const cleanPath = filePath.trim().replace(/^\//, '');

  const getRes = await fetch(
    `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/contents/${cleanPath}`,
    {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!getRes.ok) {
    if (getRes.status === 404) {
      throw new Error(`未在仓库 ${cleanOwner}/${cleanRepo} 中找到路径 ${cleanPath}`);
    }
    throw new Error(`读取 GitHub 仓库文件失败 (${getRes.status})`);
  }

  const fileData = await safeParseJson(getRes);
  if (!fileData || !fileData.content) {
    throw new Error('仓库文件为空或解析失败');
  }

  const decodedJson = fromBase64(fileData.content);
  let parsed: any;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    throw new Error('仓库文件内容非有效 JSON');
  }

  return {
    data: parsed,
    html_url: fileData.html_url,
  };
}
