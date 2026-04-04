# 🛡️ Quantum Cert Vault // Neobanco Multi-Assinatura & Escrow Pós-Quântico

Bem-vindo ao repositório oficial da **Quantum Cert** para o Solana Hackathon. 
Nossa solução funde as teses de **Neobank (Opção B)** e **Escrow Seguro (Opção A)** para criar uma infraestrutura de custódia híbrida, desenvolvida para ser a ponte definitiva entre ativos do mundo real (RWAs) e a segurança blockchain.

---

## 🛑 O Problema: Por que o mercado precisa da Quantum Cert?

A adoção institucional e em massa da Web3 esbarra em três falhas críticas de segurança e usabilidade atuais:
1. **Ponto Único de Falha (Single Point of Failure):** Carteiras de auto-custódia (Self-custody) deixam os usuários vulneráveis. Se a chave privada for comprometida, os fundos são drenados instantaneamente. Não há rede de segurança.
2. **Ameaça Quântica Iminente:** A criptografia elíptica atual (usada na maioria das blockchains) será vulnerável a ataques de computadores quânticos na próxima década. Instituições hesitam em tokenizar ativos de longo prazo.
3. **Escrows Inflexíveis e Inseguros:** Plataformas P2P tradicionais dependem de intermediários humanos caros ou de Smart Contracts rígidos que não conseguem auditar o contexto do mundo real antes de liberar os fundos.

---

## 💡 A Solução: Nosso Produto

A Quantum Cert atua como um **Neobanco de Custódia Híbrida**. Nós permitimos que o usuário mantenha a soberania dos seus fundos na Solana, mas adicionamos um "cofre inteligente" ao redor da conta, protegido por um Oráculo Pós-Quântico.

Se a sua carteira for roubada, o hacker **não consegue sacar ou transferir seus fundos**, pois o nosso Oráculo se recusará a co-assinar transações suspeitas ou não autenticadas.

### 🔐 A Magia por trás: Multi-Sig & Segurança Pós-Quântica

Nossa arquitetura resolve as dores do mercado através de duas engrenagens principais:

#### 1. A Mesclagem de Chaves (Multi-Sig 2-de-2 Obrigatória)
Nenhum centavo se move na Quantum Cert com apenas uma assinatura. Implementamos nativamente no Smart Contract (Anchor) um bloqueio de estado:
* **Chave do Usuário:** Inicia a intenção (ex: "Quero sacar" ou "Quero liberar o Escrow").
* **Chave do Oráculo Quantum:** Nosso servidor audita a transação, verifica regras de negócio, checa se a conta não está sinalizada como "Sinistrada" e, só então, injeta a segunda assinatura.
* **Resultado:** Se a regra não for cumprida, o Smart Contract na Solana rejeita a transação com o erro de `UnauthorizedAuthority (6004)`.

#### 2. Blindagem Pós-Quântica (Algoritmo Falcon-512)
Para proteger o nosso Oráculo (que detém a chave de co-assinatura), a camada de validação da Quantum Cert incorpora conceitos do algoritmo criptográfico **Falcon-512** (aprovado pelo NIST). 
Isso garante que a infraestrutura responsável por auditar e gerar os "Passaportes Digitais" dos ativos (sejam transações, pets ou produtos físicos) esteja imunizada contra vetores de ataque quânticos futuros, oferecendo segurança institucional para RWAs.

---

## ⚙️ Principais Funcionalidades do Ecossistema

1. **Quantum Vault (O Neobanco):** Contas correntes on-chain criadas através de PDAs (Program Derived Addresses) determinísticos (`vault_master`). Depósitos são abertos, mas saques exigem validação Multi-Sig.
2. **Escrow Seguro (Transferência Condicional):** Crie contratos P2P. O dinheiro sai do seu cofre e fica travado no PDA do Escrow (`escrow_master`). O recebedor assina o recebimento em sua própria "Caixa de Entrada", e o Oráculo valida a liberação, pagando a taxa de rede e finalizando o negócio.
3. **Validador de Ativos (Proof of Integrity):** Um motor visual que audita hashes da Solana. Ele lê a blockchain e gera um Certificado Oficial atestando a Faceta do Ativo (ex: *Transação, Documento, Produto*) e seu Status atual (*Autenticidade Confirmada, Sinistrado, etc.*).

---

## 🛠️ Stack Tecnológico

* **Smart Contract (Backend):** Rust (Framework Anchor)
* **Frontend (DApp):** Next.js 16 (Turbopack), TypeScript, HTML/CSS Vanilla
* **Integração Web3:** `@solana/web3.js`, `@coral-xyz/anchor`, `@solana/wallet-adapter`
* **Rede:** Solana Devnet

---

## 🎯 Entregáveis do Hackathon (Bootcamp Check)

* **Program ID (Devnet):** `CnxgAWYAFCNQPE9g1SFGyTVqKaVVVmPXYG5eXT9EjqxN`
* **Instruções Disponíveis no Programa:**
  * `init`: Inicializa o PDA do cofre amarrando a chave do usuário à Autoridade Quantum.
  * `deposit`: Permite aporte livre de fundos (SOL) para o PDA.
  * `withdraw`: Libera fundos do PDA para a carteira (Requer assinatura do usuário + Oráculo).
  * `lock_escrow`: Transfere fundos do Vault para um PDA de Escrow amarrado a um Recebedor.
  * `release_escrow`: Desbloqueia fundos do Escrow para o Recebedor (Requer assinatura do Recebedor + Oráculo).

---

## 🧪 Como Rodar e Testar

### 1. Rodando a Suíte de Testes Automatizados (Critério de Avaliação)
Nosso projeto possui testes completos validando inicialização, depósitos, saques e falhas de segurança propositais (Multi-sig rejection).
```bash
# Clone o repositório
git clone https://github.com/vmont3/QUANTUM-CERT-bootcamp-solana-escrow-neobank.git
cd solana-aula-2

# Instale as dependências
npm install

# Execute a suíte de testes do Anchor
anchor test
```

### 2. Rodando o Neobanco Localmente (DApp)
```bash
# Entre na pasta do Frontend
cd app

# Instale e rode
npm install
npm run dev

# Acesse http://localhost:3000
```

---

## 🕹️ Fluxo de Teste da UI

1. **Conexão:** Conecte sua Phantom Wallet (Certifique-se de estar na **Devnet**).
2. **Ignition:** Clique em **"Inicializar Cofre Master"**.
3. **Banking:** Use a aba "Meu Cofre" para testar Depósitos e Saques.
4. **Escrow:** Use a aba "Transferência Protegida" para enviar fundos de forma segura.
5. **Certificação:** Copie o Signature da transação e cole no "Validador" para obter seu Certificado de Integridade.

Architected and Engineered by Vinícius Monteiro (Quantum Cert Founder) // Supreteam Hackathon
