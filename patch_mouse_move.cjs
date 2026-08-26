const fs = require('fs');
let code = fs.readFileSync('src/components/StockChart.tsx', 'utf8');

// Change safeStartIndex to Float
code = code.replace(
  "const safeStartIndex = Math.max(0, Math.min(startIndex, Math.max(0, effectiveCandles.length - 10)));\n  const safeEndIndex = Math.min(effectiveCandles.length, safeStartIndex + visibleCount);",
  "const safeStartIndexFloat = Math.max(0, Math.min(startIndex, Math.max(0, effectiveCandles.length - 10)));\n  const safeStartIndex = Math.floor(safeStartIndexFloat);\n  const safeEndIndex = Math.min(effectiveCandles.length, safeStartIndex + visibleCount + 2);"
);

// Mouse drag
code = code.replace(
  "          const deltaCandles = Math.trunc(deltaX / candleSlotW);\n          if (deltaCandles !== 0) {\n            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));\n            dragStartX.current += deltaCandles * candleSlotW;\n          }",
  "          const deltaCandles = deltaX / candleSlotW;\n          if (deltaCandles !== 0) {\n            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));\n            dragStartX.current = e.clientX;\n          }"
);

// Touch drag
code = code.replace(
  "          const deltaCandles = Math.trunc(deltaX / candleSlotW);\n          if (deltaCandles !== 0) {\n            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));\n            dragStartX.current += deltaCandles * candleSlotW;\n          }",
  "          const deltaCandles = deltaX / candleSlotW;\n          if (deltaCandles !== 0) {\n            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));\n            dragStartX.current = e.touches[0].clientX;\n          }"
);

// Mouse hover offset
code = code.replace(
  "        const idxInDisplayed = Math.floor(mouseX / slotW);",
  "        const offset = (safeStartIndexFloat - safeStartIndex) * slotW;\n        const idxInDisplayed = Math.floor((mouseX + offset) / slotW);"
);

code = code.replace(
  "          const idxInDisplayed = Math.floor(touchX / slotW);",
  "          const offset = (safeStartIndexFloat - safeStartIndex) * slotW;\n          const idxInDisplayed = Math.floor((touchX + offset) / slotW);"
);

// Second touch hover
code = code.replace(
  "          const idxInDisplayed = Math.floor(touchX / slotW);",
  "          const offset = (safeStartIndexFloat - safeStartIndex) * slotW;\n          const idxInDisplayed = Math.floor((touchX + offset) / slotW);"
);

fs.writeFileSync('src/components/StockChart.tsx', code);
