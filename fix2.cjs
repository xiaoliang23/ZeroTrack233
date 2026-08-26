const fs = require('fs');
let code = fs.readFileSync('src/components/StockChart.tsx', 'utf8');

code = code.replace(
  "    rafMoveId.current = requestAnimationFrame(() => {\n      const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);\n      if (count > 0 && mouseX >= 0 && mouseX <= chartWidth) {",
  "    rafMoveId.current = requestAnimationFrame(() => {\n      const count = Math.min(effectiveCandles.length, visibleCount);\n      if (count > 0 && mouseX >= 0 && mouseX <= chartWidth) {"
);

code = code.replace(
  "      if (touchMode === \"crosshair\") {\n        const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);\n        if (count > 0 && touchX >= 0 && touchX <= chartWidth) {",
  "      if (touchMode === \"crosshair\") {\n        const count = Math.min(effectiveCandles.length, visibleCount);\n        if (count > 0 && touchX >= 0 && touchX <= chartWidth) {"
);

fs.writeFileSync('src/components/StockChart.tsx', code);
