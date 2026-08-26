const fs = require('fs');
let code = fs.readFileSync('src/components/StockChart.tsx', 'utf8');

// fix lines in renderCanvas
code = code.replace("hoverIndex !== null ? hoverIndex - safeStartIndex : count - 1", "hoverIndex !== null ? hoverIndex - safeStartIndex : loopCount - 1");
code = code.replace("activeIdxInView < count", "activeIdxInView < loopCount");
code = code.replace("displayedCandles[count - 1]?.volume", "displayedCandles[loopCount - 1]?.volume");
code = code.replace("localIdx < count) {", "localIdx < loopCount) {");

// fix touch crosshair count
code = code.replace(
  "        const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);\n        if (count > 0",
  "        const count = Math.min(effectiveCandles.length, visibleCount);\n        if (count > 0"
);
code = code.replace(
  "        const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);\n      if (count > 0",
  "        const count = Math.min(effectiveCandles.length, visibleCount);\n        if (count > 0"
);

fs.writeFileSync('src/components/StockChart.tsx', code);
