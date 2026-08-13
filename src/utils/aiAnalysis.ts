// Client-side Gemini AI Analysis service using @google/genai SDK
import { GoogleGenAI } from "@google/genai";
import { Stock } from "./stockApi";

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

  // 1. Try server-side API proxy first
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
      signal: AbortSignal.timeout(30000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.analysis) {
        return data.analysis;
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData && errData.error && !apiKey) {
        throw new Error(errData.error);
      }
    }
  } catch (serverErr: any) {
    if (serverErr?.message && !serverErr.message.toLowerCase().includes("fetch") && !serverErr.message.toLowerCase().includes("network")) {
      throw serverErr;
    }
    // Fallback to client-side SDK if server endpoint is unreachable or static deployment
  }

  // 2. Client-side fallback if custom/stored API key exists
  if (!apiKey) {
    throw new Error(
      "未检测到 Gemini API Key。请在 AI 分析界面右上角点击“设置 API Key”，输入您的 Gemini Key 即可开启智能分析！"
    );
  }

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

    let responseText = "";
    let lastError: any = null;

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
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Analysis failed with model ${modelName}:`, err?.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      const rawMsg = String(lastError?.message || lastError || "");
      if (rawMsg.toLowerCase().includes("fetch") || rawMsg.toLowerCase().includes("network")) {
        throw new Error("网络连接失败，无法连接到 Gemini AI 分析服务。请检查网络或在右上方配置您的 API Key。");
      }
      throw new Error(rawMsg || "Gemini AI 服务响应失败，请检查您的 API Key 是否有效。");
    }

    return responseText;
  } catch (err: any) {
    const rawMsg = String(err?.message || err || "");
    if (rawMsg.toLowerCase().includes("fetch") || rawMsg.toLowerCase().includes("network")) {
      throw new Error("网络连接失败，无法连接到 Gemini AI 分析服务。请检查网络或在右上方配置您的 API Key。");
    }
    throw err;
  }
}
