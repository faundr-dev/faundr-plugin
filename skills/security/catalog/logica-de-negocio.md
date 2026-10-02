# Lógica de negócio
Quando ler: o app cobra (Stripe, Mercado Pago, Paddle, Lemon Squeezy, Pix), tem planos/limites/créditos/cupons/indicação, carrinho, estoque, reservas, votos, saldo, ou fluxos em etapas (onboarding, aprovação, pedido → pago → enviado).

Como trabalhar: comece pelas invariantes, não pelas telas. Escreva para você mesmo 3 a 5 frases que precisam ser sempre verdade (ex.: "saldo nunca fica negativo", "cupom só é usado uma vez por conta", "plano pro só existe se houve pagamento confirmado pelo provedor", "total cobrado = soma dos preços do catálogo"). Depois procure o código que grava cada um desses valores e veja se a invariante é garantida no servidor, na hora da escrita.

## preco-vindo-do-cliente — Preço, total ou quantidade definidos pelo front
- Gravidade típica: crítica (compra por R$ 0,01, quantidade negativa gera crédito).
- Onde procurar: criação de checkout/pedido. Grep: `price_data`, `unit_amount: body`, `amount: req.body`, `total:` vindo do corpo, `quantity: body.quantity`, `stripe.paymentIntents.create({ amount: `, `preference.create` (Mercado Pago) com `unit_price` do cliente, `discount` do corpo.
- Como confirmar lendo o código: veja de onde vem cada número usado na cobrança. Deve vir do catálogo no servidor (banco ou `price_...` do Stripe), com a quantidade validada (inteiro, ≥1, ≤máximo).
- Descarta se: o servidor recebe só IDs de produto e quantidades, busca preços no banco/Stripe e calcula o total; ou usa `line_items: [{ price: 'price_...', quantity }]` com `price` de uma allowlist do servidor e `quantity` validada.
- Não descarta: o front calcula e o servidor "confere se é positivo"; `price` do Stripe aceito do cliente sem allowlist (o atacante passa o `price_` de outro produto mais barato do mesmo catálogo); desconto calculado no front.
- Como corrigir:
  ```ts
  const Item = z.object({ productId: z.string(), quantity: z.number().int().min(1).max(20) });
  const items = z.array(Item).max(50).parse(body.items);
  const products = await db.product.findMany({ where: { id: { in: items.map(i => i.productId) }, active: true } });
  const line_items = items.map(i => ({ price: products.find(p => p.id === i.productId)!.stripePriceId, quantity: i.quantity }));
  ```
- CWE: CWE-602

## pagamento-confirmado-pelo-front — Plano/pedido liberado pela página de sucesso
- Gravidade típica: crítica (acesso pago sem pagar).
- Onde procurar: página `success`/`obrigado`/`checkout/return` que chama uma API para "ativar plano"; rota `/api/upgrade` ou action `activatePlan` sem pagamento verificado; `?session_id=` usado sem consultar o Stripe; `localStorage.setItem('plan', 'pro')`; checagem de plano feita no cliente.
- Como confirmar lendo o código: descubra o que muda o plano/status para pago. Deve ser (a) o webhook verificado (ver `api-e-abuso.md` → `webhook-sem-assinatura`) ou (b) uma consulta do servidor ao provedor (`stripe.checkout.sessions.retrieve(id)` com `payment_status === 'paid'` e conferência de que a sessão pertence ao usuário e ainda não foi usada).
- Descarta se: só o webhook verificado ou a consulta ao provedor, com checagem de dono e uso único, alteram o estado.
- Não descarta: a página de sucesso só é alcançável pelo redirect do Stripe (qualquer um digita a URL); `session_id` consultado mas sem conferir o `client_reference_id`/`customer` do usuário atual (reuso da sessão de outra pessoa ou a mesma sessão para várias contas).
- Como corrigir: liberar no webhook; na página de sucesso, apenas mostrar o estado lido do banco.
- CWE: CWE-602

## limite-de-plano-so-no-front — Limites de plano/cota checados só na interface
- Gravidade típica: alta (usuário grátis usa recursos pagos, custo sem receita); média se o recurso é barato.
- Onde procurar: `if (plan === 'free')` em componentes; botões desabilitados; `maxProjects` checado no front; rotas/actions que criam recursos sem ler o plano. Grep: `plan`, `tier`, `isPro`, `subscription`, `limit`, `quota`, `credits`.
- Como confirmar lendo o código: para cada recurso limitado, ache a rota/action/política que cria o recurso e veja se ela lê o plano do banco e conta o uso atual antes de criar.
- Descarta se: a checagem existe no servidor (ou numa política/trigger do banco) no mesmo caminho da criação, e o plano vem do banco/claim do servidor.
- Não descarta: checagem de plano no middleware com dado do cookie; plano lido de `user_metadata` do Supabase (editável pelo usuário); escrita direta do cliente no Supabase em tabela sem política/trigger de limite.
- Como corrigir: função de servidor `assertWithinLimit(user, 'projects')` antes da criação; no Supabase, política de INSERT com `(select count(*) from projects where owner = auth.uid()) < limite` ou trigger.
- CWE: CWE-602

## corrida-uso-unico — Cupom, convite, saque ou crédito usado duas vezes em paralelo
- Gravidade típica: alta (dinheiro/crédito duplicado); média quando o ganho é pequeno.
- Onde procurar: padrão "lê, confere, escreve" em código com efeito de valor: `if (!coupon.used) { ... await markUsed() }`, `if (balance >= amount) { await update({ balance: balance - amount }) }`, `if (user.trialUsed === false)`, resgate de convite, voto único, reserva do último item.
- Como confirmar lendo o código: veja se a checagem e a escrita são atômicas: (a) um único `UPDATE ... WHERE used = false` / `WHERE balance >= amount` conferindo linhas afetadas; (b) restrição única no banco (`unique(user_id, coupon_id)`); (c) transação com `SELECT ... FOR UPDATE` ou isolamento serializável; (d) função SQL que faz tudo numa instrução.
- Descarta se: um dos quatro controles acima está presente no caminho.
- Não descarta: transação sem lock no nível padrão (READ COMMITTED permite as duas leituras verem "não usado"); checagem no front; `await` em sequência "rápido demais para dar corrida".
- Como corrigir:
  ```ts
  const { count } = await db.coupon.updateMany({ where: { code, usedAt: null }, data: { usedAt: new Date(), usedBy: user.id } });
  if (count === 0) throw new Error('cupom já usado');
  ```
  ```sql
  update wallets set balance = balance - $1 where user_id = $2 and balance >= $1 returning balance;
  ```
- CWE: CWE-362

## estado-pulado — Transição de estado sem checar o estado atual
- Gravidade típica: média a alta (pedido enviado sem pagar, reembolso de pedido já reembolsado, aprovação da própria solicitação).
- Onde procurar: campos `status`/`state`/`step` e rotas que os alteram (`/api/orders/[id]/ship`, `refund`, `approve`, `complete-onboarding`); updates com `status: body.status`.
- Como confirmar lendo o código: cada transição deve conferir o estado de origem no servidor (`where: { id, status: 'paid' }`) e quem pode fazê-la. O cliente não deve escolher o novo status livremente.
- Descarta se: transições explícitas por ação (uma rota por transição) com `where` no estado de origem e checagem de papel; ou máquina de estados no servidor.
- Não descarta: a tela só mostra o botão no estado certo; `status` aceito do corpo com validação só de enum.
- Como corrigir: `updateMany({ where: { id, status: 'paid' }, data: { status: 'shipped' } })` e conferir `count`.
- CWE: CWE-841

## valor-negativo-e-limites-numericos — Quantidade/valor negativo, zero, fracionário ou enorme
- Gravidade típica: alta quando gera crédito (transferir `-100` = receber 100) ou estoque negativo.
- Onde procurar: `amount`, `quantity`, `credits`, `points`, `tip`, `transfer`, `withdraw`; schemas com `z.number()` sem `.int().positive()`; `parseFloat` em dinheiro; aritmética com ponto flutuante em centavos.
- Como confirmar lendo o código: veja validação de sinal, inteiro, máximo e unidade (centavos inteiros).
- Descarta se: `z.number().int().positive().max(...)` (ou equivalente) antes do uso e valores monetários em centavos inteiros; `check (balance >= 0)` no banco.
- Não descarta: `min="1"` no input HTML.
- Como corrigir: validar no servidor e adicionar `check` no banco como rede de segurança.
- CWE: CWE-20

## indicacao-e-trial-abusaveis — Bônus de indicação, trial e brindes repetíveis
- Gravidade típica: média (custo); alta se o bônus vira dinheiro sacável.
- Onde procurar: `referral`, `invite`, `trial`, `bonus`, `welcome credits`; cadastro que concede créditos; auto-indicação (`referrerId === user.id`).
- Como confirmar lendo o código: veja se o bônus exige condição verificável (e-mail confirmado, primeiro pagamento), se há unicidade (um bônus por conta/cartão), e se o próprio usuário pode se indicar.
- Descarta se: bônus só após evento pago/confirmado, com restrição única e bloqueio de auto-indicação.
- Não descarta: "ninguém vai criar 100 contas" (cadastro sem limite e e-mails descartáveis tornam isso trivial).
- Como corrigir: conceder no webhook de pagamento; `unique(referred_user_id)`; bloquear `referrerId === user.id`.
- CWE: CWE-840

## assinatura-cancelada-mantem-acesso — Acesso pago continua após cancelamento/reembolso/falha
- Gravidade típica: média.
- Onde procurar: handlers de webhook do provedor de pagamento: veja se tratam `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`, `charge.refunded` (Stripe) ou equivalentes.
- Como confirmar lendo o código: liste os eventos tratados. Se só `checkout.session.completed` altera o plano, nada rebaixa.
- Descarta se: eventos de cancelamento/falha/reembolso rebaixam o plano; ou o acesso é checado consultando o status atual da assinatura no provedor/banco sincronizado.
- Não descarta: "o cliente raramente cancela".
- Como corrigir: tratar os eventos de fim de assinatura e gravar `current_period_end`; checar acesso por `status in ('active','trialing') and current_period_end > now()`.
- CWE: CWE-840
