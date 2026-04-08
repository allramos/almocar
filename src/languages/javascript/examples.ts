export const vetorSomaExample = `let v = [4, 8, 15, 16, 23, 42];
let soma = 0;
for (let i = 0; i < 6; i++) {
    soma += v[i];
}
console.log("Soma:", soma);
`;

export const matrizExample = `let matriz = [
    [10, 25,  7, 88, 42],
    [ 3, 91, 56, 14, 67],
    [29,  5, 73, 38, 82]
];

let menor = matriz[0][0];
let maior = matriz[0][0];

for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
        if (matriz[i][j] < menor) {
            menor = matriz[i][j];
        }
        if (matriz[i][j] > maior) {
            maior = matriz[i][j];
        }
    }
}

console.log("Menor:", menor);
console.log("Maior:", maior);
`;

export const leituraExample = `let n = parseInt(prompt("Digite um número:"));

if (n % 2 == 0) {
    console.log("O número", n, "é par.");
} else {
    console.log("O número", n, "é ímpar.");
}
`;

export const localStorageExample = `localStorage.setItem("nome", "Maria");
localStorage.setItem("idade", "25");
localStorage.setItem("cidade", "Recife");

let nome = localStorage.getItem("nome");
let idade = localStorage.getItem("idade");

console.log("Nome:", nome);
console.log("Idade:", idade);

localStorage.removeItem("cidade");

localStorage.setItem("idade", "26");

console.log("Idade atualizada:", localStorage.getItem("idade"));
`;

export const examples: Record<string, { name: string; code: string }> = {
  vetorSoma:    { name: 'Soma de vetor',             code: vetorSomaExample },
  matriz:       { name: 'Matriz 3×5: menor e maior', code: matrizExample },
  leitura:      { name: 'Leitura com prompt',         code: leituraExample },
  localStorage: { name: 'localStorage simulado',      code: localStorageExample },
};
