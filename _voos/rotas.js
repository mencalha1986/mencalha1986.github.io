// Atualiza as rotas acompanhadas. Cada rota é uma issue aberta com a etiqueta "voo"
// e título "Voo LIS RIO 2026-12-17 2027-01-02" (volta opcional).
// Grava dados/<rota>.json (voos + histórico) e dados/rotas.json (lista).
// Uso: node rotas.js              (todas as issues abertas; precisa de GITHUB_TOKEN)
//      node rotas.js 12           (só a issue 12)
//      node rotas.js "Voo LIS RIO 2026-12-17 2027-01-02"   (teste local, sem GitHub)
const fs = require('fs');
const path = require('path');
const { abrirNavegador, buscarRota, urlGoogle } = require('./google-voos');

const RAIZ = path.join(__dirname, '..');
const DADOS = path.join(RAIZ, 'dados');
const REPO = process.env.GITHUB_REPOSITORY || 'mencalha1986/mencalha1986.github.io';
const TOKEN = process.env.GITHUB_TOKEN;
const SITE = 'https://mencalha1986.github.io/busca/';
const TITULO = /^Voo ([A-Z]{3}) ([A-Z]{3}) (\d{4}-\d{2}-\d{2})(?: (\d{4}-\d{2}-\d{2}))?\s*$/;

async function gh(metodo, rota, corpo) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${rota}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'voos' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`GitHub ${metodo} ${rota}: ${r.status}`);
  return r.status === 204 ? null : r.json();
}

function lerTitulo(titulo, issue) {
  const m = (titulo || '').trim().toUpperCase().replace(/^VOO/, 'Voo').match(TITULO);
  if (!m) return null;
  const [, origem, destino, ida, volta] = m;
  if (volta && volta < ida) return null;
  return { issue, origem, destino, ida, volta: volta || null, slug: [origem, destino, ida, volta || 'so-ida'].join('-') };
}

function hojeISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function escolher(voos) {
  const comBrl = voos.filter(v => v.brl);
  const barato = comBrl[0] || null;
  if (!barato) return { barato: null, rapido: null, direto: null };
  // Cada hora de viagem conta como R$ 100 ao comparar os voos mais curtos que o mais barato.
  const custo = v => v.brl + v.duracao / 60 * 100;
  const rapido = comBrl
    .filter(v => v !== barato && v.brl <= barato.brl * 1.15 && v.duracao < barato.duracao)
    .sort((a, b) => custo(a) - custo(b))[0] || null;
  const direto = comBrl.filter(v => v.paradas === 0).sort((a, b) => a.brl - b.brl)[0] || null;
  return { barato, rapido, direto };
}

async function atualizar(browser, rota) {
  const arq = path.join(DADOS, `${rota.slug}.json`);
  const antigo = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { historico: [] };
  const { voos, semResultado } = await buscarRota(browser, rota);
  const agora = new Date().toISOString();
  const sel = escolher(voos);
  const historico = antigo.historico || [];
  if (sel.barato) {
    historico.push({ quando: agora, brl: sel.barato.brl, eur: sel.barato.eur, direto: sel.direto?.brl ?? null });
  }
  const dados = {
    rota: { origem: rota.origem, destino: rota.destino, ida: rota.ida, volta: rota.volta, issue: rota.issue },
    atualizado: sel.barato ? agora : antigo.atualizado || null,
    tentativa: agora,
    erro: sel.barato ? null : `Nenhum voo encontrado. ${semResultado ? 'Página: ' + semResultado.replace(/\s+/g, ' ').slice(0, 160) : ''}`.trim(),
    voos: sel.barato ? voos : antigo.voos || [],
    escolhas: sel.barato ? {
      barato: voos.indexOf(sel.barato), rapido: sel.rapido ? voos.indexOf(sel.rapido) : null, direto: sel.direto ? voos.indexOf(sel.direto) : null,
    } : antigo.escolhas || null,
    historico: historico.slice(-720),
    links: { brl: urlGoogle(rota, 'BRL'), eur: urlGoogle(rota, 'EUR') },
  };
  fs.writeFileSync(arq, JSON.stringify(dados, null, 1));
  console.log(`${rota.slug}: ${voos.length} voos, menor R$ ${sel.barato?.brl ?? '—'}`);
  return dados;
}

function resumo(rota, d) {
  const h = d.historico || [];
  const ult = h[h.length - 1], ant = h.length > 1 ? h[h.length - 2] : null;
  const vals = h.map(x => x.brl).filter(Boolean);
  return {
    slug: rota.slug, issue: rota.issue, origem: rota.origem, destino: rota.destino, ida: rota.ida, volta: rota.volta,
    atualizado: d.atualizado, erro: d.erro,
    brl: ult?.brl ?? null, eur: ult?.eur ?? null, direto: ult?.direto ?? null,
    variacao: ult && ant ? ult.brl - ant.brl : null,
    minimo: vals.length ? Math.min(...vals) : null,
  };
}

(async () => {
  fs.mkdirSync(DADOS, { recursive: true });
  const arg = process.argv[2];
  let rotas;
  if (arg && !/^\d+$/.test(arg)) {
    rotas = [lerTitulo(arg, null)].filter(Boolean);
  } else {
    if (!TOKEN) throw new Error('Defina GITHUB_TOKEN.');
    const issues = await gh('GET', '/issues?labels=voo&state=open&per_page=100');
    rotas = [];
    for (const is of issues) {
      const r = lerTitulo(is.title, is.number);
      if (!r) {
        await gh('POST', `/issues/${is.number}/comments`, { body: 'Não entendi a rota. Use o título no formato `Voo LIS RIO 2026-12-17 2027-01-02` (a volta é opcional).' });
        continue;
      }
      if (r.ida < hojeISO()) {
        await gh('POST', `/issues/${is.number}/comments`, { body: 'A data de ida já passou. Parei de acompanhar esta rota.' });
        await gh('PATCH', `/issues/${is.number}`, { state: 'closed' });
        continue;
      }
      rotas.push(r);
    }
    if (arg) rotas = rotas.filter(r => String(r.issue) === arg);
  }

  const browser = await abrirNavegador();
  const lista = [];
  try {
    for (const r of rotas) {
      try {
        const d = await atualizar(browser, r);
        lista.push(resumo(r, d));
        const novo = arg && TOKEN && d.historico.length === 1;
        if (novo) {
          await gh('POST', `/issues/${r.issue}/comments`, {
            body: d.erro ? `⚠️ ${d.erro}` : `Pronto! Menor preço agora: **R$ ${d.historico[0].brl.toLocaleString('pt-BR')}**. Veja em ${SITE}#${r.slug}\n\nEsta rota passa a ser atualizada de hora em hora. Feche esta issue para parar.`,
          });
        }
      } catch (e) {
        console.error(`${r.slug}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // Junta com o índice existente: rotas fechadas saem, as não atualizadas agora ficam como estavam.
  const idxArq = path.join(DADOS, 'rotas.json');
  const anterior = fs.existsSync(idxArq) ? JSON.parse(fs.readFileSync(idxArq, 'utf8')) : [];
  let indice;
  if (arg && !/^\d+$/.test(arg)) {
    indice = [...anterior.filter(x => !lista.some(l => l.slug === x.slug)), ...lista];
  } else if (arg) {
    indice = [...anterior.filter(x => !lista.some(l => l.slug === x.slug)), ...lista];
  } else {
    const abertas = new Set(rotas.map(r => r.slug));
    indice = [...anterior.filter(x => abertas.has(x.slug) && !lista.some(l => l.slug === x.slug)), ...lista];
  }
  indice.sort((a, b) => a.ida.localeCompare(b.ida));
  fs.writeFileSync(idxArq, JSON.stringify(indice, null, 1));
})().catch(e => {
  console.error('ERRO: ' + e.message);
  process.exitCode = 1;
});
