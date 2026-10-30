// Fica rodando em segundo plano: roda o atualizar.js agora e depois a cada
// "intervaloMinutos" (config.json), com alguns minutos de folga aleatória para
// não bater no Google sempre no mesmo segundo. Só uma cópia roda por vez.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AQUI = __dirname;
const LOCK = path.join(AQUI, 'monitor.pid');
const LOG = path.join(AQUI, 'monitor.log');

function log(msg) {
  const linha = `[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${msg}\n`;
  fs.appendFileSync(LOG, linha);
  // Mantém só as últimas ~500 linhas.
  const linhas = fs.readFileSync(LOG, 'utf8').split('\n');
  if (linhas.length > 600) fs.writeFileSync(LOG, linhas.slice(-500).join('\n'));
}

function jaRodando() {
  if (!fs.existsSync(LOCK)) return false;
  const pid = +fs.readFileSync(LOCK, 'utf8');
  try { process.kill(pid, 0); return pid !== process.pid; } catch { return false; }
}

if (jaRodando()) {
  console.log('O monitor já está rodando.');
  process.exit(0);
}
fs.writeFileSync(LOCK, String(process.pid));
const limpar = () => { try { if (+fs.readFileSync(LOCK, 'utf8') === process.pid) fs.unlinkSync(LOCK); } catch {} };
process.on('exit', limpar);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

function intervalo() {
  const cfg = JSON.parse(fs.readFileSync(path.join(AQUI, 'config.json'), 'utf8'));
  const min = Math.max(30, cfg.intervaloMinutos || 60);
  return (min + Math.floor(Math.random() * 10) - 5) * 60 * 1000;
}

function rodar() {
  log('Buscando voos...');
  const filho = spawn(process.execPath, [path.join(AQUI, 'atualizar.js')], { cwd: AQUI, windowsHide: true });
  let saida = '';
  filho.stdout.on('data', d => { saida += d; });
  filho.stderr.on('data', d => { saida += d; });
  const trava = setTimeout(() => filho.kill(), 5 * 60 * 1000);
  filho.on('close', code => {
    clearTimeout(trava);
    log(saida.trim().split('\n').map(l => l.replace(/^\[[^\]]+\]\s*/, '')).join(' | ') + (code ? ` (código ${code})` : ''));
    const espera = intervalo();
    log(`Próxima busca em ${Math.round(espera / 60000)} min.`);
    setTimeout(rodar, espera);
  });
}

log(`Monitor iniciado (pid ${process.pid}).`);
rodar();
