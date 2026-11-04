# MOTOBOY MALUCO — jogo de entregas para TikTok LIVE

O motoboy do **Achados Úteis Por Aí** roda pela avenida, vira nas ruas, para na casa do cliente
e entrega um **achado do site** (foto, nome e preço reais). São 4 entregas por rodada.

**Jogar:** https://mencalha1986.github.io/motoboy-maluco/

## Presentes (o último presente cancela a ação anterior)
| Tecla | Presente do TikTok | Efeito |
|---|---|---|
| 1 | Rose | acelera 8 m |
| 2 | TikTok | acelera 22 m |
| 3 | Finger Heart | turbo por 6 s |
| 4 | Doughnut | **um caramelo corre atrás da moto latindo** (aparece no retrovisor) e o motoboy levanta as pernas |
| 5 | GG | endereço errado: volta 25 m |
| 6 | Ice Cream Cone | pneu furado (fica murcho, com o prego): a moto para, o motoboy liga e **o borracheiro chega a pé, troca o pneu** e libera |
| 7 | Galaxy | sem gasolina: GAME OVER |
| 8 | Heart Me | **buzina** (não cancela nada): carros abrem caminho, pedestres correm e o caramelo foge |
| 9 | Seguir (grátis) | o seguidor vira o cliente da próxima entrega e a moto volta 10 m |

Presente que chega durante a entrega acontece quando o motoboy sai da casa.
Nomes dos presentes reais: `giftAliases` em `js/config.js`.

## Caminhos diferentes a cada rodada
Cada rodada sorteia um caminho novo: vira à direita ou à esquerda, avenida de **lojas**, **centro** (prédios altos)
ou **orla** (calçadão, areia, mar e coqueiros); rua de **casas**, de **prédios** (condomínio com portaria) ou **vila**
(casinhas coloridas com caixa d'água). A casa do cliente pode ficar de qualquer lado da rua.

## Esquinas
A avenida segue reto e o motoboy **liga a seta, encosta, freia e vira** na rua (a câmera vira junto).
Na volta, a rua termina num "T" com a avenida e ele vira à esquerda. Os carros da avenida seguem reto.
Cada esquina tem **semáforo** ou **guarda de trânsito** (apito, mão levantada = pare). No vermelho o motoboy
para na faixa e espera atrás dos carros; pedestres atravessam e, no "T", passam carros na avenida.
Com turbo ou fugindo do cachorro ele pode **furar o sinal** (−½ estrela e bronca do guarda).

## Avaliação
Cada entrega começa com 5 estrelas. Bater (−1), buraco/cone (−½), pneu furado e endereço errado (−½)
tiram estrelas. No final aparecem as entregas, a avaliação média, o QR/link do site e quem mais ajudou.

## Obstáculos
Buraco, cone, lombada (voa se estiver rápido), poça, carro estacionado, trânsito de carros e ônibus na avenida, carro na contramão na rua,
caçamba, pedestre no celular atravessando e cachorro atravessando (freada de susto).

## Controles
Começa no automático (desvia da maioria, às vezes erra). `← →` assume; 5 s sem mexer volta ao automático.
`D` demo · `R` nova rodada · `W` pula para perto da próxima entrega · `M` som · `H` painel.

## Na live
1. Abra o link no Chrome, cole o endereço do TikFinity em **Conexão da live** e clique em **Conectar**.
2. Clique em **📺 Abrir janela da live (só o jogo)** e clique uma vez na janela nova (libera o som).
3. No LIVE Studio, capture a janela nova. Controle tudo pela janela antiga.

## Vozes
Motoboy, clientes e GPS em `sounds/voz/` (lista em `js/falas.js`). Dá para trocar por gravações suas
mantendo os mesmos nomes de arquivo.
