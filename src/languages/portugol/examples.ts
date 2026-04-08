export const vetorSomaExample = `programa {
    funcao inicio() {
        inteiro vetor[6] = {4, 8, 15, 16, 23, 42}
        inteiro soma = 0

        para (inteiro i = 0; i < 6; i++) {
            soma += vetor[i]
        }

        escreva("Soma: ", soma, "\\n")
    }
}
`;

export const matrizExample = `programa {
    funcao inicio() {
        inteiro matriz[3][5] = {
            {10, 25,  7, 88, 42},
            { 3, 91, 56, 14, 67},
            {29,  5, 73, 38, 82}
        }

        inteiro menor = matriz[0][0]
        inteiro maior = matriz[0][0]

        para (inteiro i = 0; i < 3; i++) {
            para (inteiro j = 0; j < 5; j++) {
                se (matriz[i][j] < menor) {
                    menor = matriz[i][j]
                }
                se (matriz[i][j] > maior) {
                    maior = matriz[i][j]
                }
            }
        }

        escreva("Menor: ", menor, "\\n")
        escreva("Maior: ", maior, "\\n")
    }
}
`;

export const leituraExample = `programa {
    funcao inicio() {
        inteiro n

        escreva("Digite um número: ")
        leia(n)

        se (n % 2 == 0) {
            escreval("O número ", n, " é par.")
        } senao {
            escreval("O número ", n, " é ímpar.")
        }
    }
}
`;

export const examples: Record<string, { name: string; code: string }> = {
  vetorSoma:  { name: 'Soma de vetor',         code: vetorSomaExample },
  matriz:     { name: 'Matriz 3×5: menor e maior', code: matrizExample },
  leitura:    { name: 'Leitura com se/senão',   code: leituraExample },
};
