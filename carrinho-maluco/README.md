# CARRINHO MALUCO — jogo de compras para TikTok LIVE

O carrinho corre pelos corredores de uma loja catando os **achados do site achadosuteisporai.com.br**
e desviando das "furadas" até chegar ao **CAIXA**, onde sai a nota fiscal com tudo que entrou no carrinho.

**Jogar:** https://mencalha1986.github.io/carrinho-maluco/

## Os achados
O jogo carrega o `produtos.js` do seu site toda vez que abre. Ou seja: **cadastrou um achado novo no site,
ele aparece no jogo** (com foto, preço e categoria). Se o site não responder, usa a cópia `js/produtos-reserva.js`.
Cada categoria com 3 ou mais achados vira um corredor com placa e cor própria (as menores entram misturadas).

## Furadas (obstáculos)
Chão molhado, laranjas no chão, pilha de caixas, paleteira, carrinho largado, pirâmide de latas, cone,
escada do repositor, cestinha, display de oferta e dois que andam: a máquina de limpeza e o repositor carregando caixas.
Quantidade: `obstacleSpacing` em `js/config.js` (números menores = mais furadas).

## Final
No caixa os achados são passados um a um e embalados em sacolas da loja, com a nota fiscal pequena,
o carimbo PAGO e quem mais ajudou. Logo abaixo aparece o cartão do site com QR Code e "link na bio"
(no navegador ele é clicável e abre o site). O link leva tags utm (`utm_source=tiktok&utm_medium=live`) para você ver
no Google Analytics quantas visitas vieram da live. Perfil, link e QR: `profile`, `siteLink` e `qrImage` em `js/config.js`.

## Presentes (o último presente cancela a ação anterior)
| Tecla | Presente | Efeito |
|---|---|---|
| 1 | Rosa | empurra o carrinho 4 m |
| 2 | TikTok | empurra 12 m |
| 3 | Turbo | carrinho a jato por 6 s |
| 4 | Ímã | puxa os achados próximos para o carrinho por 8 s |
| 5 | Esqueci | volta 15 m ("esqueci a lista") |
| 6 | Chão molhado | derrapa, gira e perde 2 achados |
| 7 | Liquidação | caem 6 achados extras no corredor |
| 8 | Cartão recusado | GAME OVER: tudo volta pra prateleira |
| 9 | **Novo seguidor** (de graça) | o carrinho volta 8 m e os 2 últimos achados caem de volta no corredor, à frente, para serem pegos de novo |

**Seguidor:** cada pessoa que segue o canal durante a live dispara o efeito uma vez (seguir de novo não repete).
Não cancela a ação em andamento: o turbo pausa e continua depois. Vários seguidores juntos entram em fila, um a cada 1,3 s.
Precisa que o TikFinity envie os eventos de seguidor pelo WebSocket. Quantidade de metros/achados: `seguir` em `js/config.js`.

Os nomes dos presentes reais do TikTok são ligados às ações em `js/config.js` → `giftAliases`.
Presentes que chegam sem ação aparecem no painel (tecla H) em "Presentes sem ação".

## Controles
- `← →` ou segurar o lado esquerdo/direito da tela: conduz (modo manual). `C` alterna manual/automático.
- `D` demo automático · `R` nova rodada · `W` vai direto pro caixa · `M` som · `H` painel · `F` tela cheia.

## Na live (TikTok LIVE Studio + TikFinity)
1. Abra o link acima no Chrome, numa janela própria e alta.
2. No painel, cole o endereço WebSocket do TikFinity em **Conexão da live** e clique em **Conectar**.
3. Aperte **H** e capture a janela no LIVE Studio (cena vertical, fonte "Captura de janela").

## Locutor da loja
Os avisos do alto-falante ("Atenção, senhores clientes...") são áudios em `sounds/anuncios/` (lista em `js/anuncios.js`).
Dá para trocar por gravações suas mantendo os mesmos nomes. O botão "Locutor" no painel liga/desliga.

## Para transmitir só o jogo (sem painel e sem faixas pretas)
1. Abra o link do jogo no Chrome (esta janela vira o **controle remoto**).
2. No painel, clique em **📺 Abrir janela da live (só o jogo)**. Abre uma janela separada, vertical, só com o jogo.
3. Clique uma vez nessa janela nova (libera o som).
4. No LIVE Studio, capture **essa janela nova** (Captura de janela).
5. Controle tudo pela janela antiga: botões, teclas 1–9, setas, D, R… vão para a janela da live.
   A janela antiga fica sem som e desconectada; quem recebe os presentes do TikFinity é a janela da live.
