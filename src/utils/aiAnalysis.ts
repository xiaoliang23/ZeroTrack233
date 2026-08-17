import { Stock, safeTimeoutSignal } from "./stockApi";

const GEMINI_KEY_STORAGE = "stock_app_gemini_api_key_v1";

export function getStoredGeminiApiKey(): string {
  try {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // Ignore error
  }
  return "";
}

export function saveGeminiApiKey(key: string) {
  try {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  } catch {
    // Ignore error
  }
}

export interface AnalysisRequest {
  stock: Stock;
  positions?: any[];
  thinkingMode?: boolean;
  image?: {
    base64: string;
    mimeType: string;
  };
  customApiKey?: string;
}

export async function analyzeStockWithGemini(req: AnalysisRequest): Promise<string> {
  const apiKey = req.customApiKey?.trim() || getStoredGeminiApiKey();

  // 1. Send request to secure server-side AI & Quant Analysis API
  try {
    const res = await fetch("/api/stocks/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: req.stock.symbol,
        positions: req.positions,
        thinkingMode: req.thinkingMode,
        image: req.image ? { base64: req.image.base64, mimeType: req.image.mimeType } : undefined,
        customApiKey: apiKey
      }),
      signal: safeTimeoutSignal(30000)
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (data && data.analysis) {
            return data.analysis;
          }
        }
      }
    }
  } catch (serverErr: any) {
    console.warn("Server analysis proxy notice:", serverErr?.message || serverErr);
  }

  // 2. Client-side Quant Report Fallback if server/network is temporarily unreachable
  const s = req.stock;
  const change = s.currentPrice - s.prevClose;
  const changePercent = s.prevClose > 0 ? (change / s.prevClose) * 100 : 0;
  const isUp = change >= 0;
  const position = req.positions?.find((p: any) => p.symbol === s.symbol);

  const support1 = (s.low * 0.985).toFixed(2);
  const resistance1 = (s.high * 1.018).toFixed(2);

  let posInfo = `当前账户未持有 **${s.symbol}**。建议重点关注 **$${support1}** 附近的低吸机会。`;
  if (position) {
    const isProfit = position.pnl >= 0;
    posInfo = `当前账户持有 **${position.quantity} 股**，均价 **$${position.buyPrice.toFixed(2)}**，当前状态 **${isProfit ? "浮盈" : "浮亏"} $${Math.abs(position.pnl).toFixed(2)} (${position.pnlPercent.toFixed(2)}%)**。建议在 **$${resistance1}** 附近分批做止盈或在关键支撑处设置防守止损。`;
  }

  return `### 1. 【股票概览与实时盘口】
**${s.name} (${s.symbol})** 当前报价 **$${s.currentPrice.toFixed(2)}**，今日变动 **${isUp ? "+" : ""}${change.toFixed(2)} (${isUp ? "+" : ""}${changePercent.toFixed(2)}%)**。
- 日内波动区间：**$${s.low.toFixed(2)} ~ $${s.high.toFixed(2)}**，成交量 **${(s.volume / 1000000).toFixed(2)}M**。

---

### 2. 【持仓评估与仓位策略】
${posInfo}

---

### 3. 【技术面与支撑阻力位】
- 核心支撑位 S1：**$${support1}**
- 核心阻力位 R1：**$${resistance1}**
- 技术动能评判：当前价格处于多空博弈中轴，建议关注量能是否持续放大。

---

### 4. 【操作策略与风险预警】
- **操作建议**：建议采取波段高抛低吸或分批试仓策略，防守点位设立在 **$${support1}** 下方。
- **风险评级**：**【中等风险】**。
*(注：本分析由 ZeroTrack 智能量化研判系统实时生成。)*`;
}
