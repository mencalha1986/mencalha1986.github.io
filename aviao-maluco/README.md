# AVIÃO MALUCO — jogo de carga aérea para TikTok LIVE

O avião de carga do **Achados Úteis Por Aí** leva caixas com **achados do site** (foto, nome e preço reais)
desviando de prédios, guindastes, dirigíveis e balões. No fim ele **pousa no aeroporto** e o **caminhão
da marca chega de ré e descarrega as caixas**, mostrando cada produto. Depois aparece o resumo com QR do site
e os heróis do voo.

**Jogar:** https://mencalha1986.github.io/aviao-maluco/

## Presentes (o último presente cancela a ação anterior)
| Tecla | Presente do TikTok | Efeito |
|---|---|---|
| 1 | Rose | empurra +40 m |
| 2 | TikTok | empurra +150 m |
| 3 | Finger Heart | **um caça chega e reboca o avião** bem rápido por 6 s (com o nome de quem mandou) |
| 4 | Doughnut | um urubu vem direto, bate no avião (PÁ!) e ele volta 50 m |
| 5 | GG | vento contra: o avião volta 60 m |
| 6 | Ice Cream Cone | pane no motor: fumaça e volta 40 m |
| 7 | Galaxy | **MÍSSIL**: explode o avião (GAME OVER) |
| 8 | Heart Me | looping radical |
| 9 | Seguir (grátis) | cai uma caixa de paraquedas com o nome do novo seguidor |

**Combo:** presentes seguidos (até 3 s entre um e outro) deixam o próximo mais forte (até 2,5×).
**Ajuda x Sabotagem:** a barra no topo mostra quantos metros a live empurrou para frente e para trás.
**Recorde:** o menor tempo até o aeroporto fica salvo e aparece no final.

Cada batida derruba uma caixa (aparece qual produto caiu). Sem vozes neste jogo.
Distância, quantidade de caixas, velocidade e dificuldade: `js/config.js` (`goal`, `crates`, `gap`, `spacing`).

## Controles
Começa no automático (às vezes erra). Espaço / ↑ / clique assume; 5 s sem mexer volta ao automático.
`D` demo · `R` novo voo · `W` pula para o pouso · `M` som · `H` painel · `F` tela cheia.

## Na live
1. Abra o link no Chrome, cole o endereço do TikFinity em **Conexão da live** e clique em **Conectar**.
2. Clique em **📺 Abrir janela da live (só o jogo)** e clique uma vez na janela nova (libera o som).
3. No LIVE Studio, capture a janela nova. Controle tudo pela janela antiga.
