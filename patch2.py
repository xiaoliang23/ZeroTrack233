import re

with open("src/components/StockChart.tsx", "r") as f:
    content = f.read()

# Replace count definition in renderCanvas
content = content.replace(
    "const count = displayedCandles.length;",
    "const baseCount = Math.min(effectiveCandles.length, visibleCount);\n    const loopCount = displayedCandles.length;\n    const offsetX = (safeStartIndexFloat - safeStartIndex) * (chartWidth / baseCount);"
)

content = content.replace(
    "const candleSlotWidth = chartWidth / count;",
    "const candleSlotWidth = chartWidth / baseCount;"
)

# Fix idx * candleSlotWidth -> idx * candleSlotWidth - offsetX
content = content.replace(
    "idx * candleSlotWidth",
    "(idx * candleSlotWidth - offsetX)"
)

# Fix loops that use count
content = content.replace(
    "for (let idx = 0; idx < count; idx++) {",
    "for (let idx = 0; idx < loopCount; idx++) {"
)

# Fix X-axis labels to use loopCount
content = content.replace(
    "const dateStep = Math.max(1, Math.floor(count / 6));\n    for (let idx = 0; idx < count; idx += dateStep) {",
    "const dateStep = Math.max(1, Math.floor(baseCount / 6));\n    for (let idx = 0; idx < loopCount; idx += dateStep) {"
)

# Fix area chart fill end point
content = content.replace(
    "ctx.lineTo((count - 1) * candleSlotWidth",
    "ctx.lineTo((loopCount - 1) * candleSlotWidth - offsetX"
)

# Fix crosshair offset
content = content.replace(
    "const hoverX = localIdx * candleSlotWidth + candleSlotWidth / 2;",
    "const hoverX = localIdx * candleSlotWidth - offsetX + candleSlotWidth / 2;"
)

# Fix mouse and touch move events count -> baseCount
content = content.replace(
    "const count = displayedCandles.length;",
    "const count = Math.min(effectiveCandles.length, visibleCount);"
)

with open("src/components/StockChart.tsx", "w") as f:
    f.write(content)
