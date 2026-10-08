---
description: LGPD para quem não programa. Mostra que dados pessoais o app coleta, para quais empresas eles vão e o que falta (política de privacidade, termos de uso, aviso de cookies, exclusão de conta), e escreve os rascunhos com o OK do dono. Use quando o usuário falar de LGPD, privacidade, termos, cookies, dados pessoais, ou antes de lançar.
argument-hint: [política | termos | cookies | exclusão]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *) Bash(faundr *)
---

Pedido do usuário: $ARGUMENTS

1. Rode com a ferramenta Bash: `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" lgpd`. A saída lista os dados pessoais coletados (e onde), as empresas que recebem dados e o estado de cada item. Confira no código o que parecer estranho (ex.: uma coluna "cpf" que na verdade é de empresa) e diga ao usuário.
2. **Explique em português simples**, sem juridiquês, em poucas linhas:
   - que dados o app coleta e por quê (pergunte o porquê se não for óbvio: "para que o app pede a data de nascimento?"); dado que não é usado não deveria ser pedido;
   - para quais empresas os dados vão, quais ficam fora do Brasil e quais são rastreadores;
   - o que falta, do mais grave ao mais simples. Diga que isto não substitui um advogado, mas é o mínimo antes de abrir o app ao público.
3. **Ofereça escrever o que falta**, um de cada vez, e só escreva com o OK do usuário. Antes, pergunte numa rodada só (ferramenta de perguntas ao usuário) o que o código não diz: nome da empresa ou responsável, CNPJ ou CPF, e-mail para pedidos de privacidade (o encarregado/DPO pode ser o próprio dono num app pequeno), cidade para o foro e por quanto tempo os dados ficam guardados depois que a conta é excluída.
   - **Política de privacidade**: página no app (siga as rotas e o DESIGN.md do projeto), com: quem é o responsável e o contato; que dados coleta e para quê (a lista do passo 1, com a base legal de cada uso: execução do contrato, consentimento, obrigação legal ou legítimo interesse); com quem compartilha (as empresas do passo 1, dizendo as que ficam fora do Brasil); por quanto tempo guarda; os direitos da pessoa (confirmar, acessar, corrigir, apagar, levar os dados, revogar o consentimento) e como pedir; cookies; segurança; data da última atualização. Dados sensíveis ou de crianças, se houver, com consentimento específico.
   - **Termos de uso**: página com o que o app oferece, regras de uso, conta e senha, pagamentos e cancelamento (se houver), limites de responsabilidade, mudanças nos termos e foro.
   - **Aviso de cookies**: só se há rastreador com cookies. Um aviso com "Aceitar" e "Recusar" (recusar tão fácil quanto aceitar) que só carrega os rastreadores depois do aceite, e guarda a escolha. Prefira uma biblioteca pequena e mantida (ex.: vanilla-cookieconsent) e peça o OK antes de instalar.
   - **Excluir a conta**: botão em Conta/Configurações que pede confirmação e apaga os dados da pessoa (ou anonimiza o que a lei manda guardar, como notas fiscais), inclusive no serviço de login.
   - Ligue as páginas no rodapé ou no cadastro ("Ao criar a conta você aceita os Termos e a Política de Privacidade").
4. Depois de escrever, rode de novo `node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" lgpd` para conferir e conte o que mudou. O resultado aparece no painel em **Lançamento → LGPD**.
