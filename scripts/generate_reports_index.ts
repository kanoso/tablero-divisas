import fs from 'fs/promises';
import path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert Obsidian callout syntax to styled HTML divs */
function renderCallouts(md: string): string {
  // Match callout blocks: > [!type]+ Title\n> content lines
  return md.replace(
    /^> \[!([\w-]+)\][+\-]?\s*(.*?)\n((?:^>.*\n?)*)/gm,
    (_match, type: string, title: string, body: string) => {
      const content = body
        .split('\n')
        .map((l: string) => l.replace(/^>\s?/, ''))
        .join('\n')
        .trim();
      const icons: Record<string, string> = {
        abstract: '📋', summary: '📋', info: 'ℹ️', note: '📝',
        tip: '💡', warning: '⚠️', danger: '🔴', success: '✅',
        check: '✅', quote: '💬', example: '📌',
      };
      const icon = icons[type.toLowerCase()] ?? 'ℹ️';
      const safeTitle = title || type.charAt(0).toUpperCase() + type.slice(1);
      return `<div class="callout callout-${type.toLowerCase()}">` +
        `<div class="callout-title">${icon} ${safeTitle}</div>` +
        `<div class="callout-body">\n\n${content}\n\n</div></div>\n\n`;
    }
  );
}

/** Strip YAML frontmatter */
function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n/, '');
}

/** Generate full HTML page for a single report */
function reportPage(dateStr: string, mdContent: string): string {
  const clean = renderCallouts(stripFrontmatter(mdContent));
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reporte ${dateStr}</title>
<script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'base' });
</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#f1f5f9;font-family:'Segoe UI',system-ui,sans-serif;padding:2rem;max-width:960px;margin:0 auto;line-height:1.6}
h1{color:#f1f5f9;font-size:1.6rem;margin-bottom:1.5rem}
h2{color:#94a3b8;font-size:1.2rem;margin:2rem 0 .75rem;border-bottom:1px solid #334155;padding-bottom:.4rem}
h3{color:#cbd5e1;font-size:1rem;margin:1.5rem 0 .5rem}
p{margin-bottom:.75rem;color:#cbd5e1}
a{color:#6366f1}
strong{color:#f1f5f9}
em{color:#94a3b8}
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.85rem}
th{background:#1e293b;color:#94a3b8;padding:.5rem .75rem;text-align:left;border-bottom:2px solid #334155}
td{padding:.45rem .75rem;border-bottom:1px solid #1e293b;color:#f1f5f9}
tr:hover td{background:#1e293b}
ul,ol{padding-left:1.4rem;margin-bottom:.75rem;color:#cbd5e1}
li{margin-bottom:.25rem}
hr{border:none;border-top:1px solid #334155;margin:2rem 0}
pre{background:#1e293b;padding:1rem;border-radius:8px;overflow-x:auto;margin:1rem 0}
code{font-family:'Cascadia Code','Fira Mono',monospace;font-size:.85rem;color:#a5b4fc}
blockquote{border-left:3px solid #334155;padding-left:1rem;color:#94a3b8;margin:1rem 0}

/* Callouts */
.callout{border-radius:8px;padding:1rem 1.25rem;margin:1rem 0;border-left:4px solid}
.callout-body p,.callout-body li{color:inherit}
.callout-title{font-weight:600;margin-bottom:.5rem;font-size:.9rem}
.callout-abstract,.callout-summary{background:#1e3a5f22;border-color:#3b82f6;color:#93c5fd}
.callout-info{background:#1e3a5f22;border-color:#6366f1;color:#a5b4fc}
.callout-note{background:#1e293b;border-color:#475569;color:#cbd5e1}
.callout-tip{background:#14532d22;border-color:#22c55e;color:#86efac}
.callout-warning{background:#78350f22;border-color:#f59e0b;color:#fcd34d}
.callout-danger{background:#7f1d1d22;border-color:#ef4444;color:#fca5a5}
.callout-success,.callout-check{background:#14532d22;border-color:#22c55e;color:#86efac}
.callout-quote{background:#1e293b;border-color:#475569;color:#94a3b8;font-style:italic}

/* Back link */
.back{display:inline-block;margin-bottom:1.5rem;color:#6366f1;font-size:.85rem;text-decoration:none}
.back:hover{text-decoration:underline}

/* Mermaid */
.mermaid{background:#1e293b;border-radius:8px;padding:1rem;margin:1rem 0;overflow-x:auto}
</style>
</head>
<body>
<a class="back" href="index.html">← Volver al índice</a>
<div id="content"></div>
<script>
const raw = ${JSON.stringify(clean)};
document.getElementById('content').innerHTML = marked.parse(raw);
// Wrap mermaid code blocks
document.querySelectorAll('pre code').forEach(el => {
  const text = el.textContent || '';
  if (text.trimStart().startsWith('%%{init') || text.trimStart().startsWith('xychart') || text.trimStart().startsWith('graph') || text.trimStart().startsWith('flowchart') || text.trimStart().startsWith('pie') || text.trimStart().startsWith('gantt')) {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = text;
    el.closest('pre')?.replaceWith(div);
  }
});
</script>
</body>
</html>`;
}

/** Generate the reports index page */
function indexPage(files: string[]): string {
  const rows = files.map(f => {
    const date = f.replace('.md', '');
    const htmlFile = f.replace('.md', '.html');
    const [y, m, d] = date.split('-');
    const label = `${d}/${m}/${y}`;
    return `<tr>
      <td>${label}</td>
      <td><a href="${htmlFile}">Ver reporte</a></td>
      <td><a href="${f}" download>Descargar .md</a></td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reportes Diarios — Tablero LATAM</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#f1f5f9;font-family:'Segoe UI',system-ui,sans-serif;padding:2rem;max-width:700px;margin:0 auto}
h1{font-size:1.4rem;margin-bottom:.5rem}
p{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}
a.home{display:inline-block;margin-bottom:1.5rem;color:#6366f1;font-size:.85rem;text-decoration:none}
a.home:hover{text-decoration:underline}
table{width:100%;border-collapse:collapse}
th{background:#1e293b;color:#94a3b8;padding:.6rem 1rem;text-align:left;font-size:.85rem;border-bottom:2px solid #334155}
td{padding:.6rem 1rem;border-bottom:1px solid #1e293b;font-size:.9rem}
tr:hover td{background:#1e293b}
a{color:#6366f1;text-decoration:none}
a:hover{text-decoration:underline}
.badge{background:#1e293b;border:1px solid #334155;border-radius:4px;padding:.1rem .5rem;font-size:.75rem;color:#94a3b8;margin-left:.5rem}
</style>
</head>
<body>
<a class="home" href="../index.html">← Tablero principal</a>
<h1>Reportes Diarios</h1>
<p>Historial de reportes del Tablero Financiero LATAM. Generados automáticamente cada día a las 08:00 Lima.</p>
<table>
  <thead><tr><th>Fecha</th><th>Reporte</th><th>Obsidian</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const reportsDir = path.resolve('reports');

  const allFiles = await fs.readdir(reportsDir);
  const mdFiles = allFiles
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
    .sort()
    .reverse(); // newest first

  if (mdFiles.length === 0) {
    console.log('[WARN] No .md reports found in reports/');
    return;
  }

  // Generate individual HTML pages
  for (const file of mdFiles) {
    const dateStr = file.replace('.md', '');
    const mdContent = await fs.readFile(path.join(reportsDir, file), 'utf-8');
    const html = reportPage(dateStr, mdContent);
    const htmlPath = path.join(reportsDir, file.replace('.md', '.html'));
    await fs.writeFile(htmlPath, html, 'utf-8');
  }

  // Generate index
  await fs.writeFile(path.join(reportsDir, 'index.html'), indexPage(mdFiles), 'utf-8');

  console.log(`[OK] reports/index.html generated (${mdFiles.length} reports)`);
})();
