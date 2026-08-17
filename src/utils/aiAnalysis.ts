// Client-side Gemini AI Analysis service using @google/genai SDK
import { GoogleGenAI } from "@google/genai";
import { Stock, safeTimeoutSignal } from "./stockApi";

const GEMINI_KEY_STORAGE = "stock_app_gemini_api_key_v1";

export function getStoredGeminiApiKey(): string {
  try {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // Ignore error
  }
  return ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || "";
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

  // 1. Try server-side API proxy first (which has built-in Gemini and Smart Quant Engine)
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

  // 2. Client-side fallback if custom/stored API key exists
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const position = req.positions?.find((p: any) => p.symbol === req.stock.symbol);
      let positionContext = "该用户目前没有持有此股票。";
      if (position) {
        positionContext = `该用户持有此股票：持仓数量 ${position.quantity} 股，平均成本价为 $${position.buyPrice}。当前价格 $${req.stock.currentPrice}。盈亏为: ${position.pnl >= 0 ? "盈利" : "亏损"} $${Math.abs(position.pnl).toFixed(2)} (${position.pnlPercent.toFixed(2)}%)。`;
      }

      const systemInstruction = `你是一位专业、客观、严谨的 AI 投资顾问。
请根据提供的股票当前数据、交易量、持仓情况等，为用户生成一份极高水准的个股与持仓分析报告。
请使用纯文本或结构化的 Markdown 格式（不使用外层 HTML），语言为中文。
回答应当分为：
1. 【股票概览】简要概括该股票最新状态与近期市场主线。
2. 【持仓评估】结合持仓均价和当前价格，给出具体的仓位管理建议（若未持仓，则分析当前的建仓时机和性价比）。
3. 【技术与估值研判】分析当前价位所处的技术支撑/阻力位，或估值高低。
4. 【操作策略与风险预警】给出明确的短期与中长期操作建议（如分批减仓、破位止损、逢低买入），并标出明确的风险等级（低/中/高）。`;

      let prompt = `股票代码: ${req.stock.symbol}
股票名称: ${req.stock.name}
当前参考价: $${req.stock.currentPrice}
昨日收盘价: $${req.stock.prevClose}
今日最高价: $${req.stock.high}
今日最低价: $${req.stock.low}
参考交易量: ${req.stock.volume.toLocaleString()}
${positionContext}
请依据以上实时行情，进行多维度深度解析，并针对我的仓位给出针对性建议。`;

      if (req.image?.base64 && req.image?.mimeType) {
        prompt += `\n\n[用户提供了一张参考图像，可能是当前走势K线截图、公司财报、相关新闻或报表。请结合此图像进行综合研判和多维度分析。]`;
      }

      let contents: any;
      if (req.image?.base64 && req.image?.mimeType) {
        const imagePart = {
          inlineData: {
            mimeType: req.image.mimeType,
            data: req.image.base64,
          },
        };
        const textPart = { text: prompt };
        contents = { parts: [imagePart, textPart] };
      } else {
        contents = prompt;
      }

      const modelsToTry: string[] = [];
      if (req.thinkingMode || req.image?.base64) {
        modelsToTry.push("gemini-3.1-pro-preview");
      }
      modelsToTry.push("gemini-3.6-flash");
      modelsToTry.push("gemini-3.1-flash-lite");

      for (const modelName of modelsToTry) {
        try {
          const currentConfig: any = { systemInstruction };
          if (req.thinkingMode && modelName === "gemini-3.1-pro-preview") {
            currentConfig.thinkingConfig = { thinkingLevel: "HIGH" };
          }

          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: currentConfig,
          });

          if (response && response.text) {
            return response.text;
          }
        } catch (err: any) {
          console.warn(`Analysis failed with model ${modelName}:`, err?.message || err);
        }
      }
    } catch (clientErr) {
      console.warn("Client Gemini call failed, using client quant fallback:", clientErr);
    }
  }

  // 3. Fallback Client-side Quant Report
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
