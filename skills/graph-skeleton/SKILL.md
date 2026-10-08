---
description: Mostra o esqueleto de um arquivo: cada função, classe e constante com a assinatura e as linhas, sem o corpo, e o que ele importa.
argument-hint: <arquivo>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/bin/faundr.mjs" graph-skeleton $ARGUMENTS`

Resuma para o usuário o que esse arquivo faz a partir das assinaturas acima (as mais usadas são as mais importantes). Para ver o corpo de uma parte, leia só as linhas indicadas.
