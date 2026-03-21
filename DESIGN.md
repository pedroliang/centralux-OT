# Estratégia do Sistema de Design: O Registro Luminoso

## 1. Visão Geral e Estrela Guia Criativa: "Luminescência de Precisão"
Este sistema de design se afasta do visual estéril e engessado dos softwares de logística tradicionais. Nossa Estrela Guia Criativa é a **Luminescência de Precisão**. Ela trata a logística global não como uma teia caótica de dados, mas como uma experiência editorial de alto nível onde as informações fluem como luz.

Aproveitando uma paleta primária noturna profunda contrastada com pontos de "Luz" em destaque, criamos um ambiente de absoluta autoridade e clareza. Quebramos o padrão de "template" favorecendo **profundidade tonal no lugar de linhas** e **densidade de informação assimétrica**. A interface deve se assemelhar a um painel físico de primeira linha — esculpido, em camadas e intencionalmente iluminado.

---

## 2. Cores: A Profundidade da Logística
A paleta tem como base a cor `primary` (#041627) para fornecer uma fundação de "meia-noite", enquanto a `tertiary` (#705d00) atua como o elemento de "Luz" — guiando o olhar para pontos críticos de dados.

### A Regra de "Nenhuma Linha"
Bordas padrão de 1px são estritamente proibidas para o seccionamento. Definimos a estrutura através de **Transições de Fundo**.
*   **Transições de Superfície:** Use `surface_container_low` para a tela principal e `surface_container_lowest` para os cartões de rastreamento individuais. Isso cria uma distinção natural e suave que soa sofisticada em vez de "quadriculada".
*   **Definição Tonal:** Se uma barra lateral precisa ser separada do quadro Kanban principal, use uma mudança de `surface` para `surface_dim` em vez de uma linha.

### Hierarquia e Aninhamento de Superfícies
Trate a interface do usuário (UI) como uma série de camadas físicas.
*   **Base:** `surface` (#fbf9fa)
*   **Seções de Layout:** `surface_container_low` (#f5f3f4)
*   **Cartões Interativos:** `surface_container_lowest` (#ffffff)
*   **Estados Ativos/Elevados:** `surface_bright` (#fbf9fa) com um sutil `surface_tint`.

### A Regra do "Vidro e Gradiente"
Para elevar o estilo "Corporativo" para algo "Premium", use o **Glassmorphism** (efeito de vidro) para painéis flutuantes (ex.: pesquisa global ou filtros). Aplique `surface_container_lowest` com 80% de opacidade e desfoque no fundo (backdrop-blur) de `20px`. 
*   **Textura de Assinatura:** Botões primários não devem ser planos. Use um gradiente linear do `primary` (#041627) até `primary_container` (#1a2b3c) num ângulo de 135 graus para dar aos botões uma sensação "encorpada".

---

## 3. Tipografia: Autoridade Editorial
Combinamos **Manrope** (Display/Título) com **Inter** (Corpo/Etiqueta) para balancear personalidade com alta legibilidade.

*   **Display e Títulos (Manrope):** Usado para IDs de remessa e métricas de alto nível. A abertura larga da Manrope transmite transparência moderna.
*   **Corpo e Etiquetas (Inter):** Usado para dados logísticos granulares. A altura-x da Inter garante que o texto "on_surface_variant" permaneça legível mesmo com tamanho `label-sm` (0.6875rem).
*   **Nota de Hierarquia:** Use `display-md` para contagens "Em Trânsito" e `title-sm` para cabeçalhos de cartão. O grande salto de escala entre esses elementos cria uma sensação "Editorial" que destaca primeiro os números mais importantes.

---

## 4. Elevação e Profundidade: Camadas Tonais
As tradicionais sombras projetadas ("drop shadows") costumam ser poluídas. Usamos a **Iluminação Ambiente**.

*   **O Princípio das Camadas:** Evite sombras em cartões Kanban padrão. Use o cartão `surface_container_lowest` em um fundo `surface_container`. A ligeira mudança no valor hexadecimal provê toda a "elevação" necessária.
*   **Sombras Ambientes:** Para cartões "Ativos" sendo arrastados no quadro Kanban, use uma sombra mais difusa: `box-shadow: 0 12px 40px rgba(4, 22, 39, 0.06);`. A sombra vai adquirir uma tonalidade da cor `primary`, não de preto, para manter a consistência visual do projeto.
*   **A Borda Fantasma:** Para campos de entrada de dados ou etiquetas de status em que um limite é crítico para acessibilidade, use o token `outline_variant` com **20% de opacidade**. Isso deve ser apenas sentido, não necessariamente visto.

---

## 5. Componentes

### Cartões e Colunas do Kanban
*   **Sem Divisórias:** Nunca use uma linha entre itens de lista. Use o espaçamento `spacing.4` (0.9rem) de espaço em branco vertical ou uma leve oscilação do fundo entre `surface_container_low` e `surface_container_lowest`.
*   **Raio da Borda:** Os cartões devem usar cantos arredondados (`roundedness.lg` - 1rem). As colunas usam `roundedness.xl` (1.5rem) para criar uma sensação de "recipiente".

### Etiquetas de Status (O Destaque "Luz")
*   **Ativo/Alerta:** Use a cor `tertiary_container` com texto `on_tertiary_container`.
*   **Padrão/Neutro:** Use a cor `secondary_container` com `on_secondary_container`.
*   **Formato:** Use `roundedness.full` para um formato de "pílula" ("pill") que contrasta com a forma retangular dos cartões.

### Botões
*   **Primário:** Gradiente do `primary` para `primary_container`, bordas arredondadas `roundedness.md`, texto branco.
*   **Secundário:** Fundo em `surface_container_highest` com texto `on_surface`. Sem bordas.
*   **Terciário (O Botão "Luz"):** Fundo em `tertiary_fixed`. Este item é reservado para "Criar Novo Pedido" ou "Intervenção Urgente".

### Campos de Texto
*   **Estilo:** Fundo `surface_container_low` com uma `borda fantasma` quando estiver em foco.
*   **Tipografia:** Rótulos devem ser `label-md` usando `on_surface_variant`.

### Linha do Tempo de Rastreamento (Componente Customizado)
*   Em vez de uma linha fina, use uma trilha vertical mais espessa na cor `surface_container_highest`.
*   Passos concluídos usam um ponto `primary`; o passo atual e ativo usa um efeito pulsante em `tertiary` (Dourado) para destacar o tema de "Luz".

---

## 6. O que fazer e O que Não Fazer

### Faça:
*   **Faça** o uso de espaçamentos `spacing.10` e `spacing.12` para criar respiro nos dados do layout.
*   **Faça** o uso de texto tipo `on_surface_variant` para metadados (marcação final de tempos, peso, dimensões) estabelecendo uma clara hierarquia visual em contraste com textos `on_surface` (títulos).
*   **Arrisque** e abrace a assimetria. O quadro de Kanban não precisa estar posicionado perfeitamente no centro; permita que barras laterais ou painéis utilitários preencham espaços desbalanceados propositalmente.

### Não Faça:
*   **Não utilize** a cor `#000000` em sombras. Sempre adicione tons da cor primária `primary` (azul).
*   **Não utilize** bordas a fim de separar o cabeçalho/navegação de seu conteúdo direto. Use uma transição na cor do fundo.
*   **Não utilize** tons avermelhados muito "saturados" em cenários de problemas, como um alerta de Erro, ao menos em extrema prioridade e urgência do sistema. Em seu lugar, adote a cor contida como `error_container` em prol de um sistema polido e visualmente estético.
