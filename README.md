# Counter Program — Solana Anchor Bootcamp · Aula 2

Programa on-chain em Rust/Anchor com 4 instruções (`initialize`, `increment`, `decrement`, `reset`) e um frontend em Next.js para interagir com o contrato via carteira Phantom.

---

## Estrutura do Projeto

```
counter-program/
├── programs/counter-program/src/lib.rs   # Contrato Rust/Anchor
├── tests/counter-program.ts              # Testes Mocha/TypeScript
├── Anchor.toml                           # Configuração do Anchor
└── app/                                  # Frontend Next.js
    ├── app/page.tsx                      # Página principal
    ├── components/CounterApp.tsx         # UI do contador
    ├── components/SolanaProviders.tsx    # Wallet Adapter providers
    └── lib/useProgram.ts                 # Hook Anchor
```

---

## Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Solana CLI | 1.18.x |
| Anchor CLI | 0.29.x / 0.32.x |
| Rust | stable (via rustup) |
| Node.js | 18+ |
| Phantom Wallet | (extensão do browser) |

Verifique:
```bash
solana --version && anchor --version
```

---

## 1. Rodando os Testes (contrato)

O `anchor test` **não precisa** de validator rodando — ele sobe e derruba um automaticamente.

```bash
cd counter-program
anchor test
```

Saída esperada:
```
  counter-program
    ✔ Can initialize
    ✔ Can increment
    ✔ Can decrement
    ✔ Cannot go below zero (saturating_sub)
    ✔ Can reset

  5 passing (3s)
```

---

## 2. Deploy Manual (opcional)

Se quiser fazer deploy e interagir via frontend:

**Aba 1 — Validator local:**
```bash
solana config set --url localhost --keypair ~/.config/solana/id.json
solana-test-validator
```

**Aba 2 — Deploy:**
```bash
cd counter-program
anchor build
anchor deploy
```

---

## 3. Rodando o Frontend

```bash
cd counter-program/app

# Copie o env e ajuste se necessário
cp .env.local.example .env.local

# Instale as dependências (se ainda não fez)
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse: **http://localhost:3000**

### Usando o Frontend

1. Abra http://localhost:3000
2. Clique em **Select Wallet** → Phantom
3. Configure a Phantom para apontar para **Localhost 8899**
4. Clique em **⚡ Inicializar Contador**
5. Use os botões **Increment**, **Decrement** e **Reset**

> A carteira Phantom precisa estar na rede **Localnet** (Settings → Developer Settings → Change Network → Localhost)

---

## Conceitos da Aula

### Separação de Estado e Lógica

| Conceito | Descrição |
|---|---|
| **Account (PDA)** | Onde o estado vive on-chain (`count`, `owner`) |
| **Instruction** | Função stateless que lê/modifica a Account |

### O Contrato

```rust
#[account]
pub struct Counter {
    pub count: u64,    // valor atual
    pub owner: Pubkey, // dono do contador
}
```

`space = 8 + 8 + 32` → 8 bytes discriminador Anchor + 8 bytes u64 + 32 bytes Pubkey

### Aritmética Segura

```rust
// ❌ Perigoso — underflow em programs custam $$$
counter.count -= 1;

// ✅ Seguro — para em 0
counter.count = counter.count.saturating_sub(1);
```
