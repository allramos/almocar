export const matrizExample = `#include <stdio.h>

int main() {
    int matriz[3][5] = {
        {10, 25,  7, 88, 42},
        { 3, 91, 56, 14, 67},
        {29,  5, 73, 38, 82}
    };

    int menor = matriz[0][0];
    int maior = matriz[0][0];

    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 5; j++) {
            if (matriz[i][j] < menor) {
                menor = matriz[i][j];
            }
            if (matriz[i][j] > maior) {
                maior = matriz[i][j];
            }
        }
    }

    printf("Menor: %d\\n", menor);
    printf("Maior: %d\\n", maior);

    return 0;
}
`;

export const somaExample = `#include <stdio.h>

int main() {
    int v[6] = {4, 8, 15, 16, 23, 42};
    int soma = 0;
    for (int i = 0; i < 6; i++) {
        soma += v[i];
    }
    printf("Soma: %d\\n", soma);
    return 0;
}
`;

export const ponteiroExample = `#include <stdio.h>

int main() {
    int x = 10;
    int *p = &x;
    *p = 25;
    printf("x agora vale %d\\n", x);
    return 0;
}
`;

export const examples: Record<string, { name: string; description: string; code: string }> = {
  matriz: { name: 'Matriz 3×5: menor e maior', description: 'Percorre matriz 3×5 buscando menor e maior valor', code: matrizExample },
  soma: { name: 'Soma de vetor', description: 'Soma elementos de um vetor usando laço for', code: somaExample },
  ponteiro: { name: 'Ponteiro básico', description: 'Altera valor de variável através de ponteiro', code: ponteiroExample },
};
