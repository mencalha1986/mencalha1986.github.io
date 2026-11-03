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
o carimbo PAGO e quem mais ajudou.

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
