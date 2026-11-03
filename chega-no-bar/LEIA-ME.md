# CHEGA NO BAR — jogo para TikTok LIVE

Um bêbado precisa atravessar a rua até o bar. A audiência manda presentes para ajudar (ou atrapalhar).
Formato vertical 9:16 (1080×1920), feito para ser capturado pelo **TikTok LIVE Studio**.

---

## 1. Como iniciar (sem instalar nada)

1. Descompacte a pasta `chega-no-bar` em qualquer lugar do seu PC.
2. Dê dois cliques em **`index.html`** (Chrome ou Edge recomendados).
3. Clique na tela para começar — o clique libera som e voz no navegador.

Pronto. Tudo é local: fontes, gráficos e sons estão dentro da pasta (nenhum arquivo externo).

### Modo de teste (ensaio antes da live)
O painel lateral simula presentes **sem conexão com o TikTok**.

| Tecla | Ação |
|---|---|
| `1` Rosa | avança 3 m |
| `2` TikTok | avança 10 m |
| `3` Turbo | corre por 6 s |
| `4` Cerveja | +14 m, mas fica mais tonto |
| `5` Voltar | volta 14 m |
| `6` Tropeço | cai e precisa levantar |
| `7` Especial | GAME OVER (evento configurável) |
| `8` Cachorro | um vira-lata faz xixi na perna dele (fica parado uns 5 s) |
| `← →` | desviar (modo manual; também dá para segurar o lado esquerdo/direito da tela) |
| `C` | alterna controle manual / automático |
| `D` | demo automático (presentes aleatórios) |
| `W` | testar a chegada no bar |
| `R` | nova rodada |
| `V` | liga/desliga voz · `M` silencia tudo |
| `H` | esconde/mostra o painel de teste |
| `F` | tela cheia |

Atalhos de URL: `index.html?demo=1` (demo ligado), `?painel=0` (painel escondido), `?voz=0` (sem voz).

### Homem ou mulher
Na tela inicial, clique no cartão **HOMEM** ou **MULHER** (ou em "Alternar a cada rodada").
Durante o jogo: tecla **G** ou o seletor "Personagem" no painel de teste (vale a partir da próxima rodada).
Também dá para abrir direto com `index.html?personagem=mulher`. A escolha fica salva.
A mulher tem visual, voz e falas próprias ("ELA CONSEGUIU!", "tô molhada e bêbada"...).

---

## 2. Usando no TikTok LIVE Studio

1. Abra o `index.html` numa janela própria do navegador e aperte **`H`** para esconder o painel de teste.
2. Deixe a janela alta (vertical). O jogo se ajusta mantendo 9:16 com faixas pretas nas sobras;
   em tela cheia (`F`) num monitor deitado também funciona — basta recortar a captura.
3. No LIVE Studio, use uma cena **vertical** e adicione uma fonte de **captura de janela** apontando
   para a janela do navegador. Ajuste/recorte para o quadro 9:16 preencher a tela.
4. O áudio do jogo (música, efeitos e voz) sai pelo som do sistema; garanta que a captura de áudio
   do LIVE Studio inclua o som do PC/navegador.

A interface já respeita as áreas que o TikTok cobre: nada importante fica no topo (cabeçalho do perfil)
nem na parte de baixo (comentários).

---

## 3. Recebendo presentes de verdade

O jogo **não** se conecta direto ao TikTok e não simula essa conexão. Ele recebe eventos de presente
de uma **ferramenta de eventos de live autorizada** que você rode no seu PC, por meio de um WebSocket local:

```
index.html?ws=ws://localhost:PORTA
```

Quando conectado, o selo no topo muda de **MODO TESTE** para **AO VIVO**.

Formato de mensagem recomendado (JSON):

```json
{ "type": "gift", "user": "@fulano", "gift": "Rose", "count": 5 }
```

Também são entendidos campos comuns como `nickname`/`uniqueId`, `giftName`, `repeatCount` e envelopes
`{ "event": "gift", "data": { ... } }`. Combos em andamento (`repeatEnd: false`) são ignorados até o fim.

Se a sua ferramenta só consegue rodar JavaScript na página, chame diretamente:

```js
ChegaNoBar.gift('@fulano', 'Rose', 3)
```

Confira se a ferramenta escolhida segue os termos do TikTok — use apenas soluções autorizadas.

### Ligando presentes do TikTok às ações
Em `js/config.js`, a tabela **`giftAliases`** traduz o nome do presente que chega da live para a ação do jogo.
Exemplo: `'rose': 'rosa'`, `'galaxy': 'especial'`. Troque pelos presentes que você usa.

---

## 4. Ajustes rápidos (`js/config.js`)

- `trackLength` — tamanho da rua (300 m). Menor = rodadas mais curtas.
- `autoWalkSpeed` — quanto ele anda sozinho sem presentes (0 = parado).
- `gifts` — metros de cada presente, duração do turbo, pontos no ranking, cor, tecla.
- `specialEvents` — eventos de GAME OVER (`dormiu`, `esposa`); crie outros e aponte em `gifts.especial.event`.
- `voice` — velocidade, tom e vozes preferidas.
- `restartCountdown`, `winCelebrationTime` — tempos da comemoração e da contagem.
- `ui.safeTop` — margem superior caso o cabeçalho do TikTok cubra a barra.

---

## 5. Análise e o que foi reconstruído

O código anterior não veio junto com a especificação, então o jogo foi reconstruído do zero, eliminando
tudo o que a especificação rejeita:

| Antes (descartado) | Agora |
|---|---|
| Emojis como personagem | Personagem vetorial articulado (quadril, joelhos, cotovelos, cabeça) com rosto expressivo |
| Skyline / prédios no fundo | Rua de bairro com muros baixos, postes e árvores; o único destaque ao fundo é o BAR |
| Bar que só aumenta de tamanho | Projeção em perspectiva real: tudo (rua, postes, obstáculos, bar) usa a mesma câmera 3D |
| Queda = rotação de emoji | Estados com poses: andar, correr, tropeçar, cair, ficar no chão tonto, levantar, voltar, comemorar, dormir |
| Fundo estático | Chão, faixas, remendos e muros rolam com a distância; câmera acompanha e balança |

---

## 6. Arquitetura

```
index.html            página 9:16 + painel de teste
css/style.css         layout, fontes locais, painel
fonts/                Bebas Neue + Rubik (licença OFL)
js/config.js          tudo que é configurável
js/utils.js           matemática, ruído, cores, desenho
js/audio.js           motor de áudio Web Audio: samba procedural + efeitos sintetizados
js/voice.js           falas por contexto (Web Speech API) + ganchos para voz gravada
js/world.js           câmera em perspectiva, rua, cenário, obstáculos e o bar
js/drunk.js           personagem articulado + máquina de estados
js/effects.js         confete, poeira, faíscas, textos flutuantes, linhas de velocidade
js/hud.js             interface da live (progresso, ranking, feed, balões, telas)
js/gifts.js           normaliza presentes, ranking e estatísticas da rodada
js/bridge.js          integração WebSocket com a live + modo de teste/demo (separados)
js/game.js            loop (requestAnimationFrame), câmera, colisões, rodadas e chegada
js/main.js            inicialização, teclado e painel
```

- **Perspectiva**: cada ponto (x, altura, distância) é projetado com `escala = focal / (z − z_câmera)`.
  O bar está a ~314 m no eixo da rua; ele começa minúsculo no horizonte e cresce com a perspectiva verdadeira.
- **Física/colisão**: velocidade com amortecimento, impulso acumulado dos presentes, ziguezague por ruído,
  desvio de obstáculos com chance de falha (maior quanto mais bêbado), recuo ao bater.
- **Máquina de estados** (`drunk.js`): `walk → run → stumble → fall → down → getup`, `back`, `arrive → win`, `sleep`.
- **Áudio independente**: tudo sintetizado em tempo real; nenhum arquivo de som necessário.

---

## 7. Assets opcionais (para elevar ainda mais)

O jogo está completo sem arquivos externos. Se quiser ir além:

- **Voz do personagem**: as 60 falas já vêm gravadas em `sounds/voz/` (homem) e `sounds/voz-mulher/` (mulher),
  com voz neural em português do Brasil gerada offline e efeito de bebedeira. Não dependem das vozes do computador.
- **Voz 100% humana — Estúdio de Vozes**: abra `gravar-vozes.html` (ou o botão "Gravar vozes com microfone" no painel
  de teste), escolha Homem ou Mulher, clique em "Ativar microfone" e grave frase por frase (Espaço grava/para).
  Cada fala gravada substitui a sintética na hora. As gravações ficam salvas **neste navegador** — grave no mesmo
  computador e navegador que você usa na live (Chrome ou Edge). Limpar os dados do navegador apaga as gravações.
- **Novas frases**: edite `tools/frases.json` e as listas em `js/voice.js`, depois rode `tools/gerar_vozes.py`
  (instruções no topo do arquivo). Frases sem áudio usam a voz do sistema como reserva.

## Para transmitir só o jogo (sem painel e sem faixas pretas)
1. Abra o link do jogo no Chrome (esta janela vira o **controle remoto**).
2. No painel, clique em **📺 Abrir janela da live (só o jogo)**. Abre uma janela separada, vertical, só com o jogo.
3. Clique uma vez nessa janela nova (libera o som).
4. No LIVE Studio, capture **essa janela nova** (Captura de janela).
5. Controle tudo pela janela antiga: botões, teclas 1–9, setas, D, R… vão para a janela da live.
   A janela antiga fica sem som e desconectada; quem recebe os presentes do TikFinity é a janela da live.
