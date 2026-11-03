"""Uso: pip install kokoro-onnx soundfile scipy numpy
   Baixe kokoro-v1.0.int8.onnx e voices-v1.0.bin em https://github.com/thewh1teagle/kokoro-onnx/releases para esta pasta.
   Edite frases.json e rode:  python gerar_vozes.py   (homem)   ou   python gerar_vozes.py mulher
   Gera as falas do bêbado com voz neural pt-BR (Kokoro, offline) + efeito de bebedeira.
Saída: chega-no-bar/sounds/voz/*.mp3 e chega-no-bar/js/voice-clips.js"""
import json, os, re, subprocess, unicodedata, hashlib, sys
FEM = len(sys.argv) > 1 and sys.argv[1] == 'mulher'
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
OUT = os.path.join(GAME, 'sounds', 'voz-mulher' if FEM else 'voz')
os.makedirs(OUT, exist_ok=True)
frases = json.load(open(os.path.join(HERE, 'frases.json')))
FEM_TEXT = {'Pronto... tô molhado e bêbado.': 'Pronto... tô molhada e bêbada.', 'Foi o tênis... foi o tênis.': 'Foi o salto... foi o salto.'}
if FEM: frases = [FEM_TEXT.get(f, f) for f in frases]
k = Kokoro(os.path.join(HERE, 'kokoro-v1.0.int8.onnx'), os.path.join(HERE, 'voices-v1.0.bin'))
# timbre: mistura das duas vozes masculinas, puxando para a mais grave/rouca
voice = k.get_voice_style('pf_dora') if FEM else k.get_voice_style('pm_santa') * 0.7 + k.get_voice_style('pm_alex') * 0.3

def slug(t):
    s = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')[:40]
    return s + '_' + hashlib.md5(t.encode()).hexdigest()[:4]

def smooth_noise(n, sr, rate, seed):
    rng = np.random.default_rng(seed)
    pts = rng.uniform(-1, 1, int(n / sr * rate) + 3)
    x = np.linspace(0, len(pts) - 2, n)
    i = x.astype(int); f = x - i; f = f * f * (3 - 2 * f)
    return pts[i] * (1 - f) + pts[i + 1] * f

def drunkify(x, sr, shout, seed):
    n = len(x)
    # 1) "vari-speed" com oscilação lenta: arrasta, embola e desafina de leve, como bêbado
    base = (0.98 if shout else 0.94) if FEM else (0.97 if shout else 0.915)
    wob = (0.03 if shout else 0.06) * smooth_noise(n, sr, 1.6, seed) + 0.018 * np.sin(np.arange(n) / sr * 2 * np.pi * 0.55)
    rate = base * (1 + wob)
    pos = np.cumsum(rate)
    pos = pos[pos < n - 1]
    y = np.interp(pos, np.arange(n), x)
    # 2) boca mole: tira brilho, encorpa o grave
    y = sosfilt(butter(2, 4300 if not shout else 6000, 'low', fs=sr, output='sos'), y)
    y = y + 0.25 * sosfilt(butter(2, 220, 'low', fs=sr, output='sos'), y)
    # 3) leve rouquidão/saturação
    y = np.tanh(y * (2.2 if shout else 1.6)) / np.tanh(2.2 if shout else 1.6)
    # 4) ambiente de rua (eco curtinho)
    ir = np.zeros(int(sr * 0.35)); rng = np.random.default_rng(seed + 9)
    ir += rng.normal(0, 1, len(ir)) * np.exp(-np.linspace(0, 9, len(ir)))
    ir[0] = 0; ir /= np.abs(ir).sum()
    y = y + 0.9 * np.convolve(y, ir)[:len(y)]
    y = y / (np.abs(y).max() + 1e-6) * 0.92
    # respiro antes e depois
    pad = np.zeros(int(sr * 0.08))
    return np.concatenate([pad, y, pad * 2])

def tts_text(t):
    s = t.replace('...', ', ').replace('…', ', ')
    s = re.sub(r'\s+', ' ', s).strip(' ,')
    if s.upper() == s: s = s.lower()  # gritos: o efeito vem da velocidade/energia
    return s

clips = {}
for idx, t in enumerate(frases):
    shout = t.upper() == t
    text = tts_text(t)
    samples, sr = k.create(text, voice=voice, speed=0.98 if shout else 0.8, lang='pt-br')
    y = drunkify(np.asarray(samples, dtype=np.float64), sr, shout, idx)
    name = slug(t)
    wav = os.path.join(HERE, name + '.wav')
    sf.write(wav, y, sr)
    mp3 = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '64k', mp3], check=True)
    clips[t] = {'src': ('sounds/voz-mulher/' if FEM else 'sounds/voz/') + name + '.mp3', 'dur': round(len(y) / sr, 2)}
    print(f'{idx+1:02d}/{len(frases)} {clips[t]["dur"]:5.2f}s  {t}')

js = '/* Gerado automaticamente: falas com voz neural pt-BR + efeito de bebedeira.\n   Para trocar por gravações de verdade, substitua os .mp3 em sounds/voz/ mantendo os nomes. */\n'
js += ('CNB.VOICE_CLIPS_F = ' if FEM else 'CNB.VOICE_CLIPS = ') + json.dumps(clips, ensure_ascii=False, indent=1) + ';\n'
open(os.path.join(GAME, 'js', 'voice-clips-mulher.js' if FEM else 'voice-clips.js'), 'w').write(js)
print('ok', len(clips))
