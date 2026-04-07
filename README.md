# 🍲 ALMOÇAR

**A**mbiente **L**údico de **M**onitoramento de **O**perações e **C**ódigo
**A**lgorítmico **R**esponsivo.

ALMOÇAR é um software web que ajuda alunos a entender, passo a passo, como
algoritmos em C são executados. Ele recebe o código, mostra a memória, as
variáveis e as estruturas de dados em painéis lúdicos e permite ao aluno
avançar/retroceder cada instrução como em um teste de mesa interativo.

A metáfora visual é a de uma cozinha:

| Estado            | Visual                                |
|-------------------|---------------------------------------|
| Executando        | 🍲 panela com colher mexendo           |
| Sucesso           | 😋 "Pode vir a conta!"                 |
| Erro de execução  | 🔥 "Comida queimou"                    |
| Edição            | 👨‍🍳 chef parado                         |

---

## ✨ O que está pronto

- **Interpretador de C** (subset didático) escrito do zero em TypeScript:
  - Tipos: `int`, `float`, `char`, `void`, ponteiros, arrays multidimensionais.
  - Estruturas de controle: `if/else`, `for`, `while`, `do/while`,
    `break`, `continue`, `return`.
  - Operadores: aritméticos, relacionais, lógicos, bit-a-bit, atribuição
    composta (`+=`, `-=`, ...), pré e pós incremento/decremento, ternário,
    `&` (endereço), `*` (deref), indexação `a[i][j]`.
  - Funções definidas pelo usuário, chamadas e parâmetros.
  - Built-ins: `printf` (`%d %i %u %f %c %s %x`), `putchar`, `puts`.
- **UI React + Tailwind** com tema sóbrio (escuro, com acentos paprika /
  manjericão / manteiga) e fontes Inter / JetBrains Mono / Fraunces.
- **Sete painéis** cuidadosamente coordenados:
  1. Cabeçalho com seletor de exemplo.
  2. Mascote com 4 estados animados.
  3. Editor / visualizador de código com linha ativa destacada.
  4. Visualização de estruturas de dados (vetores e matrizes desenhados
     célula a célula, com índices e cores indicando leitura/escrita).
  5. Painel de variáveis escalares com destaque na variável modificada.
  6. Painel de saída (`stdout`).
  7. Teste de mesa: lista clicável de todos os passos da execução.
- **Controles** completos: ⏮ reiniciar, ◀ anterior, ▶ executar, ⏸ pausar,
  ▶ próximo, slider de progresso e 4 velocidades (Lenta / Normal / Rápida / Turbo).
- **Três exemplos prontos**:
  - Matriz 3×5 — encontrar menor e maior valor (o caso original).
  - Soma de vetor.
  - Ponteiro básico.

---

## 🚀 Como rodar

Pré-requisitos: Node.js 18+ e npm.

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (Vite, http://localhost:5173)
npm run dev

# Build de produção (gera em ./dist)
npm run build

# Pré-visualizar o build de produção
npm run preview
```

No Claude Code com o plugin de preview, basta rodar:

```text
> Inicie o Vite Dev Server (ALMOÇAR)
```

A configuração já está em `.claude/launch.json`.

---

## 🧪 Exemplo guiado (matriz 3×5)

O exemplo padrão é exatamente a questão que originou o ALMOÇAR:

```c
int matriz[3][5] = {
    {10, 25,  7, 88, 42},
    { 3, 91, 56, 14, 67},
    {29,  5, 73, 38, 82}
};

int menor = matriz[0][0];
int maior = matriz[0][0];

for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 5; j++) {
        if (matriz[i][j] < menor) menor = matriz[i][j];
        if (matriz[i][j] > maior) maior = matriz[i][j];
    }
}
```

Ao clicar em **🍳 Cozinhar**, o ALMOÇAR gera **87 passos** que o aluno pode
percorrer um a um, observando:

- A linha que está sendo executada destacada no código.
- A matriz desenhada com índices `0..2` × `0..4` e os valores reais nas células.
- As variáveis `i`, `j`, `menor`, `maior` mudando em tempo real.
- A célula da matriz acessada na iteração atual, em destaque colorido
  (laranja paprika para escritas, verde manjericão para leituras).
- Cada decisão de `if` registrada no painel "Teste de Mesa", com a opção
  de clicar e voltar a qualquer momento da execução.

---

## 🗂️ Estrutura do projeto

```
almocar/
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── .claude/
│   └── launch.json              # Configuração do dev server para Claude Preview
└── src/
    ├── main.tsx
    ├── App.tsx                  # Layout e estado global da UI
    ├── index.css
    ├── interpreter/             # Núcleo: lexer + parser + interpretador
    │   ├── ast.ts
    │   ├── index.ts
    │   ├── interpreter.ts       # Tree-walking + gravação de Steps
    │   ├── lexer.ts
    │   ├── memory.ts            # Modelo de memória plano
    │   ├── parser.ts            # Parser recursivo descendente
    │   └── types.ts
    ├── components/
    │   ├── ArrayView.tsx        # Vetores e matrizes desenhados
    │   ├── CodeView.tsx         # Editor / visualizador
    │   ├── Controls.tsx         # ▶ ⏸ ⏮ ◀ ▶ + slider + velocidade
    │   ├── Mascot.tsx           # 4 estados animados
    │   ├── OutputPanel.tsx      # stdout
    │   ├── TraceLog.tsx         # Lista clicável de passos
    │   └── VariablesPanel.tsx   # Escalares com destaque
    └── examples/
        └── matriz.ts            # Exemplos pré-carregados
```

---

## 🧠 Como o interpretador funciona

1. **Lexer** (`lexer.ts`) tokeniza o fonte em palavras-chave, identificadores,
   números, strings, pontuação e operadores. Comentários e diretivas
   `#include` / `#define` são descartados.
2. **Parser** (`parser.ts`) é recursivo descendente e produz uma AST tipada
   (definida em `ast.ts`). Toda a precedência usual de C é respeitada.
3. **Memória** (`memory.ts`) é um vetor plano de células lógicas. Cada
   variável escalar ocupa 1 célula; arrays ocupam `n` células contíguas.
   Ponteiros guardam endereços (índices nesse vetor).
4. **Interpretador** (`interpreter.ts`) percorre a AST executando-a, e
   **a cada operação relevante** chama `recordStep(...)` que captura:
   - linha atual no fonte;
   - descrição em português do que aconteceu;
   - snapshot completo do escopo (variáveis e arrays);
   - `stdout` acumulada;
   - "foco" (qual variável/célula está sendo lida ou escrita).
5. A UI consome essa lista de `Step[]` e simplesmente renderiza o passo
   selecionado pelo aluno — toda a animação fica no React/Tailwind, sem
   precisar re-executar nada.

Limite de segurança: a execução para automaticamente após **5000 passos**
para evitar travar a interface em caso de laço infinito.

---

## 🛣️ Próximos passos sugeridos

- Suporte a `struct`, `typedef`, `malloc`/`free`.
- Outras linguagens: Python (subset), Pascal e pseudocódigo VisuAlg/Portugol.
  A arquitetura já está preparada — basta um novo parser que produza a
  mesma AST (ou uma representação intermediária equivalente).
- Modo professor com biblioteca de exercícios e checagem automática.
- Compartilhar uma execução por URL (serializar a AST + `Step[]`).
- `scanf` interativo (usar um input dialog antes de cada leitura).

---

## 📜 Licença

Projeto educacional. Sinta-se livre para usar em sala de aula.
