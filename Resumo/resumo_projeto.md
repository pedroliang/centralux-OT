# Resumo de Alterações - Centralux OT

Este arquivo resume o trabalho realizado para sincronizar o repositório, corrigir erros e implementar melhorias.

## 1. Sincronização do Repositório
- **Ação**: O repositório [pedroliang/centralux-OT](https://github.com/pedroliang/centralux-OT) foi sincronizado e atualizado.
- **Estado**: Repositório local em conformidade com a branch `main`.

## 2. Correção de Bug: `todayBorder is not defined`
- **Problema**: O sistema apresentava o erro `ReferenceError: todayBorder is not defined` ao carregar pedidos.
- **Solução**: Adicionada a inicialização `let todayBorder = "";` na função `createCardElement`.

## 3. Ordenação dos Pedidos (Recente -> Antigo)
- **Ação**: O sistema agora exibe os pedidos do mais recente para o mais antigo (DESC).
- **Causa**: Solicitação do usuário para facilitar a visualização de novos pedidos no topo.
- **Solução**: Alterado o parâmetro de busca no Supabase para `.order('created_at', { ascending: false })`.

## 4. Correção de Erro de Sintaxe (Duplicate `todayBorder`)
- **Problema**: O painel ficou em branco devido a uma declaração duplicada após o merge.
- **Solução**: Removida a declaração `let` duplicada, restaurando o funcionamento do site.

## Atualização no GitHub (27/03/2026)
- **Ações realizadas**:
  - `git commit -m "Ordenação dos pedidos: do mais recente para o mais antigo"`
  - `git commit -m "fix: resolve SyntaxError (duplicate todayBorder) causing empty board"`
  - `git push origin main`
- **Link**: [Site Online](https://pedroliang.github.io/centralux-OT/)

---

## Atualização (14/05/2026) - Correções de Migração e Fotos
- **Ações realizadas**:
  - **Indicador de Sincronização**: Corrigido o indicador preso em "Iniciando...". Agora ele mostra o status real da conexão de internet (Online/Offline) do navegador.
  - **Salvamento de Pedidos com Foto**:
    - Adicionado tratamento de erro global (`try/catch`) no envio de formulário para evitar que o botão fique travado em "Salvando...".
    - Ajustada a compressão de imagem para qualidade `0.92` e largura máxima de `1600px` para evitar ultrapassar o limite de 1MB do Firestore.
  - **Correção de Variável**: Declarada a variável `_localDbReady = false` para evitar erro de referência e garantir o uso do Firebase.
  - **Visualização de Fotos no Relatório**: Atualizada a função de busca de fotos no relatório para usar o Firebase Firestore em vez do Supabase.

---
*Resumo atualizado em 14/05/2026*
