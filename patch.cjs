const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const availableSectorsCode = `
  const availableSectors = useMemo(() => {
    const sectors = new Set<string>();
    positions.forEach(p => {
      if (p.sector) sectors.add(p.sector);
    });
    return ["All", ...Array.from(sectors)].sort();
  }, [positions]);
`;

code = code.replace(
  "  const renderSortIndicator = (key: keyof Position) => {",
  availableSectorsCode + "\n  const renderSortIndicator = (key: keyof Position) => {"
);

const filterUICode = `
              <div className="flex items-center ml-2 bg-theme-bg-elevated border border-theme-border rounded-lg overflow-hidden">
                <select 
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="bg-transparent text-xs text-theme-text-primary px-2 py-1 outline-none cursor-pointer"
                >
                  {availableSectors.map(sec => (
                    <option key={sec} value={sec} className="bg-theme-bg text-theme-text-primary">{sec === "All" ? "全部板块" : sec}</option>
                  ))}
                </select>
              </div>
`;

code = code.replace(
  "              <span className=\"hidden sm:inline-block text-xs text-theme-text-muted font-mono\">点击各行可在下方切换K线</span>",
  "              <span className=\"hidden sm:inline-block text-xs text-theme-text-muted font-mono\">点击各行可在下方切换K线</span>\n" + filterUICode
);

fs.writeFileSync('src/App.tsx', code);
