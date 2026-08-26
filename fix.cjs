const fs = require('fs');
let code = fs.readFileSync('src/components/StockChart.tsx', 'utf8');

// Fix handleMouseMove and handleTouchMove by declaring count
code = code.replace(
  "const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);\n      if (count > 0",
  "const count = Math.min(effectiveCandles.length, visibleCount);\n      if (count > 0"
);

// wait, the regex replaced all instances! Let's just restore from git and do it safely using JS strings.
