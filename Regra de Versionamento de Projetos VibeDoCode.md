# 📜 Regra de Versionamento de Projetos - Antigravity VibeDoCode - Criado por Vanderson Oliveira

> **Status:** OBRIGATÓRIO (MANDATÓRIO para todos os projetos do ecossistema)

Este documento define a norma técnica para o controle de evolução de software nos projetos gerenciados pelo VibeDoCode. A regra segue o formato **V[MAJOR].[MINOR].[PATCH]** (Exemplo: `V1.02.05`).

---

## ⚖️ Mentalidade de Controle: Checkpoints & Timelines

Para garantir a estabilidade e a organização, adotamos a metáfora de videogames e linhas temporais:

### 1. 📸 Commit = Checkpoint
No videogame, o checkpoint é onde você salva o progresso para não voltar do zero se morrer. No código, o **Commit** é uma "foto" do seu projeto naquele momento exato. Se algo quebrar depois, você pode "dar respawn" (voltar) para esse ponto com segurança e rapidez.

### 2. 🛤️ Branch = Timeline (Timeline Temporal Paralela)
Uma **Branch** (ramificação) é um caminho onde o código evolui sem interferir nos outros. Criamos uma timeline paralela para cada tarefa nova (ex: `ajustar-botao-login`). Isso permite testar mudanças sem afetar o "mundo real" do sistema.

### 3. 🌌 Main Branch = Timeline Sagrada (Timeline Temporal Principal)
A **Main** (ou Master) é a linha do tempo "sagrada". É a versão do código que está rodando para o usuário final. É o destino final de todas as mudanças estáveis.

**O Fluxo de Trabalho:**
Você sai da linha principal (Main/Sagrada), cria uma timeline paralela (Branch) para trabalhar e, quando tudo está pronto, testado e validado, você funde (**merge**) essa realidade de volta à linha principal.

---

## 📄 Arquivo de Log Obrigatório: `atualizaçoes do projeto.md`

Todo projeto **DEVE** conter obrigatoriamente um arquivo chamado `atualizaçoes do projeto.md` na sua raiz.
- **Função:** Registrar de forma cronológica e simplificada o que mudou em cada versão.
- **Formato:** Cada linha deve começar com a numeração da versão seguida pela explicação do que foi feito.
- **Exemplo de conteúdo:**
  ```markdown
  - V1.01.04: Ajuste na data da Sofia para 2026 e unificação de pastas do Dashboard.
  - V1.01.03: Correção de erro de login e restrição de Beta Tester.
  - V1.00.00: Versão base do projeto.
  ```

---

## 🏗️ Estrutura da Numeração (V X.XX.XX)

### 1. PATCH (V 1.00.XX) - Terceiro Bloco
- **O que é:** Pequenos ajustes, correções de bugs (hotfixes), troca de textos ou ajustes visuais mínimos. Cada commit crítico deve ser acompanhado de um incremento.
- **Regra de Incremento:** Muda de `01` até `99`. 
- **Frequência:** A cada commit ("Checkpoint") que resolva um detalhe técnico.

### 2. MINOR (V 1.XX.00) - Segundo Bloco
- **O que é:** Mudanças maiores, inserção de novas funcionalidades, novas páginas ou refatorações de módulos concluídas em uma "Timeline".
- **Regra de Incremento:** Muda de `01` até `99`. Quando este bloco muda, o bloco **PATCH** deve obrigatoriamente retornar para `00`.
- **Frequência:** Sempre que uma tarefa do Roadmap for concluída e fundida na Timeline Sagrada.

### 3. MAJOR (V XX.00.00) - Primeiro Bloco
- **O que é:** Mudanças de arquitetura, rebranding completo ou quando o bloco **MINOR** atingir `99`.
- **Regra de Incremento:** Só deve ser alterado sob comando explícito do usuário ("Subir para Versão X"). Ao alterar, os blocos **MINOR** e **PATCH** retornam para `00`.

---

## 📱 Visibilidade e UI (User Interface)

A numeração da versão **DEVE** estar vísivel para o usuário final para fins de auditoria e suporte.

- **Localização Preferencial:** 
    1. Logo abaixo do nome principal do projeto (em tamanho reduzido e cor suavizada).
    2. No rodapé (footer) da aplicação, centralizado ou à direita.
- **Estilo Recomendado:** Fonte Mono (Ex: `V1.01.04`), opacidade entre 40% a 60%.

---

## 🚀 Regra de Deploy

**NENHUM** deploy para o servidor (Coolify, GitHub, Vercel, etc.) deve ser realizado sem o incremento da versão correspondente.

- O commit de deploy deve ser sempre padronizado: `release: Version VX.XX.XX`.
- O script `bump-version.sh` de cada projeto deve ser utilizado para garantir a sincronia entre o código, o manifesto (package.json) e a UI.

---

