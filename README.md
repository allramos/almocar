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

<p align="center">
  <a href="https://allramos.github.io/almocar/">Acesse o ALMOÇAR online</a>
</p>

## O que está pronto

### Linguagens suportadas

Arquitetura multi-linguagem com núcleo compartilhado e front-ends independentes
por linguagem.

#### C (subconjunto didático)

- **Tipos:** `int`, `float`, `char`, `void`, ponteiros, arrays multidimensionais.
- **Controle de fluxo:** `if/else`, `for`, `while`, `do/while`, `switch/case`,
  `break`, `continue`, `return`.
- **Operadores:** aritméticos, relacionais, lógicos, bit-a-bit, atribuição
  composta, pré/pós incremento/decremento, ternário, endereço, ponteiro e
  indexação.
- **Funções** com parâmetros e passagem de arrays por referência.
- **Entrada/saída:** `printf`, `scanf`, `putchar`, `puts`.
- **Pré-processador:** `#define` com expansão recursiva de macros.
- **Entrada interativa:** `scanf` pausa a execução e solicita entrada no
  terminal integrado, valor por valor.

#### Java (subconjunto didático)

- **Tipos:** `int`, `float`, `double`, `char`, `void`, `boolean`, `String`, arrays.
- **Controle de fluxo:** `if/else`, `for`, `while`, `do/while`, `break`, `continue`, `return`.
- **Operadores:** mesmos do C, incluindo cast.
- **Entrada/saída:** `System.out.println()`, `System.out.print()`,
  `scanner.nextInt()`, `scanner.nextFloat()`.
- **Estrutura:** aceita a classe padrão `public class Main { ... }`, pulando
  imports e declarações de Scanner.

#### JavaScript (subconjunto didático)

- **Declarações:** `let`, `const`, `var` com inferência automática de tipo.
- **Controle de fluxo:** `if/else`, `for`, `while`, `do/while`, `break`, `continue`, `return`.
- **Operadores:** aritméticos, relacionais, lógicos, bit-a-bit, atribuição composta,
  pré/pós incremento/decremento, ternário.
- **Funções** declaradas com `function`.
- **Entrada/saída:** `console.log()`, `prompt()`, `parseInt()`, `parseFloat()`,
  funções de `Math`.
- **Arrays:** literais e matrizes. **Strings:** aspas duplas, simples e template
  literals.
- **REPL:** console interativo com estado persistente entre execuções.

#### Portugol Studio

- **Tipos:** `inteiro`, `real`, `caractere`, `logico`, `cadeia`.
- **Controle de fluxo:** `se/senao`, `para`, `enquanto`, `faca...enquanto`,
  `escolha/caso/contrario`, `pare`, `continue`, `retorne`.
- **Operadores:** aritméticos, relacionais, `e`/`ou`/`nao` (lógicos em português),
  `verdadeiro`/`falso`, atribuição composta.
- **Entrada/saída:** `escreva()`, `escreval()`, `leia()`.
- **Estrutura:** `programa { funcao inicio() { ... } }` — ponto-e-vírgula opcional.

### Interface

- **Design editorial** com tipografia Fraunces + JetBrains Mono e temas
  claro/escuro com alternância pelo menu.
- **Layout em painéis** coordenados:

| Nº | Painel | Descrição |
|----|--------|-----------|
| I | **Código** | Editor com destaque de sintaxe, números de linha e marcação da linha ativa |
| II | **Estruturas** | Vetores e matrizes desenhados célula a célula com índices e cores |
| III | **Terminal** | Saída e entrada unificadas — exibe resultados e coleta entradas inline |
| IV | **Variáveis** | Escalares com destaque na variável modificada |
| V | **Trace** | Teste de mesa: lista clicável de todos os passos da execução |
| VI | **REPL** | Console interativo para JavaScript com estado persistente |

- **Barra de status** com indicador de estado (Pronto / Executando / Concluído / Erro),
  mensagem do passo atual e contador de progresso.
- **Destaque de erros:** erros de compilação destacam a linha com erro e a barra
  de status sinaliza o problema.
- **Controle de tamanho da fonte** no editor com botões A−/A+.
- **Painéis redimensionáveis** com divisores de arrastar entre cada área.

### Responsividade e acessibilidade

- Layout responsivo que empilha os painéis verticalmente em telas pequenas.
- Redimensionamento por toque em dispositivos móveis.
- Navegação por teclado, link para pular ao conteúdo principal e atributos ARIA
  nos controles interativos.
- Respeita a preferência do sistema por movimento reduzido.

### Compartilhamento por URL

O botão **Compartilhar** copia um link que contém o código-fonte e a linguagem
selecionada embutidos na URL. O código é comprimido para manter o link curto
e, em produção, é encurtado automaticamente. Ao abrir o link, o código é
restaurado e formatado.

### Controles de execução

- Botões: reiniciar, anterior, próximo, play/pause e slider de progresso.
- Quatro velocidades: Lenta, Normal, Rápida e Turbo.

### Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Enter` | Executar / Parar |
| `Tab` / `Shift+Tab` | Indentar / desindentar |
| `Alt+Shift+F` | Formatar código |
| `Alt+↑/↓` | Mover linha(s) |
| `Shift+Alt+↑/↓` | Duplicar linha(s) |
| `Ctrl+Shift+K` | Remover linha(s) |
| `Ctrl+;` | Comentar / descomentar linha(s) |
| `←` / `→` | Passo anterior / próximo (em execução) |

### Formatador de código

Formatador por linguagem que normaliza a indentação, preserva strings e
comentários, e trata construções como `case/default` e `caso/contrário` com
recuo adequado.

### Exemplos pré-carregados

Cada linguagem inclui exemplos prontos para uso:

- **C:** matriz 3×5 (menor e maior), soma de vetor, ponteiro básico.
- **Java:** soma de vetor, matriz 3×5, leitura com Scanner.
- **JavaScript:** soma de vetor, matriz 3×5, leitura com `prompt`.
- **Portugol:** soma de vetor, matriz 3×5, leitura com `leia()`.

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
    │   ├── ast.ts                   # Definição da AST
    │   ├── index.ts                 # API pública (compileAndRun)
    │   ├── interpreter.ts           # Interpretador com gravação de passos
    │   ├── memory.ts                # Modelo de memória
    │   └── types.ts                 # Tipos compartilhados
    ├── languages/                   # Front-ends por linguagem
    │   ├── types.ts                 # Interface Language
    │   ├── index.ts                 # Registro de linguagens
    │   ├── c/
    │   ├── java/
    │   ├── javascript/
    │   └── portugol/
    └── components/
        ├── ArrayView.tsx            # Vetores e matrizes
        ├── CodeView.tsx             # Editor de código
        ├── Controls.tsx             # Controles de execução
        ├── Mascot.tsx               # Barra de status
        ├── ReplPanel.tsx            # Console REPL interativo
        ├── TerminalPanel.tsx        # Terminal (entrada e saída)
        ├── TraceLog.tsx             # Lista de passos
        └── VariablesPanel.tsx       # Painel de variáveis
```

---

## Como o interpretador funciona

1. **Lexer** — tokeniza o código-fonte em palavras-chave, identificadores,
   números, strings e operadores.
2. **Parser** — constrói uma árvore sintática (AST) compartilhada entre todas
   as linguagens.
3. **Memória** — modelo plano onde cada variável ocupa uma ou mais células;
   ponteiros guardam endereços nesse vetor.
4. **Interpretador** — percorre a AST e, a cada operação, grava um passo
   contendo a linha atual, descrição, snapshot das variáveis, saída acumulada e
   foco (qual variável está sendo lida ou escrita).
5. **Entrada interativa** — quando o interpretador encontra uma leitura
   (`scanf`, `leia`, `prompt`, etc.), a execução pausa e o terminal integrado
   solicita o valor ao usuário.
6. A interface consome a lista de passos gravados e renderiza o passo
   selecionado — toda a navegação é instantânea.

Limite de segurança: a execução para após **5.000 passos** para evitar
travar a interface em caso de laço infinito.

### Adicionando novas linguagens

Crie um diretório em `src/languages/<nome>/` implementando a interface
`Language`:

- `parse(source)` — código-fonte para AST
- `format(source)` — código reformatado
- `highlight` — configuração de destaque de sintaxe
- `examples` — exemplos pré-carregados

Registre a linguagem em `src/languages/index.ts` e ela aparecerá
automaticamente no seletor.

---

## Próximos passos sugeridos

- Suporte a `struct`, `typedef`, `malloc`/`free` (C).
- Novas linguagens: Python, Pascal.
- Modo professor com biblioteca de exercícios.

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
