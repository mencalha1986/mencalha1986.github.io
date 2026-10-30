// Busca os voos no Google Voos (em reais e em euros), gera o index.html da raiz
// do site e publica com git push. Datas e rota ficam em config.json.
// Uso: node atualizar.js            (busca, gera e publica)
//      node atualizar.js --sem-push (busca e gera, sem publicar)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const AQUI = __dirname;
const RAIZ = path.join(AQUI, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(AQUI, 'config.json'), 'utf8'));
const HIST_FILE = path.join(AQUI, 'historico.json');
const LOG_FILE = path.join(AQUI, 'ultimo.log');
const SEM_PUSH = process.argv.includes('--sem-push') || CFG.publicar === false;

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

const logLines = [];
function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`;
  logLines.push(linha);
  console.log(linha);
}

function urlGoogle(moeda) {
  const q = `Flights from ${CFG.origem} to ${CFG.destino} on ${CFG.ida} through ${CFG.volta}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=pt-BR&curr=${moeda}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function buscar(browser, moeda) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(urlGoogle(moeda), { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Tela de consentimento de cookies (aparece em alguns acessos): recusa tudo.
  if (/consent\.google/.test(page.url())) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(b => /Rejeitar tudo|Recusar tudo|Reject all/i.test(b.innerText));
      if (b) b.click();
    });
    await page.waitForNavigation({ timeout: 30000 }).catch(() => {});
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1500);
    const pronto = await page.evaluate(() =>
      !/Buscando resultados/.test(document.body.innerText) && /ida e volta/.test(document.body.innerText));
    if (pronto) break;
  }
  const clicou = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /Mostrar mais voos/.test(b.innerText));
    if (b) { b.click(); return true; }
    return false;
  });
  if (clicou) await sleep(7000);

  const linhas = await page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .map(li => li.innerText.split('\n').map(x => x.trim()).filter(x => x && x !== '–'))
      .filter(l => l.some(x => /^[A-Z]{3}–[A-Z]{3}$/.test(x)) && l.some(x => /(R\$|€)\s?[\d.]+/.test(x)) && l.join(' ').length < 400));
  await page.close();

  const vistos = new Set();
  return linhas.map(parse).filter(v => {
    if (!v) return false;
    const k = chave(v);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

function minutos(txt) {
  const m = txt.match(/(\d+)h(?:\s*(\d+)\s*min)?/);
  return m ? (+m[1]) * 60 + (+(m[2] || 0)) : 0;
}
const fmtDur = min => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

function parse(l) {
  const iRota = l.findIndex(x => /^[A-Z]{3}–[A-Z]{3}$/.test(x));
  const iPreco = l.findIndex(x => /(R\$|€)\s?[\d.]+/.test(x));
  const iDur = l.findIndex(x => /^\d+h(\s*\d+\s*min)?$/.test(x));
  const iParadas = l.findIndex(x => /parada|Sem escalas/.test(x));
  if (iRota < 0 || iPreco < 0 || iDur < 0 || iParadas < 0) return null;

  const [cia, op = ''] = l[2].split('Operado por');
  const companhia = cia.replace(/([a-z])([A-Z])/g, '$1 / $2').replace(/,\s*/g, ' / ').trim();
  const operador = [...new Set(op.split(',').map(s => s.trim()).filter(Boolean))].join(', ');
  const paradas = /Sem escalas/.test(l[iParadas]) ? 0 : parseInt(l[iParadas], 10);
  const detalhe = paradas > 0 && !/CO2/.test(l[iParadas + 1] || '') ? l[iParadas + 1] : '';
  const valor = +l[iPreco].replace(/[^\d]/g, '');

  return {
    saida: l[0], chegada: l[1].replace('+1', '⁺¹'),
    companhia, operador,
    duracao: minutos(l[iDur]),
    chega: l[iRota].split('–')[1],
    paradas, detalhe,
    moeda: /€/.test(l[iPreco]) ? 'EUR' : 'BRL', valor,
  };
}

const chave = v => [v.saida, v.chegada, v.chega, v.paradas].join('|');

function juntar(brl, eur) {
  const mapa = new Map();
  for (const v of brl) mapa.set(chave(v), { ...v, brl: v.valor, eur: null });
  for (const v of eur) {
    const k = chave(v);
    if (mapa.has(k)) mapa.get(k).eur = v.valor;
    else mapa.set(k, { ...v, brl: null, eur: v.valor });
  }
  return [...mapa.values()].sort((a, b) => (a.brl ?? a.eur * 6.1) - (b.brl ?? b.eur * 6.1));
}

// "4h 20 min GRU" -> "GRU 4h20"; "MAD, REC" fica igual.
function textoParada(v) {
  if (v.paradas === 0) return 'sem escala';
  const m = v.detalhe.match(/^(\d+h(?:\s*\d+\s*min)?)\s+([A-Z]{3})$/);
  const d = m ? `${m[2]} ${fmtDur(minutos(m[1]))}` : v.detalhe;
  return `${v.paradas}${d ? ' · ' + d : ''}`;
}
const esperaMin = v => { const m = v.detalhe.match(/^(\d+h(?:\s*\d+\s*min)?)\s+[A-Z]{3}$/); return m ? minutos(m[1]) : 0; };

function escolher(voos) {
  const comBrl = voos.filter(v => v.brl);
  const barato = comBrl[0];
  const limite = barato.brl * 1.15;
  // Cada hora de viagem conta como R$ 100 ao comparar os voos mais curtos que o mais barato.
  const custo = v => v.brl + v.duracao / 60 * 100;
  const rapido = comBrl
    .filter(v => v !== barato && v.brl <= limite && v.duracao < barato.duracao)
    .sort((a, b) => custo(a) - custo(b))[0] || null;
  const direto = comBrl.filter(v => v.paradas === 0).sort((a, b) => a.brl - b.brl)[0] || null;
  return { barato, rapido, direto };
}

// ---------- HTML ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = x => x == null ? '—' : x.toLocaleString('pt-BR');
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dataLonga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return `${DIAS[dt.getUTCDay()]} ${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`;
}
const dataCurta = iso => iso.split('-').reverse().slice(0, 2).join('/');
const tsMeioDia = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d, 12); };

function descVoo(v) {
  const p = v.paradas === 0 ? 'sem escala' : `${v.paradas} parada${v.paradas > 1 ? 's' : ''}${v.detalhe ? ' (' + textoParada(v).split(' · ')[1] + ')' : ''}`;
  return `${v.companhia}, sai ${v.saida}, ${p}, chega em ${v.chega} ${v.chegada}. ${fmtDur(v.duracao)} no total.`;
}

function chips(v, sel) {
  const c = [];
  if (v === sel.barato) c.push('<span class="chip best">menor preço</span>');
  if (v === sel.rapido) c.push('<span class="chip good">bom tempo</span>');
  if (v.paradas === 0) c.push('<span class="chip good">direto</span>');
  if (/Mudança de aeroporto/.test(v.detalhe)) c.push('<span class="chip warn">troca de aeroporto</span>');
  else if (esperaMin(v) >= 8 * 60) c.push('<span class="chip warn">espera longa</span>');
  else if (v.duracao > 20 * 60) c.push('<span class="chip warn">longo</span>');
  return c.join(' ');
}

function grafico(hist) {
  const pts = hist.filter(h => h.brl).slice(-30);
  if (pts.length < 2) return '<p class="note">O gráfico aparece a partir da segunda atualização.</p>';
  const W = 640, H = 140, P = 28;
  const vals = pts.map(p => p.brl);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = i => P + i * (W - 2 * P) / (pts.length - 1);
  const y = v => H - P - (v - min) * (H - 2 * P) / span;
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.brl).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(pts.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const ult = pts[pts.length - 1];
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Menor preço por atualização">
    <line x1="${P}" x2="${W - P}" y1="${y(max)}" y2="${y(max)}" class="grid"/><line x1="${P}" x2="${W - P}" y1="${y(min)}" y2="${y(min)}" class="grid"/>
    <text x="${W - P}" y="${y(max) - 6}" text-anchor="end" class="ax">R$ ${n(max)}</text>
    <text x="${W - P}" y="${y(min) + 14}" text-anchor="end" class="ax">R$ ${n(min)}</text>
    <path d="${area}" class="area"/><path d="${linha}" class="line"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(ult.brl)}" r="4" class="dot"/>
    <text x="${P}" y="${H - 8}" class="ax">${esc(pts[0].quando)}</text>
    <text x="${W - P}" y="${H - 8}" text-anchor="end" class="ax">${esc(ult.quando)}</text>
  </svg></div>`;
}

function render(voos, hist, quando) {
  const sel = escolher(voos);
  const { barato, rapido, direto } = sel;
  const ida = CFG.ida, volta = CFG.volta;
  const titulo = `${CFG.origemNome} → Rio`;
  const pick = (rot, v, vazio) => v
    ? `<div class="pick"><span class="label">${rot}</span><span class="price">R$ ${n(v.brl)}<small>€ ${n(v.eur)}</small></span><span class="desc">${esc(descVoo(v))}</span></div>`
    : `<div class="pick"><span class="label">${rot}</span><span class="price">—</span><span class="desc">${vazio}</span></div>`;
  const linhas = voos.map(v => `<tr${v === barato ? ' class="top"' : ''}><td><span class="air">${esc(v.companhia)}</span> ${chips(v, sel)}${v.operador && !v.operador.toLowerCase().includes(v.companhia.split(' ')[0].toLowerCase()) ? `<div class="op">operado por ${esc(v.operador)}</div>` : ''}</td><td class="times">${esc(v.saida)} → ${esc(v.chegada)}</td><td class="mono">${fmtDur(v.duracao)}</td><td>${esc(textoParada(v))}</td><td>${esc(v.chega)}</td><td class="num">${n(v.brl)}</td><td class="num">${n(v.eur)}</td></tr>`).join('\n');

  const gq = encodeURIComponent(`Flights from ${CFG.origem} to ${CFG.destino} on ${ida} through ${volta}`);
  const latam = `https://www.latamairlines.com/br/pt/oferta-voos?origin=${CFG.origem}&outbound=${ida}T12%3A00%3A00.000Z&destination=${CFG.destino}&inbound=${volta}T12%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&redemption=true&sort=RECOMMENDED`;
  const smiles = `https://www.smiles.com.br/mfe/emissao-passagem/?adults=1&cabin=ALL&children=0&departureDate=${tsMeioDia(ida)}&returnDate=${tsMeioDia(volta)}&infants=0&isFlexibleDateChecked=false&searchType=g3&segments=1&isElegible=false&originAirport=${CFG.origem}&originAirportIsAny=false&destinationAirport=${CFG.destino}&destinAirportIsAny=true&novo-resultado-voos=true&tripType=1`;

  const histRows = hist.slice(-10).reverse().map(h =>
    `<tr><td>${esc(h.quando)}</td><td class="num">${n(h.brl)}</td><td class="num">${n(h.eur)}</td><td class="num">${n(h.direto)}</td></tr>`).join('');

  return fs.readFileSync(path.join(AQUI, 'template.html'), 'utf8')
    .replace(/{{TITULO}}/g, esc(titulo))
    .replace(/{{ORIGEM}}/g, esc(CFG.origem))
    .replace(/{{ORIGEM_NOME}}/g, esc(CFG.origemNome))
    .replace(/{{DESTINO}}/g, esc(CFG.destino))
    .replace(/{{IDA_LONGA}}/g, dataLonga(ida))
    .replace(/{{VOLTA_LONGA}}/g, dataLonga(volta))
    .replace(/{{IDA_CURTA}}/g, dataCurta(ida))
    .replace(/{{VOLTA_CURTA}}/g, dataCurta(volta))
    .replace(/{{QUANDO}}/g, esc(quando))
    .replace(/{{MIN_BRL}}/g, n(barato.brl))
    .replace(/{{MIN_BRL_RAW}}/g, String(barato.brl))
    .replace(/{{MIN_EUR}}/g, n(barato.eur))
    .replace(/{{MIN_CIA}}/g, esc(barato.companhia + (barato.paradas ? ' via ' + (barato.detalhe.match(/[A-Z]{3}/) || [''])[0] : ' direto')))
    .replace('{{PICKS}}', [
      pick('Mais barato', barato),
      pick('Melhor custo × tempo', rapido, 'O mais barato já é o mais rápido entre os de preço parecido.'),
      pick('Direto', direto, 'Nenhum voo direto apareceu nesta busca.'),
    ].join('\n'))
    .replace('{{LINHAS}}', linhas)
    .replace('{{GRAFICO}}', grafico(hist))
    .replace('{{HIST}}', histRows)
    .replace(/{{URL_BRL}}/g, `https://www.google.com/travel/flights?q=${gq}&hl=pt-BR&curr=BRL`)
    .replace(/{{URL_EUR}}/g, `https://www.google.com/travel/flights?q=${gq}&hl=pt-BR&curr=EUR`)
    .replace(/{{URL_LATAM}}/g, latam)
    .replace(/{{URL_SMILES}}/g, smiles.replace(/&/g, '&amp;'));
}

function git(...args) {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
}

(async () => {
  if (!EDGE) throw new Error('Microsoft Edge não encontrado.');
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--lang=pt-BR', '--window-size=1280,900'],
  });
  let brl, eur;
  try {
    brl = await buscar(browser, 'BRL');
    log(`BRL: ${brl.length} voos`);
    await sleep(4000);
    eur = await buscar(browser, 'EUR');
    log(`EUR: ${eur.length} voos`);
  } finally {
    await browser.close();
  }
  if (!brl.length) throw new Error('Nenhum voo em reais encontrado; a página não foi alterada.');

  const voos = juntar(brl, eur);
  const quando = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', ' às') + ' (Brasília)';

  const hist = fs.existsSync(HIST_FILE) ? JSON.parse(fs.readFileSync(HIST_FILE, 'utf8').replace(/^﻿/, '')) : [];
  const sel = escolher(voos);
  hist.push({
    data: new Date().toISOString(), quando: quando.replace(' (Brasília)', ''),
    ida: CFG.ida, volta: CFG.volta,
    brl: sel.barato.brl, eur: sel.barato.eur, direto: sel.direto ? sel.direto.brl : null,
  });
  // Só guarda o histórico das datas atuais.
  const histAtual = hist.filter(h => h.ida === CFG.ida && h.volta === CFG.volta);
  fs.writeFileSync(HIST_FILE, JSON.stringify(histAtual, null, 2));
  fs.writeFileSync(path.join(RAIZ, 'index.html'), render(voos, histAtual, quando));
  log(`Menor preço: R$ ${sel.barato.brl} / € ${sel.barato.eur}`);

  if (!SEM_PUSH) {
    git('add', '-A');
    if (git('status', '--porcelain')) {
      git('commit', '-m', `Atualiza voos ${CFG.origem}-${CFG.destino} (${quando})`);
      git('push');
      log('Publicado.');
    } else log('Nada mudou.');
  }
})().catch(e => {
  log('ERRO: ' + e.message);
  process.exitCode = 1;
}).finally(() => fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n'));
