import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import appLogoImg from "/src/assets/images/app_logo_1786623180494.jpg";

interface FloatingEffect {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

const EASTER_EGG_MESSAGES = [
  "🪙 +$8,888.88",
  "🚀 To The Moon!",
  "🐂 牛市发财！",
  "📈 账户创新高！",
  "💰 财富自由！",
  "💎 钻石手 HODL!",
  "✨ 财运连连！",
  "🎉 涨停板连发！",
  "🔥 收益暴涨 1000%!",
  "🏆 股神附体！"
];

const COLORS = [
  "text-emerald-400 border-emerald-500/30 bg-emerald-950/80",
  "text-amber-400 border-amber-500/30 bg-amber-950/80",
  "text-indigo-400 border-indigo-500/30 bg-indigo-950/80",
  "text-rose-400 border-rose-500/30 bg-rose-950/80",
  "text-purple-400 border-purple-500/30 bg-purple-950/80"
];

// Play synthesized audio using Web Audio API (No external sound files required!)
export function playEasterEggSound(comboCount: number) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (comboCount % 100 === 0) {
      // 🎄 100-Click Christmas Special: Jingle Bells Melody
      playChristmasMelody(ctx);
    } else if (comboCount % 10 === 0) {
      // Jackpot Bull Market Fanfare
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.3);
      });
    } else if (comboCount >= 5) {
      // Upward Arpeggio / Cash Register "Cha-Ching!"
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc1.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      osc2.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.08); // G6

      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } else {
      // Retro Coin Chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.07); // E6
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn("AudioContext error", e);
  }
}

// Synthesize Jingle Bells melody on Web Audio API
function playChristmasMelody(ctx: AudioContext) {
  const notes = [
    { freq: 659.25, dur: 0.18, time: 0.00 }, // E5
    { freq: 659.25, dur: 0.18, time: 0.22 }, // E5
    { freq: 659.25, dur: 0.35, time: 0.44 }, // E5
    
    { freq: 659.25, dur: 0.18, time: 0.85 }, // E5
    { freq: 659.25, dur: 0.18, time: 1.07 }, // E5
    { freq: 659.25, dur: 0.35, time: 1.29 }, // E5

    { freq: 659.25, dur: 0.18, time: 1.70 }, // E5
    { freq: 783.99, dur: 0.18, time: 1.92 }, // G5
    { freq: 523.25, dur: 0.22, time: 2.14 }, // C5
    { freq: 587.33, dur: 0.22, time: 2.40 }, // D5
    { freq: 659.25, dur: 0.55, time: 2.65 }, // E5

    // F5, F5, F5, F5, F5, E5, E5, E5, E5, D5, D5, E5, D5, G5
    { freq: 698.46, dur: 0.18, time: 3.30 }, // F5
    { freq: 698.46, dur: 0.18, time: 3.52 }, // F5
    { freq: 698.46, dur: 0.25, time: 3.74 }, // F5
    { freq: 698.46, dur: 0.18, time: 4.05 }, // F5
    { freq: 698.46, dur: 0.18, time: 4.27 }, // F5
    { freq: 659.25, dur: 0.18, time: 4.49 }, // E5
    { freq: 659.25, dur: 0.18, time: 4.71 }, // E5
    { freq: 587.33, dur: 0.18, time: 4.93 }, // D5
    { freq: 587.33, dur: 0.18, time: 5.15 }, // D5
    { freq: 659.25, dur: 0.18, time: 5.37 }, // E5
    { freq: 587.33, dur: 0.30, time: 5.59 }, // D5
    { freq: 783.99, dur: 0.40, time: 5.95 }, // G5
  ];

  notes.forEach((n) => {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(n.freq * 2, ctx.currentTime + n.time);

    gain.gain.setValueAtTime(0.22, ctx.currentTime + n.time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur + 0.12);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + n.time);
    osc2.start(ctx.currentTime + n.time);
    osc.stop(ctx.currentTime + n.time + n.dur + 0.15);
    osc2.stop(ctx.currentTime + n.time + n.dur + 0.15);
  });
}

interface EasterEggLogoProps {
  size?: "sm" | "lg";
  showTitle?: boolean;
}

export const EasterEggLogo: React.FC<EasterEggLogoProps> = ({ size = "sm", showTitle = false }) => {
  const [combo, setCombo] = useState(0);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [isBouncing, setIsBouncing] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    setIsBouncing(true);

    // Play synthesized Easter Egg audio
    playEasterEggSound(nextCombo);

    // Create floating message popup effect
    let msg = EASTER_EGG_MESSAGES[(nextCombo - 1) % EASTER_EGG_MESSAGES.length];
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];

    if (nextCombo % 100 === 0) {
      msg = `🎄 恭喜解锁 100 次终极圣诞彩蛋！🎅 Jingle Bells~ 🔔 财源滚滚！`;
      color = "text-red-100 border-red-500 bg-gradient-to-r from-red-600 via-emerald-600 to-red-600 font-extrabold shadow-red-500/50 scale-125";
    }

    const randomOffsetX = (Math.random() - 0.5) * 60;
    
    const newEffect: FloatingEffect = {
      id: Date.now() + Math.random(),
      text: msg,
      x: randomOffsetX,
      y: -20,
      color
    };

    setEffects((prev) => [...prev.slice(-5), newEffect]);

    // Remove after animation
    setTimeout(() => {
      setEffects((prev) => prev.filter((eff) => eff.id !== newEffect.id));
    }, 1200);

    setTimeout(() => {
      setIsBouncing(false);
    }, 300);
  };

  const isLarge = size === "lg";

  return (
    <div className="relative inline-flex items-center gap-2 select-none">
      <motion.div
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.85, rotate: [0, -12, 12, 0] }}
        animate={isBouncing ? { scale: [1, 1.2, 0.95, 1], rotate: [0, -8, 8, 0] } : {}}
        transition={{ duration: 0.25 }}
        onClick={handleClick}
        className={`relative cursor-pointer overflow-hidden rounded-xl shadow-md border border-indigo-500/30 group transition-shadow hover:shadow-indigo-500/40 shrink-0 ${
          isLarge ? "w-24 h-24 rounded-3xl" : "w-8 h-8 rounded-xl"
        }`}
        title="点击触发发财彩蛋音效！"
      >
        <img
          src={appLogoImg}
          alt="ZeroTrack Logo"
          className="w-full h-full object-cover group-hover:brightness-110 transition-all"
          referrerPolicy="no-referrer"
        />
        
        {/* Subtle shine highlight on click */}
        {isBouncing && (
          <motion.div
            initial={{ opacity: 0.8, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 bg-white/40 rounded-full pointer-events-none"
          />
        )}
      </motion.div>

      {showTitle && (
        <span
          onClick={handleClick}
          className="font-bold text-base text-theme-text-heading tracking-tight hidden md:block hover:text-indigo-400 transition-colors cursor-pointer"
        >
          ZeroTrack
        </span>
      )}

      {/* Combo Counter Badge */}
      <AnimatePresence>
        {combo > 1 && (
          <motion.span
            key={combo}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute -top-2 -right-3 z-50 px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg pointer-events-none"
          >
            {combo}x 🔥
          </motion.span>
        )}
      </AnimatePresence>

      {/* Floating Easter Egg Visual Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-50">
        <AnimatePresence>
          {effects.map((eff) => (
            <motion.div
              key={eff.id}
              initial={{ opacity: 1, y: 0, scale: 0.8, x: eff.x }}
              animate={{ opacity: 0, y: -65, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className={`absolute whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold font-mono border shadow-2xl backdrop-blur-md ${eff.color}`}
            >
              {eff.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
