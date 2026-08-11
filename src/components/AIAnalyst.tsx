import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, AlertCircle, TrendingUp, ShieldAlert, LineChart, Brain, Image, X, Key, Check } from "lucide-react";
import { getStoredGeminiApiKey, saveGeminiApiKey } from "../utils/aiAnalysis";

interface AIAnalystProps {
  symbol: string;
  name: string;
  analysis: string | null;
  loading: boolean;
  error: string | null;
  onAnalyze: (thinkingMode: boolean, image: { base64: string; mimeType: string } | null) => void;
  theme?: string;
}

export default function AIAnalyst({
  symbol,
  name,
  analysis,
  loading,
  error,
  onAnalyze,
  theme = "dark"
}: AIAnalystProps) {
  const [thinkingMode, setThinkingMode] = useState(false);
  const [image, setImage] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = getStoredGeminiApiKey();
    setHasApiKey(!!key);
    if (key) setApiKeyInput(key);
  }, [showKeyModal]);

  const handleSaveKey = () => {
    saveGeminiApiKey(apiKeyInput.trim());
    setHasApiKey(!!apiKeyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowKeyModal(false);
    }, 1000);
  };

  // Handle file select/drag-and-drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("请上传有效的图片文件 (PNG, JPG, JPEG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("为了保证传输效率，图片大小建议在 5MB 以内");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setImage({
        base64: base64Data,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Simple and robust parser to style markdown text neatly
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    const formatInline = (str: string) => {
      if (!str.includes("**")) return str;
      const parts = str.split("**");
      return parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx} className="text-indigo-400 font-semibold">{part}</strong>;
        }
        return part;
      });
    };

    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Headers
      if (line.startsWith("###")) {
        return (
          <h4 key={idx} className="text-base font-bold text-theme-text-heading mt-5 mb-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
            {formatInline(line.replace("###", "").trim())}
          </h4>
        );
      }
      if (line.startsWith("##") || line.startsWith("【")) {
        // Find icons for sections
        let Icon = LineChart;
        if (line.includes("持仓") || line.includes("评估")) Icon = TrendingUp;
        if (line.includes("技术") || line.includes("研判")) Icon = LineChart;
        if (line.includes("策略") || line.includes("风险")) Icon = ShieldAlert;

        return (
          <h3 key={idx} className="text-lg font-semibold text-theme-text-heading mt-6 mb-4 flex items-center gap-2 border-b border-theme-border pb-2">
            <Icon size={18} className="text-indigo-400" />
            {formatInline(line.replace("##", "").replace(/【|】/g, "").trim())}
          </h3>
        );
      }

      // Bullet points
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const bulletText = trimmed.substring(1).trim();
        return (
          <ul key={idx} className="list-disc pl-6 my-1.5 text-theme-text-primary leading-7 text-[15px]">
            <li>{formatInline(bulletText)}</li>
          </ul>
        );
      }

      // Numbered items
      if (/^\d+\./.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\./, "").trim();
        return (
          <ol key={idx} className="list-decimal pl-6 my-1.5 text-theme-text-primary leading-7 text-[15px]">
            <li>{formatInline(itemText)}</li>
          </ol>
        );
      }

      // Standard paragraphs
      if (trimmed === "") {
        return <div key={idx} className="h-3"></div>;
      }

      return (
        <p key={idx} className="text-[15px] text-theme-text-primary leading-7 my-2 font-sans">
          {formatInline(line)}
        </p>
      );
    });
  };

  return (
    <div className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col h-full transition-all duration-300 shadow-xl shadow-black/10" id="ai-analyst-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-theme-text-heading flex items-center gap-2 uppercase tracking-wider">
            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
            <span>AI 智能投资分析助理</span>
          </h3>
          <p className="text-[11px] text-theme-text-muted mt-0.5">
            基于 Gemini 3.6/3.1 深度研判股票走势与您的持仓风险
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              hasApiKey
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 animate-pulse"
            }`}
            title="配置 Gemini API Key (用于前端直接调用 AI)"
          >
            <Key size={13} />
            <span>{hasApiKey ? "API Key 已配置" : "设置 API Key"}</span>
          </button>

          <button
            onClick={() => onAnalyze(thinkingMode, image ? { base64: image.base64, mimeType: image.mimeType } : null)}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-theme-bg-hover text-white disabled:text-theme-text-muted rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>智能诊断中...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>分析 {symbol} 仓位</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Enhancements Config Row */}
      <div 
        className={`mb-4 p-3.5 rounded-2xl border transition-all duration-300 ${
          isDragging 
            ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
            : thinkingMode
              ? "animate-pulse-glow border-indigo-500/50 bg-gradient-to-r from-indigo-950/15 via-slate-900/40 to-indigo-950/15"
              : "border-theme-border-muted bg-theme-panel hover:border-theme-border transition-colors duration-200"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          {/* Left: Drag Drop & Select Image */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            {image ? (
              <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/20 px-2.5 py-1.5 rounded-xl text-theme-text-primary w-full sm:w-auto justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="relative w-7 h-7 rounded bg-slate-800/60 overflow-hidden border border-theme-border flex items-center justify-center shrink-0">
                    <img 
                      src={`data:${image.mimeType};base64,${image.base64}`} 
                      alt="upload preview" 
                      className="object-cover w-full h-full" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="max-w-[130px] truncate">
                    <p className="text-[10px] font-medium text-indigo-300 truncate" title={image.name}>
                      {image.name}
                    </p>
                    <p className="text-[9px] text-indigo-400 font-medium">图文深度评测就绪</p>
                  </div>
                </div>
                <button 
                  onClick={() => setImage(null)}
                  className="p-1 text-theme-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition cursor-pointer"
                  title="移除图片"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-theme-bg-hover hover:bg-theme-bg-active border border-theme-border rounded-xl text-theme-text-secondary hover:text-theme-text-primary transition-all duration-200 cursor-pointer font-medium w-full sm:w-auto justify-center hover:scale-[1.01] active:scale-[0.99] group"
              >
                <Image size={13} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>拖入或点击上传K线/财报图</span>
              </button>
            )}
          </div>

          {/* Right: Deep Thinking Toggle */}
          <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 border-t sm:border-t-0 border-theme-border-muted pt-2.5 sm:pt-0">
            <div className="flex items-center gap-2">
              <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <Brain 
                  size={14} 
                  className={thinkingMode ? "animate-brain-pulse text-indigo-400" : "text-theme-text-muted"} 
                />
              </div>
              <div>
                <span className="font-bold text-theme-text-heading text-[11px] block sm:inline">
                  深度思维推理 (Pro)
                </span>
                <span className="text-[9px] text-theme-text-muted block -mt-0.5 sm:mt-0 font-medium">
                  {thinkingMode ? "旗舰 3.1 Pro 强力思维链" : "高响应模式 (默认 3.5 Flash)"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setThinkingMode(!thinkingMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-all duration-300 ease-in-out focus:outline-none hover:scale-105 active:scale-95 ${
                thinkingMode 
                  ? "bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.65)] border-indigo-400/30" 
                  : "bg-theme-bg-active border-theme-border"
              }`}
              title="开启高精度高成本思考模式，激活超长思维链"
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                  thinkingMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto max-h-[500px] min-h-[200px] pr-2 scrollbar-thin">
        {loading ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-theme-text-muted gap-2">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <p className="text-xs font-medium animate-pulse text-indigo-400">
              正在调用 Gemini 进行多维仓位评估与市场研判...
            </p>
            <p className="text-[10px] text-theme-text-muted max-w-xs text-center">
              分析将结合您的买入成本、当前市场参考价格及交易量进行深度风险计算。
            </p>
          </div>
        ) : error ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-red-500 gap-2 p-4 text-center">
            <AlertCircle size={24} />
            <p className="text-xs font-semibold">分析服务遇到异常</p>
            <p className="text-[10px] text-theme-text-muted max-w-xs">
              {error} (请确保 GEMINI_API_KEY 已配置且可用)
            </p>
          </div>
        ) : analysis ? (
          <div className="bg-theme-panel rounded-2xl border border-theme-border-muted p-5 md:p-6 font-sans text-theme-text-primary">
            {renderFormattedText(analysis)}
          </div>
        ) : (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-theme-text-muted text-center gap-1.5 border border-dashed border-theme-border rounded-2xl p-5">
            <Sparkles size={20} className="text-indigo-400/50 mb-1" />
            <p className="text-xs font-medium text-theme-text-primary">
              需要对 {name} ({symbol}) 进行持仓优化？
            </p>
            <p className="text-[10px] text-theme-text-muted max-w-xs leading-relaxed">
              点击上方“分析 {symbol} 仓位”按钮，AI 将为您智能剖析当前的阻力支撑位、风险比和策略建议。
            </p>
          </div>
        )}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-card border border-theme-border rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-theme-text-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Key size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-theme-text-heading">配置 Gemini API Key</h4>
                  <p className="text-[11px] text-theme-text-muted">纯前端部署模式：保存在您的本地浏览器中</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-theme-text-secondary">API Key 字符串：</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[11px] text-theme-text-muted leading-relaxed">
                密钥将仅用于与 Google Gemini 接口通信，不会上传至任何中转服务器，支持在 GitHub Pages 纯静态环境下独立运行。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-theme-text-muted hover:bg-theme-bg-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveKey}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {savedSuccess ? (
                  <>
                    <Check size={14} className="text-emerald-300" />
                    <span>已保存！</span>
                  </>
                ) : (
                  <span>保存设置</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
