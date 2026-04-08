export const vetorSomaExample = `public class Main {
    public static void main(String[] args) {
        int[] v = {4, 8, 15, 16, 23, 42};
        int soma = 0;
        for (int i = 0; i < 6; i++) {
            soma += v[i];
        }
        System.out.println("Soma: ", soma);
    }
}
`;

export const matrizExample = `public class Main {
    public static void main(String[] args) {
        int[][] matriz = {
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

        System.out.println("Menor: ", menor);
        System.out.println("Maior: ", maior);
    }
}
`;

export const leituraExample = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.print("Digite um número: ");
        int n = scanner.nextInt();

        if (n % 2 == 0) {
            System.out.println("O número ", n, " é par.");
        } else {
            System.out.println("O número ", n, " é ímpar.");
        }

        scanner.close();
    }
}
`;

export const examples: Record<string, { name: string; code: string }> = {
  vetorSoma:  { name: 'Soma de vetor',             code: vetorSomaExample },
  matriz:     { name: 'Matriz 3×5: menor e maior', code: matrizExample },
  leitura:    { name: 'Leitura com Scanner',        code: leituraExample },
};
