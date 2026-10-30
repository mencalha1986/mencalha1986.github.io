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

// "Razoável": até 1 parada, até 20h e sem escala nos EUA ou no Canadá (pode exigir visto ou eTA).
const EUA_CANADA = /\b(YYZ|YUL|YVR|YYC|YOW|YHZ|JFK|EWR|LGA|MIA|FLL|MCO|ATL|IAD|DCA|BOS|ORD|IAH|DFW|LAX|SFO|CLT|PHL|DTW|MSP|SEA|DEN|PHX|LAS|TPA)\b/;
const razoavel = v => v.eur && v.paradas <= 1 && v.duracao <= 20 * 60 && !EUA_CANADA.test(v.detalhe || '');

// Metas no corpo da issue: "avisar abaixo de: 1600" e "direto abaixo de: 1900" (em euros).
function lerMetas(corpo) {
  const n = re => { const m = (corpo || '').match(re); return m ? Number(m[1].replace(/\./g, '')) : null; };
  return { razoavel: n(/avisar abaixo de:?\s*€?\s*([\d.]+)/i), direto: n(/direto abaixo de:?\s*€?\s*([\d.]+)/i) };
}

// Avisa (comentário na issue = e-mail do GitHub) quando o preço razoável ou o direto cruza a meta
// ou bate um novo mínimo pelo menos € 100 abaixo do anterior.
function alertas(rota, historico) {
  const ult = historico[historico.length - 1], ant = historico.slice(0, -1);
  const fmt = v => '€ ' + v.toLocaleString('pt-BR');
  const msgs = [];
  for (const [campo, nome] of [['razoavel', 'razoável (até 1 parada, até 20h, sem EUA/Canadá)'], ['direto', 'do voo direto']]) {
    const agora = ult?.[campo + 'Eur'];
    if (!agora) continue;
    const vistos = ant.map(h => h[campo + 'Eur']).filter(Boolean);
    const minimo = vistos.length ? Math.min(...vistos) : null;
    const anterior = vistos.length ? vistos[vistos.length - 1] : null;
    const meta = rota.metas?.[campo];
    const desc = campo === 'razoavel' ? ult.razoavelCia : ult.diretoCia;
    if (meta && agora < meta && !(anterior && anterior < meta)) {
      msgs.push(`✈️ Preço ${nome} caiu para **${fmt(agora)}** (${desc}), abaixo da sua meta de ${fmt(meta)}.${anterior ? ` Antes: ${fmt(anterior)}.` : ''}`);
    } else if (minimo && agora <= minimo - 100) {
      msgs.push(`✈️ Novo menor preço ${nome}: **${fmt(agora)}** (${desc}). O menor até agora era ${fmt(minimo)}.`);
    }
  }
  return msgs;
}

async function atualizar(browser, rota) {
  const arq = path.join(DADOS, `${rota.slug}.json`);
  const antigo = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { historico: [] };
  const { voos, semResultado } = await buscarRota(browser, rota);
  const agora = new Date().toISOString();
  const sel = escolher(voos);
  const historico = antigo.historico || [];
  if (sel.barato) {
    const raz = voos.filter(razoavel).sort((a, b) => a.eur - b.eur)[0];
    const cia = v => v && `${v.companhia}${v.paradas ? ', ' + v.detalhe : ', direto'}`;
    historico.push({
      quando: agora, brl: sel.barato.brl, eur: sel.barato.eur, direto: sel.direto?.brl ?? null,
      razoavelEur: raz?.eur ?? null, razoavelCia: cia(raz), diretoEur: sel.direto?.eur ?? null, diretoCia: cia(sel.direto),
    });
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
  // "teste-aviso": só comenta na issue 1, para conferir se o e-mail do GitHub chega.
  if (arg === 'teste-aviso') {
    await gh('POST', '/issues/1/comments', { body: `@${REPO.split('/')[0]} 🔔 Teste de aviso: se este e-mail chegou, os alertas de queda de preço vão chegar também. Veja: ${SITE}` });
    return;
  }
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
      r.metas = lerMetas(is.body);
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
        const avisos = r.issue && TOKEN && !d.erro ? alertas(r, d.historico) : [];
        if (avisos.length) {
          await gh('POST', `/issues/${r.issue}/comments`, {
            body: `@${REPO.split('/')[0]} ${avisos.join('\n\n')}\n\nVeja os voos: ${SITE}#${r.slug}`,
          });
        }
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
