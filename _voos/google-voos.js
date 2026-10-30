// Busca uma rota no Google Voos com um navegador sem janela e devolve os voos.
// Funciona no Windows (Edge) e no GitHub Actions (Chrome do runner).
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const NAVEGADORES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function abrirNavegador() {
  const exe = NAVEGADORES.find(p => fs.existsSync(p));
  if (!exe) throw new Error('Nenhum navegador encontrado.');
  return puppeteer.launch({
    executablePath: exe, headless: true,
    args: ['--lang=pt-BR', '--window-size=1280,900', '--no-sandbox'],
  });
}

function urlGoogle(r, moeda) {
  const q = r.volta
    ? `Flights from ${r.origem} to ${r.destino} on ${r.ida} through ${r.volta}`
    : `One way flights from ${r.origem} to ${r.destino} on ${r.ida}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&curr=${moeda}`;
}

async function buscarMoeda(browser, r, moeda) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
  await page.goto(urlGoogle(r, moeda), { waitUntil: 'domcontentloaded', timeout: 60000 });

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
      !/Buscando resultados/.test(document.body.innerText) && /ida e volta|só ida|somente ida/i.test(document.body.innerText));
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
  const texto = linhas.length ? '' : (await page.evaluate(() => document.body.innerText.slice(0, 300)));
  await page.close();

  const vistos = new Set();
  const voos = linhas.map(parse).filter(v => {
    if (!v) return false;
    const k = chave(v);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return { voos, texto };
}

function minutos(txt) {
  const m = txt.match(/(\d+)h(?:\s*(\d+)\s*min)?/);
  return m ? (+m[1]) * 60 + (+(m[2] || 0)) : 0;
}

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
  const [sai, chega] = l[iRota].split('–');

  return {
    saida: l[0], chegada: l[1].replace('+1', '⁺¹'),
    companhia, operador,
    duracao: minutos(l[iDur]),
    sai, chega, paradas, detalhe,
    valor: +l[iPreco].replace(/[^\d]/g, ''),
  };
}

const chave = v => [v.saida, v.chegada, v.chega, v.paradas].join('|');

// Busca em reais e em euros e junta os dois pelo horário do voo.
async function buscarRota(browser, r) {
  const brl = await buscarMoeda(browser, r, 'BRL');
  await sleep(3000);
  const eur = await buscarMoeda(browser, r, 'EUR');
  const mapa = new Map();
  for (const v of brl.voos) mapa.set(chave(v), { ...v, brl: v.valor, eur: null });
  for (const v of eur.voos) {
    const k = chave(v);
    if (mapa.has(k)) mapa.get(k).eur = v.valor;
    else mapa.set(k, { ...v, brl: null, eur: v.valor });
  }
  const voos = [...mapa.values()]
    .map(({ valor, ...v }) => v)
    .sort((a, b) => (a.brl ?? a.eur * 6.1) - (b.brl ?? b.eur * 6.1));
  return { voos, semResultado: voos.length ? null : (brl.texto || eur.texto) };
}

module.exports = { abrirNavegador, buscarRota, urlGoogle, minutos };
