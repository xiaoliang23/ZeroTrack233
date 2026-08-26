import React, { useMemo } from 'react';
import { Position } from '../types';
import * as d3 from 'd3-hierarchy';
import { motion, AnimatePresence } from 'framer-motion';

interface PortfolioHeatmapProps {
  positions: Position[];
  onSelect: (symbol: string) => void;
  activeSymbol: string;
  isUpRed: boolean;
  isLoading?: boolean;
}

export default React.memo(function PortfolioHeatmap({ 
  positions, 
  onSelect, 
  activeSymbol, 
  isUpRed,
  isLoading = false 
}: PortfolioHeatmapProps) {
  const root = useMemo(() => {
    // Filter out 0 value positions to avoid issues with treemap layout
    const validPositions = positions.filter(p => p.currentValue > 0);
    
    if (validPositions.length === 0) {
      return null;
    }

    const data = {
      name: "Portfolio",
      children: validPositions.map(p => ({
        ...p,
        value: p.currentValue
      }))
    };

    const rootNode = d3.hierarchy<any>(data).sum((d: any) => d.value);
    
    // Use 1000 for better precision with padding
    d3.treemap()
      .size([1000, 1000])
      .paddingInner(4)
      .paddingOuter(4)
      .round(false)
      (rootNode);

    return rootNode;
  }, [positions]);

  const leaves = root ? root.leaves() : [];

  // Show Skeleton if loading or if we have raw positions but treemap is not yet rendered
  if (isLoading || (positions.length > 0 && leaves.length === 0)) {
    return (
      <div className="w-full h-56 md:h-72 relative bg-theme-panel/40 backdrop-blur-sm rounded-2xl md:rounded-3xl overflow-hidden p-1.5">
        <div className="w-full h-full grid grid-cols-12 grid-rows-6 gap-1.5">
          <div className="col-span-7 row-span-6 rounded-xl bg-theme-border-muted/30 animate-pulse flex flex-col justify-center items-center p-4">
            <div className="h-4 w-20 bg-theme-text-muted/20 rounded mb-2" />
            <div className="h-3 w-12 bg-theme-text-muted/15 rounded" />
          </div>
          <div className="col-span-5 row-span-3 rounded-xl bg-theme-border-muted/25 animate-pulse flex flex-col justify-center items-center p-3">
            <div className="h-3.5 w-16 bg-theme-text-muted/20 rounded mb-1.5" />
            <div className="h-2.5 w-10 bg-theme-text-muted/15 rounded" />
          </div>
          <div className="col-span-3 row-span-3 rounded-xl bg-theme-border-muted/20 animate-pulse flex flex-col justify-center items-center p-2">
            <div className="h-3 w-12 bg-theme-text-muted/20 rounded mb-1" />
            <div className="h-2 w-8 bg-theme-text-muted/15 rounded" />
          </div>
          <div className="col-span-2 row-span-3 rounded-xl bg-theme-border-muted/15 animate-pulse" />
        </div>
      </div>
    );
  }

  if (leaves.length === 0) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={`heatmap-${positions.length}`}
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full h-56 md:h-72 relative bg-theme-panel/40 backdrop-blur-sm rounded-2xl md:rounded-3xl overflow-hidden p-1"
      >
        {leaves.map((leafNode, i) => {
          const leaf = leafNode as any;
          const p = leaf.data as Position;
          const width = (leaf.x1 - leaf.x0) / 10;
          const height = (leaf.y1 - leaf.y0) / 10;
          
          // Color intensity based on P&L
          const pnl = p.pnlPercent || 0;
          
          // Define color palette based on performance
          let baseColor = "";
          
          if (isUpRed) {
            // Red up, Green down
            if (pnl > 6) baseColor = "rgb(220, 38, 38)"; // stronger red
            else if (pnl > 2) baseColor = "rgb(239, 68, 68)"; // strong red
            else if (pnl > 0) baseColor = "rgb(248, 113, 113)"; // light red
            else if (pnl === 0) baseColor = "rgb(156, 163, 175)"; // gray
            else if (pnl > -2) baseColor = "rgb(52, 211, 153)"; // light green
            else if (pnl > -6) baseColor = "rgb(16, 185, 129)"; // strong green
            else baseColor = "rgb(5, 150, 105)"; // stronger green
          } else {
            // Green up, Red down
            if (pnl > 6) baseColor = "rgb(5, 150, 105)"; // stronger green
            else if (pnl > 2) baseColor = "rgb(16, 185, 129)"; // strong green
            else if (pnl > 0) baseColor = "rgb(52, 211, 153)"; // light green
            else if (pnl === 0) baseColor = "rgb(156, 163, 175)"; // gray
            else if (pnl > -2) baseColor = "rgb(248, 113, 113)"; // light red
            else if (pnl > -6) baseColor = "rgb(239, 68, 68)"; // strong red
            else baseColor = "rgb(220, 38, 38)"; // stronger red
          }

          const isActive = activeSymbol === p.symbol;

          return (
            <motion.div
              key={p.symbol}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.15) }}
              onClick={() => onSelect(p.symbol)}
              className={`absolute flex flex-col justify-center items-center cursor-pointer transition-all duration-300 ${
                isActive 
                  ? 'z-10 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.02] ring-2 ring-white ring-offset-2 ring-offset-slate-900 rounded-xl' 
                  : 'hover:brightness-110 hover:z-10 hover:scale-[1.01] hover:shadow-lg rounded-lg'
              }`}
              style={{
                left: `${leaf.x0 / 10}%`,
                top: `${leaf.y0 / 10}%`,
                width: `${width}%`,
                height: `${height}%`,
                backgroundColor: baseColor,
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              {height > 12 && width > 8 && (
                <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full overflow-hidden">
                  <span className={`font-bold text-white drop-shadow-lg tracking-wider ${height > 35 && width > 25 ? 'text-lg md:text-xl' : height > 25 && width > 15 ? 'text-sm md:text-base' : 'text-[10px] md:text-xs'}`}>
                    {p.symbol.replace('.HK', '')}
                  </span>
                  {height > 25 && width > 15 && (
                    <span className={`font-mono font-bold tracking-tight mt-1.5 px-2 py-0.5 rounded-md shadow-sm border ${pnl > 0 ? 'bg-white/20 border-white/30 text-white' : pnl < 0 ? 'bg-black/20 border-black/10 text-white' : 'bg-black/10 border-white/10 text-white/90'} backdrop-blur-md ${height > 40 && width > 25 ? 'text-[13px] md:text-sm' : 'text-[10px] md:text-xs'}`}>
                      {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
});

