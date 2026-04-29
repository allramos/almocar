import { describe, it, expect } from 'vitest';
import { compileAndRun } from './index';
import { cLanguage } from '../languages/c';

function runC(source: string, inputs = ''): { output: string; ok: boolean; error?: string } {
  const result = compileAndRun(source, cLanguage, {
    inputs,
    requestMoreInput: () => null,
  });
  return { output: result.output, ok: result.ok, error: result.error };
}

// ============================================================
// string.h
// ============================================================

describe('string.h — strlen', () => {
  it('retorna o comprimento correto', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[20] = "hello";
        printf("%d\\n", strlen(s));
        return 0;
      }
    `);
    expect(output.trim()).toBe('5');
  });

  it('string vazia retorna 0', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[5] = "";
        printf("%d\\n", strlen(s));
        return 0;
      }
    `);
    expect(output.trim()).toBe('0');
  });
});

describe('string.h — strcmp', () => {
  it('strings iguais retornam 0', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char a[10] = "abc";
        char b[10] = "abc";
        printf("%d\\n", strcmp(a, b) == 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });

  it('primeira menor retorna negativo', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char a[10] = "abc";
        char b[10] = "abd";
        printf("%d\\n", strcmp(a, b) < 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });

  it('primeira maior retorna positivo', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char a[10] = "xyz";
        char b[10] = "abc";
        printf("%d\\n", strcmp(a, b) > 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });
});

describe('string.h — strncmp', () => {
  it('compara apenas n caracteres', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char a[10] = "abcXX";
        char b[10] = "abcYY";
        printf("%d\\n", strncmp(a, b, 3) == 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });
});

describe('string.h — strcpy', () => {
  it('copia string para o destino', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char src[20] = "mundo";
        char dst[20];
        strcpy(dst, src);
        puts(dst);
        return 0;
      }
    `);
    expect(output.trim()).toBe('mundo');
  });
});

describe('string.h — strncpy', () => {
  it('copia até n caracteres', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char src[20] = "abcdef";
        char dst[20];
        strncpy(dst, src, 3);
        dst[3] = '\\0';
        puts(dst);
        return 0;
      }
    `);
    expect(output.trim()).toBe('abc');
  });
});

describe('string.h — strcat', () => {
  it('concatena duas strings', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[30] = "hello";
        char t[10] = " world";
        strcat(s, t);
        puts(s);
        return 0;
      }
    `);
    expect(output.trim()).toBe('hello world');
  });
});

describe('string.h — strchr', () => {
  it('encontra o caractere e retorna endereço não-nulo', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[20] = "hello";
        printf("%d\\n", strchr(s, 'l') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });

  it('retorna 0 quando não encontra', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[20] = "hello";
        printf("%d\\n", strchr(s, 'z') == 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });
});

describe('string.h — strstr', () => {
  it('encontra substring', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[30] = "hello world";
        char sub[10] = "world";
        printf("%d\\n", strstr(s, sub) != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });

  it('retorna 0 quando não encontra', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[20] = "hello";
        char sub[10] = "xyz";
        printf("%d\\n", strstr(s, sub) == 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1');
  });
});

describe('string.h — atoi / atof', () => {
  it('atoi converte string para inteiro', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <stdlib.h>
      int main() {
        char s[10] = "42";
        printf("%d\\n", atoi(s));
        return 0;
      }
    `);
    expect(output.trim()).toBe('42');
  });

  it('atof converte string para float', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <stdlib.h>
      int main() {
        char s[10] = "3.14";
        printf("%.2f\\n", atof(s));
        return 0;
      }
    `);
    expect(output.trim()).toBe('3.14');
  });
});

describe('string.h — fgets e puts', () => {
  it('fgets lê linha e puts exibe', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char nome[50];
        fgets(nome, 50, stdin);
        nome[strlen(nome) - 1] = '\\0';
        puts(nome);
        return 0;
      }
    `, 'Allan Ramos');
    expect(output).toContain('Allan Ramos');
  });

  it('fgets preserva espaços na entrada', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <string.h>
      int main() {
        char s[50];
        fgets(s, 50, stdin);
        printf("%d\\n", strlen(s) > 5 ? 1 : 0);
        return 0;
      }
    `, 'hello world');
    const lastLine = output.trim().split('\n').pop() ?? '';
    expect(lastLine).toBe('1');
  });
});

// ============================================================
// ctype.h
// ============================================================

describe('ctype.h — toupper / tolower', () => {
  it('toupper converte minúscula para maiúscula', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%c\\n", toupper('a'));
        return 0;
      }
    `);
    expect(output.trim()).toBe('A');
  });

  it('toupper não altera maiúscula', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%c\\n", toupper('Z'));
        return 0;
      }
    `);
    expect(output.trim()).toBe('Z');
  });

  it('tolower converte maiúscula para minúscula', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%c\\n", tolower('B'));
        return 0;
      }
    `);
    expect(output.trim()).toBe('b');
  });
});

describe('ctype.h — isalpha / isdigit / isalnum', () => {
  it('isalpha retorna não-zero para letras', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d\\n", isalpha('a') != 0 ? 1 : 0, isalpha('1') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 0');
  });

  it('isdigit retorna não-zero para dígitos', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d\\n", isdigit('9') != 0 ? 1 : 0, isdigit('x') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 0');
  });

  it('isalnum aceita letra e dígito, rejeita símbolo', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d %d\\n",
          isalnum('a') != 0 ? 1 : 0,
          isalnum('3') != 0 ? 1 : 0,
          isalnum('!') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 1 0');
  });
});

describe('ctype.h — isspace', () => {
  it('reconhece espaço, tab e newline', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d %d\\n",
          isspace(' ')  != 0 ? 1 : 0,
          isspace('\\t') != 0 ? 1 : 0,
          isspace('a')  != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 1 0');
  });
});

describe('ctype.h — isupper / islower', () => {
  it('isupper e islower classificam corretamente', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d %d %d\\n",
          isupper('A') != 0 ? 1 : 0,
          isupper('a') != 0 ? 1 : 0,
          islower('a') != 0 ? 1 : 0,
          islower('A') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 0 1 0');
  });
});

describe('ctype.h — isprint / iscntrl', () => {
  it('isprint aceita imprimíveis e rejeita controle', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d\\n",
          isprint('A') != 0 ? 1 : 0,
          isprint('\\n') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 0');
  });

  it('iscntrl reconhece caracteres de controle', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d\\n",
          iscntrl('\\n') != 0 ? 1 : 0,
          iscntrl('A')  != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 0');
  });
});

describe('ctype.h — isxdigit', () => {
  it('aceita dígitos hexadecimais', () => {
    const { output } = runC(`
      #include <stdio.h>
      #include <ctype.h>
      int main() {
        printf("%d %d %d %d\\n",
          isxdigit('0') != 0 ? 1 : 0,
          isxdigit('f') != 0 ? 1 : 0,
          isxdigit('F') != 0 ? 1 : 0,
          isxdigit('g') != 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(output.trim()).toBe('1 1 1 0');
  });
});

// ============================================================
// Verificação de #include ausente
// ============================================================

describe('erro de #include ausente', () => {
  it('erro ao usar strlen sem #include <string.h>', () => {
    const { ok, error } = runC(`
      #include <stdio.h>
      int main() {
        char s[10] = "hi";
        printf("%d\\n", strlen(s));
        return 0;
      }
    `);
    expect(ok).toBe(false);
    expect(error).toMatch(/string\.h/);
  });

  it('erro ao usar toupper sem #include <ctype.h>', () => {
    const { ok, error } = runC(`
      #include <stdio.h>
      int main() {
        printf("%c\\n", toupper('a'));
        return 0;
      }
    `);
    expect(ok).toBe(false);
    expect(error).toMatch(/ctype\.h/);
  });

  it('erro ao usar printf sem #include <stdio.h>', () => {
    const { ok, error } = runC(`
      int main() {
        printf("oi\\n");
        return 0;
      }
    `);
    expect(ok).toBe(false);
    expect(error).toMatch(/stdio\.h/);
  });
});
