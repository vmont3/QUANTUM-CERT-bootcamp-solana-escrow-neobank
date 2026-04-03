# Quantum Cert Vault // Escrow Multi-Sig Neobank

Este projeto foi desenvolvido para o **Solana Hackathon**, fundindo as teses de **Neobank (Opção B)** e **Escrow Pós-Quântico (Opção A)**. O sistema oferece uma camada de custódia híbrida onde as transações são protegidas por criptografia avançada e um modelo de co-assinatura obrigatória (Multi-Sig).

## 🚀 Arquitetura Master

A solução permite que usuários gerenciem seus fundos de forma soberana, mas com uma camada de segurança institucional (Oráculo/Authority).

### Principais Funcionalidades:
1.  **Quantum Vault (Neobank)**: Depósitos e saques protegidos por PDAs (Program Derived Addresses) únicos por usuário.
2.  **Escrow Pós-Quântico**: Transferências P2P não são enviadas diretamente. Elas são "travadas" em um contrato condicional (Escrow) on-chain.
3.  **Multi-Sig Mandatory**: A liberação de fundos de um Escrow exige a assinatura dupla:
    *   Assinatura do Recebedor (Finalização da transação).
    *   Assinatura da Autoridade Quantum (Validação Oracular de integridade).
4.  **Asset Validator**: Motor visual para auditoria de transações e certificados na Solana Devnet.

## 🛠️ Stack Técnica
*   **Smart Contract**: Anchor Framework (Rust)
*   **Frontend**: Next.js 16 (Turbopack) & Tailwind CSS
*   **Blockchain**: Solana Devnet
*   **Segurança**: Multi-Sig (2-of-2) & PDAs de Transição

## 📍 Deploy Info
*   **Program ID**: `HDXeLKERZhsXiFxAddtpfMhFpBt4bmSAYuLeBwNAWqms`
*   **Cluster**: Solana Devnet

## ⚙️ Como Usar
1.  **Conectar Carteira**: Use a Phantom no cluster Devnet.
2.  **Ativar Conta**: Inicialize seu cofre Quantum para habilitar o Neobank.
3.  **Carregar Saldo**: Use o botão de depósito para enviar SOL da carteira para o cofre seguro.
4.  **Negociar (Escrow)**:
    *   Na aba "Negociação Protegida", informe o recebedor, o valor e uma descrição.
    *   Clique em "Travar Fundos". Os fundos saem do seu cofre e ficam retidos no PDA de Escrow.
    *   O recebedor pode "Assinar e Receber" informando sua chave pública, liberando os fundos com a co-assinatura do Oráculo.

---
*Developed by Eng. VibeDoCode // Antigravity AI*
