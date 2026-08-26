const fs = require('fs');
let code = fs.readFileSync('src/components/StockChart.tsx', 'utf8');

code = code.replace(
  "  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {\n    e.preventDefault();\n    if (e.deltaY < 0) {",
  "  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {\n    e.preventDefault();\n    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {\n      const container = canvasContainerRef.current;\n      if (!container) return;\n      const chartWidth = container.getBoundingClientRect().width - 70;\n      const candleSlotW = chartWidth / visibleCount;\n      if (candleSlotW > 0) {\n        const deltaCandles = e.deltaX / candleSlotW;\n        setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev + deltaCandles)));\n      }\n    } else if (e.deltaY < 0) {"
);
code = code.replace("    } else {\n      // Zoom Out", "    } else if (e.deltaY > 0) {\n      // Zoom Out");

fs.writeFileSync('src/components/StockChart.tsx', code);
