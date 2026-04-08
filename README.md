<p align="center">
  <img src="public/logo.svg" alt="almoçar" width="280" />
</p>

**A**mbiente **L**údico de **M**onitoramento de **O**perações e **C**ódigo
**A**lgorítmico **R**esponsivo.

ALMOÇAR é um software web que ajuda alunos a entender, passo a passo, como
algoritmos são executados. Ele recebe o código, mostra a memória,
as variáveis e as estruturas de dados em painéis coordenados e permite ao aluno
avançar/retroceder cada instrução como em um teste de mesa interativo.

---

## O que está pronto

### Linguagens suportadas

Arquitetura multi-linguagem com núcleo compartilhado (AST, memória,
interpretador) e front-ends independentes por linguagem:

#### C (subset didático)

- **Tipos:** `int`, `float`, `char`, `void`, ponteiros, arrays multidimensionais.
- **Controle de fluxo:** `if/else`, `for`, `while`, `do/while`, `switch/case`,
  `break`, `continue`, `return`.
- **Operadores:** aritméticos, relacionais, lógicos, bit-a-bit, atribuição
  composta (`+=`, `-=`, …), pré/pós incremento/decremento, ternário,
  `&` (endereço), `*` (deref), indexação `a[i][j]`.
- **Funções** definidas pelo usuário, chamadas e parâmetros.
- **Built-ins:** `printf` (`%d %i %u %f %c %s %x`), `scanf` (`%d %f %c %s`),
  `putchar`, `puts`.
- **Pré-processador:** `#define` (macros tipo-objeto com expansão recursiva).
- **Execução interativa:** `scanf` pausa a execução e solicita entrada no
  terminal integrado, valor por valor, como em um IDE real.

#### Portugol Studio

- **Tipos:** `inteiro`, `real`, `caractere`, `logico`, `cadeia`.
- **Controle de fluxo:** `se/senao`, `para`, `enquanto`, `faca...enquanto`,
  `escolha/caso/contrario`, `pare`, `continue`, `retorne`.
- **Operadores:** aritméticos, relacionais, `e`/`ou`/`nao` (lógicos em português),
  `verdadeiro`/`falso`, atribuição composta.
- **Built-ins:** `escreva()`, `escreval()` (com quebra de linha), `leia()`.
- **Estrutura:** `programa { funcao inicio() { ... } }` — ponto-e-vírgula opcional.

### Interface

- **Design editorial** com tipografia Fraunces (serif variável) + JetBrains Mono,
  temas claro e escuro, sem ligatures de código.
- **Layout em grid** com seis painéis coordenados:

| Nº | Painel | Descrição |
|----|--------|-----------|
| I | **Código** | Editor com syntax highlighting, números de linha, destaque da linha ativa e de erros |
| II | **Estruturas** | Vetores e matrizes desenhados célula a célula com índices e cores (leitura/escrita) |
| III | **Terminal** | Stdin/stdout unificados — exibe saídas do `printf` e coleta entradas do `scanf` inline |
| IV | **Variáveis** | Escalares com destaque na variável modificada, formato `nome ··· valor` |
| V | **Trace** | Teste de mesa: lista clicável de todos os passos da execução |

- **Barra de status** com indicador de estado (Pronto / Executando / Concluído / Erro),
  mensagem do passo atual e contador de progresso.
- **Destaque de erros:** erros de compilação mantêm o editor aberto, destacam a linha
  com erro (sublinhado ondulado + fundo vinho), e a barra de status fica em amarelo/vinho.

### Controles de execução

- Botões: reiniciar, anterior, próximo, play/pause, slider de progresso.
- 4 velocidades: Lenta (1.6s), Normal (800ms), Rápida (300ms), Turbo (80ms).

### Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Enter` | Executar / Parar |
| `Tab` / `Shift+Tab` | Indentar / des-indentar |
| `Alt+Shift+F` | Formatar código (re-indentar) |
| `Alt+↑/↓` | Mover linha(s) |
| `Shift+Alt+↑/↓` | Copiar/duplicar linha(s) |
| `Ctrl+Shift+K` | Remover linha(s) |
| `←` / `→` | Passo anterior / próximo (em execução) |

### Formatador de código

Formatador minimalista por linguagem que normaliza indentação por chaves,
preserva strings/comentários e trata `case/default` (C) ou `caso/contrario`
(Portugol) com recuo adequado.

### Exemplos pré-carregados

**C:**
- Matriz 3×5 — encontrar menor e maior valor.
- Soma de vetor — acumulador com laço `for`.
- Ponteiro básico — atribuição via ponteiro.

**Portugol:**
- Soma de vetor — acumulador com `para`.
- Matriz 3×5 — menor e maior com `para` aninhado.
- Leitura com se/senão — par ou ímpar com `leia()`.

---

## Como rodar

Pré-requisitos: Node.js 18+ e npm.

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (Vite)
npm run dev

# Build de produção (gera em ./dist)
npm run build

# Pré-visualizar o build de produção
npm run preview
```

---

## Estrutura do projeto

```
almocar/
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx                      # Layout e estado global da UI
    ├── index.css                    # Design tokens e estilos
    ├── interpreter/                 # Núcleo compartilhado
    │   ├── ast.ts                   # Definição da AST (comum a todas as linguagens)
    │   ├── index.ts                 # API pública (compileAndRun)
    │   ├── interpreter.ts           # Tree-walking + gravação de Steps
    │   ├── memory.ts                # Modelo de memória plano
    │   └── types.ts                 # Tipos (Step, VarSnapshot, CType)
    ├── languages/                   # Front-ends por linguagem
    │   ├── types.ts                 # Interface Language
    │   ├── index.ts                 # Registro de linguagens
    │   ├── c/                       # Linguagem C
    │   │   ├── lexer.ts             # Tokenizador com #define
    │   │   ├── parser.ts            # Parser recursivo descendente
    │   │   ├── formatter.ts         # Re-indentação por chaves
    │   │   ├── highlight.ts         # Syntax highlighting
    │   │   ├── examples.ts          # Exemplos pré-carregados
    │   │   └── index.ts
    │   └── portugol/                # Linguagem Portugol Studio
    │       ├── lexer.ts             # Tokenizador com e/ou/nao
    │       ├── parser.ts            # Parser: programa { funcao inicio() }
    │       ├── formatter.ts         # Re-indentação por chaves
    │       ├── highlight.ts         # Syntax highlighting
    │       ├── examples.ts          # Exemplos pré-carregados
    │       └── index.ts
    └── components/
        ├── ArrayView.tsx            # Vetores e matrizes desenhados
        ├── CodeView.tsx             # Editor / visualizador de código
        ├── Controls.tsx             # ▶ ⏸ ⏮ ◀ ▶ + slider + velocidade
        ├── Mascot.tsx               # Barra de status com 4 estados
        ├── TerminalPanel.tsx        # Terminal unificado (stdin + stdout)
        ├── TraceLog.tsx             # Lista clicável de passos
        └── VariablesPanel.tsx       # Escalares com destaque
```

---

## Como o interpretador funciona

1. **Lexer** (por linguagem) tokeniza o fonte em palavras-chave, identificadores,
   números, strings, pontuação e operadores. O lexer C suporta `#define` com
   expansão recursiva de macros; o Portugol converte `e`/`ou`/`nao` em operadores.
2. **Parser** (por linguagem) é recursivo descendente e produz uma **AST
   compartilhada** (definida em `ast.ts`). O parser Portugol renomeia
   `inicio` → `main` e mapeia tipos (`inteiro` → `int`, `real` → `float`, etc.).
3. **Memória** (`memory.ts`) é um vetor plano de células lógicas. Cada
   variável escalar ocupa 1 célula; arrays ocupam `n` células contíguas.
   Ponteiros guardam endereços (índices nesse vetor).
4. **Interpretador** (`interpreter.ts`) percorre a AST executando-a, e
   a cada operação relevante chama `recordStep(...)` que captura:
   - linha atual no fonte;
   - descrição em português do que aconteceu;
   - snapshot completo do escopo (variáveis e arrays);
   - stdout acumulada;
   - "foco" (qual variável/célula está sendo lida ou escrita).
   O interpretador reconhece built-ins de ambas as linguagens:
   `printf`/`scanf`/`putchar`/`puts` (C) e `escreva`/`escreval`/`leia` (Portugol).
5. **Entrada interativa:** quando o interpretador encontra `scanf` ou `leia`,
   lança um `InputNeededSignal`. A UI coleta o valor no terminal integrado e
   re-executa deterministicamente com todas as entradas acumuladas.
6. A UI consome a lista de `Step[]` e renderiza o passo selecionado —
   toda a navegação é instantânea, sem re-executar.

Limite de segurança: a execução para após **5000 passos** para evitar
travar a interface em caso de laço infinito.

### Adicionando novas linguagens

Para adicionar uma linguagem, crie um diretório em `src/languages/<nome>/`
implementando a interface `Language` (definida em `src/languages/types.ts`):

- `parse(source)` → AST compartilhada
- `format(source)` → código re-indentado
- `highlight` → configuração de syntax highlighting
- `examples` → exemplos pré-carregados

Registre a linguagem em `src/languages/index.ts` e ela aparecerá
automaticamente no seletor da interface.

---

## Próximos passos sugeridos

- Suporte a `struct`, `typedef`, `malloc`/`free` (C).
- Novas linguagens: Python (subset), Pascal.
- Modo professor com biblioteca de exercícios.
- Compartilhar execução por URL.

---

## Licença

MIT License

Copyright (c) 2026 Allan Jheyson (@allramos)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
