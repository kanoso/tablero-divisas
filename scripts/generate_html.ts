import fs from 'fs/promises';

(async () => {
  const data = JSON.parse(await fs.readFile('data/latest.json', 'utf-8'));
  const template = await fs.readFile('templates/dashboard.html', 'utf-8');
  const output = template.replace('__DASHBOARD_DATA__', JSON.stringify(data));
  await fs.writeFile('index.html', output, 'utf-8');
  console.log('[OK] index.html generated');
})();
