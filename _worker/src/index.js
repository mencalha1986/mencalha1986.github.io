// API de busca de voos (Cloudflare Worker).
// GET /buscar?origem=LIS&destino=GIG,SDU&ida=2026-12-17&volta=2027-01-02&adultos=1&cabine=economy&flex=0
// Cabeçalho X-Acesso: <CODIGO_ACESSO>
// Junta o preço em dinheiro (SerpApi, Google Voos) com a disponibilidade em milhas
// (seats.aero) e converte as taxas das milhas para reais.
// Segredos (wrangler secret put): SERPAPI_KEY, SEATS_KEY, CODIGO_ACESSO.
// Variável ORIGENS_PERMITIDAS: origens web que podem chamar a API (separadas por vírgula).

const CABINES = {
  economy: { serp: 1, letra: 'Y' },
  premium: { serp: 2, letra: 'W' },
  business: { serp: 3, letra: 'J' },
  first: { serp: 4, letra: 'F' },
};

const IATA = /^[A-Z]{3}(,[A-Z]{3}){0,5}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/saude') return json({ ok: true }, 200, cors);
    if (url.pathname !== '/buscar') return json({ erro: 'Rota não encontrada.' }, 404, cors);

    if (!env.CODIGO_ACESSO || req.headers.get('X-Acesso') !== env.CODIGO_ACESSO) {
      return json({ erro: 'Código de acesso inválido.' }, 401, cors);
    }

    const p = lerParametros(url.searchParams);
    if (p.erro) return json({ erro: p.erro }, 400, cors);

    // Mesma busca nos últimos 30 min sai do cache e não gasta cota.
    const cache = caches.default;
    const chaveCache = new Request(`https://cache.voos/${[p.origem, p.destino, p.ida, p.volta, p.adultos, p.cabine, p.flex].join('/')}`);
    const emCache = await cache.match(chaveCache);
    if (emCache) {
      const r = new Response(emCache.body, emCache);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
      r.headers.set('X-Cache', 'HIT');
      return r;
    }

    const [dinheiro, milhas, cambio] = await Promise.all([
      buscarDinheiro(p, env).catch(e => ({ erro: e.message })),
      buscarMilhas(p, env).catch(e => ({ erro: e.message })),
      buscarCambio().catch(() => null),
    ]);

    const resultado = montar(p, dinheiro, milhas, cambio);
    const resp = json(resultado, 200, cors);
    if (!dinheiro.erro && !milhas.erro) {
      const paraCache = json(resultado, 200, {});
      paraCache.headers.set('Cache-Control', 'max-age=1800');
      ctx.waitUntil(cache.put(chaveCache, paraCache));
    }
    return resp;
  },
};

function corsHeaders(req, env) {
  const origem = req.headers.get('Origin') || '';
  const permitidas = (env.ORIGENS_PERMITIDAS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = permitidas.includes(origem) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem);
  return {
    'Access-Control-Allow-Origin': ok ? origem : permitidas[0] || '',
    'Access-Control-Allow-Headers': 'X-Acesso',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function lerParametros(q) {
  const origem = (q.get('origem') || '').toUpperCase();
  const destino = (q.get('destino') || '').toUpperCase();
  const ida = q.get('ida') || '';
  const volta = q.get('volta') || '';
  const adultos = Math.min(9, Math.max(1, parseInt(q.get('adultos') || '1', 10) || 1));
  const cabine = CABINES[q.get('cabine')] ? q.get('cabine') : 'economy';
  const flex = Math.min(3, Math.max(0, parseInt(q.get('flex') || '0', 10) || 0));
  if (!IATA.test(origem) || !IATA.test(destino)) return { erro: 'Origem e destino precisam ser códigos de aeroporto (ex.: LIS, GIG).' };
  if (!DATA.test(ida)) return { erro: 'Data de ida inválida.' };
  if (volta && !DATA.test(volta)) return { erro: 'Data de volta inválida.' };
  if (volta && volta < ida) return { erro: 'A volta não pode ser antes da ida.' };
  return { origem, destino, ida, volta, adultos, cabine, flex };
}

// ---------- Dinheiro: SerpApi (Google Voos) ----------
async function buscarDinheiro(p, env) {
  if (!env.SERPAPI_KEY) throw new Error('Chave do SerpApi não configurada.');
  const q = new URLSearchParams({
    engine: 'google_flights', api_key: env.SERPAPI_KEY,
    departure_id: p.origem, arrival_id: p.destino,
    outbound_date: p.ida, type: p.volta ? '1' : '2',
    travel_class: String(CABINES[p.cabine].serp), adults: String(p.adultos),
    currency: 'BRL', hl: 'pt-br', gl: 'br',
  });
  if (p.volta) q.set('return_date', p.volta);
  const r = await fetch(`https://serpapi.com/search?${q}`);
  const d = await r.json();
  if (d.error) throw new Error(`Google Voos: ${d.error}`);

  const voos = [...(d.best_flights || []), ...(d.other_flights || [])]
    .filter(v => v.price)
    .map(v => {
      const seg = v.flights || [];
      const pri = seg[0] || {}, ult = seg[seg.length - 1] || {};
      return {
        companhias: [...new Set(seg.map(s => s.airline))],
        logo: v.airline_logo || pri.airline_logo || null,
        saida: pri.departure_airport?.time || null,
        chegada: ult.arrival_airport?.time || null,
        de: pri.departure_airport?.id, para: ult.arrival_airport?.id,
        duracao: v.total_duration || null,
        paradas: (v.layovers || []).map(l => ({ aeroporto: l.id, duracao: l.duration, pernoite: !!l.overnight })),
        voos: seg.map(s => s.flight_number),
        preco: v.price,
      };
    })
    .sort((a, b) => a.preco - b.preco);

  const pi = d.price_insights || null;
  return {
    voos,
    insights: pi && {
      menor: pi.lowest_price ?? null,
      nivel: pi.price_level ?? null,
      faixaTipica: pi.typical_price_range ?? null,
      historico: (pi.price_history || []).map(([t, v]) => [t, v]),
    },
    linkGoogle: d.search_metadata?.google_flights_url || null,
  };
}

// ---------- Milhas: seats.aero ----------
async function buscarMilhas(p, env) {
  if (!env.SEATS_KEY) throw new Error('Chave do seats.aero não configurada.');
  const letra = CABINES[p.cabine].letra;
  const pernas = [buscarPerna(p.origem, p.destino, p.ida, p.flex, letra, env)];
  if (p.volta) pernas.push(buscarPerna(p.destino, p.origem, p.volta, p.flex, letra, env));
  const [ida, volta] = await Promise.all(pernas);
  return { ida, volta: volta || null };
}

function somaDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Melhor opção por programa numa direção: menor milhagem disponível na cabine.
async function buscarPerna(de, para, data, flex, letra, env) {
  const q = new URLSearchParams({
    origin_airport: de, destination_airport: para,
    start_date: somaDias(data, -flex), end_date: somaDias(data, flex),
    cabins: { Y: 'economy', W: 'premium', J: 'business', F: 'first' }[letra],
    include_trips: 'true', minify_trips: 'true', order_by: 'lowest_mileage', take: '200',
  });
  const r = await fetch(`https://seats.aero/partnerapi/search?${q}`, {
    headers: { 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`seats.aero respondeu ${r.status}`);
  const d = await r.json();

  const porPrograma = new Map();
  for (const a of d.data || []) {
    if (!a[`${letra}Available`]) continue;
    const trips = (a.AvailabilityTrips || []).filter(t => !t.Cabin || t.Cabin.toLowerCase().startsWith({ Y: 'economy', W: 'premium', J: 'business', F: 'first' }[letra]));
    const melhorTrip = trips.sort((x, y) => (x.MileageCost - y.MileageCost) || (x.TotalTaxes - y.TotalTaxes))[0];
    const milhas = melhorTrip?.MileageCost || parseInt(a[`${letra}MileageCost`], 10);
    if (!milhas) continue;
    const opc = {
      programa: a.Source,
      data: a.Date,
      milhas,
      taxas: melhorTrip ? melhorTrip.TotalTaxes / 100 : null,
      moedaTaxas: melhorTrip?.TaxesCurrency || null,
      companhias: melhorTrip?.Carriers || a[`${letra}Airlines`] || '',
      direto: !!a[`${letra}Direct`],
      paradas: melhorTrip?.Stops ?? null,
      assentos: a[`${letra}RemainingSeats`] || null,
      rota: `${a.Route?.OriginAirport}–${a.Route?.DestinationAirport}`,
    };
    const atual = porPrograma.get(a.Source);
    if (!atual || opc.milhas < atual.milhas || (opc.milhas === atual.milhas && opc.data === data)) porPrograma.set(a.Source, opc);
  }
  return [...porPrograma.values()].sort((a, b) => a.milhas - b.milhas);
}

// ---------- Câmbio (Banco Central Europeu via Frankfurter) ----------
async function buscarCambio() {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=BRL', { cf: { cacheTtl: 21600, cacheEverything: true } });
  const d = await r.json();
  // d.rates[XXX] = quanto 1 BRL vale em XXX; para converter XXX -> BRL divide.
  return { data: d.date, taxas: d.rates };
}

function emReais(valor, moeda, cambio) {
  if (valor == null) return null;
  if (!moeda || moeda === 'BRL') return valor;
  const t = cambio?.taxas?.[moeda];
  return t ? Math.round(valor / t * 100) / 100 : null;
}

// ---------- Resultado ----------
function montar(p, dinheiro, milhas, cambio) {
  const menorDinheiro = dinheiro.voos?.[0]?.preco ?? null;
  const programas = [];

  if (!milhas.erro) {
    const nomes = new Set([...(milhas.ida || []), ...(milhas.volta || [])].map(o => o.programa));
    for (const nome of nomes) {
      const ida = milhas.ida.find(o => o.programa === nome) || null;
      const volta = milhas.volta ? milhas.volta.find(o => o.programa === nome) || null : null;
      for (const o of [ida, volta]) if (o) o.taxasReais = emReais(o.taxas, o.moedaTaxas, cambio);
      const completo = ida && (!p.volta || volta);
      const totalMilhas = completo ? (ida.milhas + (volta?.milhas || 0)) * p.adultos : null;
      const totalTaxas = completo && ida.taxasReais != null && (!volta || volta.taxasReais != null)
        ? Math.round((ida.taxasReais + (volta?.taxasReais || 0)) * p.adultos * 100) / 100 : null;
      const valorMilheiro = totalMilhas && menorDinheiro != null && totalTaxas != null
        ? Math.round((menorDinheiro - totalTaxas) / (totalMilhas / 1000) * 100) / 100 : null;
      programas.push({ programa: nome, ida, volta, completo: !!completo, totalMilhas, totalTaxas, valorMilheiro });
    }
    programas.sort((a, b) => (b.completo - a.completo) || ((a.totalMilhas ?? 1e12) - (b.totalMilhas ?? 1e12)));
  }

  const valores = programas.map(x => x.valorMilheiro).filter(v => v != null && v > 0);
  return {
    busca: p,
    geradoEm: new Date().toISOString(),
    dinheiro: dinheiro.erro ? { erro: dinheiro.erro } : dinheiro,
    milhas: milhas.erro ? { erro: milhas.erro } : { programas },
    resumo: {
      menorDinheiro,
      mediaMilheiro: valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length * 100) / 100 : null,
      melhorMilheiro: valores.length ? Math.max(...valores) : null,
    },
    cambio: cambio && { data: cambio.data },
  };
}
