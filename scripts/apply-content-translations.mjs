// Temporal (Ronda 2 bilingüe): inserta name_en / instructions_en / goal_en en
// el frontmatter de src/content/**, a partir de
// docs/agents/bilingue-contenido-traducciones.json. Idempotente: no toca un
// campo que el archivo ya tiene. Se borra al terminar la ronda.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const data = JSON.parse(
  readFileSync(join(ROOT, 'docs/agents/bilingue-contenido-traducciones.json'), 'utf8')
);
const ORDER = ['name_en', 'instructions_en', 'goal_en'];

function apply(collection, entries) {
  const dir = join(ROOT, 'src/content', collection);
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
  const missing = ids.filter((id) => !(id in entries));
  if (missing.length) throw new Error(`${collection}: faltan traducciones para ${missing.join(', ')}`);
  const extra = Object.keys(entries).filter((id) => !ids.includes(id));
  if (extra.length) throw new Error(`${collection}: ids sin archivo: ${extra.join(', ')}`);

  for (const [id, fields] of Object.entries(entries)) {
    const path = join(dir, `${id}.md`);
    const raw = readFileSync(path, 'utf8');
    if (raw.includes('\r')) throw new Error(`${path}: usa CRLF, no soportado`);
    const lines = raw.split('\n');
    const end = lines.indexOf('---', 1);
    if (lines[0] !== '---' || end === -1) throw new Error(`${path}: sin frontmatter`);
    const front = lines.slice(1, end);
    const nameIdx = front.findIndex((l) => l.startsWith('name:'));
    if (nameIdx === -1) throw new Error(`${path}: sin name:`);

    const toInsert = [];
    for (const key of ORDER) {
      if (fields[key] === undefined) continue;
      if (front.some((l) => l.startsWith(`${key}:`))) continue;
      // JSON.stringify produce un string YAML válido entre comillas dobles.
      toInsert.push(`${key}: ${JSON.stringify(fields[key])}`);
    }
    front.splice(nameIdx + 1, 0, ...toInsert);
    writeFileSync(path, ['---', ...front, ...lines.slice(end)].join('\n'));
  }
}

apply('activities', data.activities ?? {});
apply('plans', data.plans ?? {});
console.log('OK');
