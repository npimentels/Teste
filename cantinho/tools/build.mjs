// Gera uma versão em arquivo único do jogo (HTML + CSS + JS embutidos).
// Uso:  node tools/build.mjs [saida.html] [--fragment]
//   --fragment  omite <!doctype>/<html>/<head>/<body> (para hospedagens que
//               já envolvem a página num esqueleto próprio).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || join(root, 'dist', 'cantinho.html');

// Mini empacotador: cada módulo vira uma função isolada; imports viram
// desestruturação do objeto de exports do módulo importado.
const mods = new Map();
function load(rel) {
  if (mods.has(rel)) return;
  const src = readFileSync(join(root, 'src', rel), 'utf8');
  const deps = [];
  const exportsList = [];
  let code = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)';?$/gm, (_, names, dep) => {
    deps.push(dep);
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __mod['${dep}'];`;
  });
  code = code.replace(/^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*'\.\/([^']+)';?$/gm, (_, name, dep) => {
    deps.push(dep);
    return `const ${name} = __mod['${dep}'];`;
  });
  code = code.replace(/^export\s+(const|let|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => {
    exportsList.push(name);
    return `${kw} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?$/gm, (_, names) => {
    names.split(',').map((n) => n.trim()).filter(Boolean).forEach((n) => exportsList.push(n));
    return '';
  });
  for (const d of deps) load(d);
  mods.set(rel, `__mod['${rel}'] = (() => {\n${code}\nreturn { ${exportsList.join(', ')} };\n})();`);
}
load('main.js');

const js = `(() => {\nconst __mod = {};\n${[...mods.values()].join('\n\n')}\n})();`;
const css = readFileSync(join(root, 'css', 'style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];

const body = `<title>Cantinho</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
<canvas id="view" aria-label="Quarto isométrico em pixel art"></canvas>
<div id="ui"></div>
<script>
${js.replace(/<\/script/g, '<\\/script')}
</script>
`;
const page = fragment
  ? body
  : `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${body}</html>\n`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`ok: ${out} (${(page.length / 1024).toFixed(1)} KB, ${mods.size} módulos)`);
