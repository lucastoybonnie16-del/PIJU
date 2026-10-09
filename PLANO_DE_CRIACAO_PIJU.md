# 🚀 Plano de Criação: Sistema Piju (Grand Prix SENAI)

## 1. Visão Geral e Conceito
**O Problema:** A rastreabilidade de 2 milhões de litros/dia na Piracanjuba é analógica (papel), o que gera lentidão e risco, especialmente no laboratório de análises (área crítica).
**A Solução (Piju):** Uma plataforma digital dividida em duas grandes frentes:
1. **O "Segundo Cérebro" (Second Brain):** Um banco de dados em formato de grafo (visual semelhante ao Obsidian), onde cada entidade (caminhão, silo, laudo, lote) é um "nó" conectado. Garante rastreabilidade total, rápida e imutável.
2. **IA Piju:** A assistente inteligente que simplifica a entrada de dados para os técnicos (que operam em 3 turnos com déficit de mão de obra) e gera relatórios automáticos.

---

## 2. Arquitetura do Sistema (A "Stack" de Tecnologia)

Para o Grand Prix, sugerimos uma arquitetura moderna e visualmente impactante para os jurados:

*   **Frontend (O Site e o Mapa Visual):**
    *   **React.js** ou **Next.js**: Para construir a interface web rapidamente.
    *   **React Force Graph** (ou D3.js): Biblioteca crucial para renderizar o mapa de pontos e linhas (dots e links) idêntico ao estilo do Obsidian.
    *   **Tailwind CSS**: Para estilização rápida e responsiva (Dark Mode industrial fica ótimo).
*   **Backend & Inteligência Artificial:**
    *   **Node.js (Express)** ou **Python (FastAPI)**: Python é excelente se você for integrar processamento de IA diretamente no backend.
    *   **LLM (Gemini / OpenAI):** O motor da "Piju". Vai interpretar o que o analista digita e transformar em dados estruturados.
*   **Banco de Dados & Rastreabilidade Imutável:**
    *   **Neo4j** (Banco de Grafos): Para armazenar os dados já no formato de rede (Nó Caminhão -> conectado a -> Nó Silo).
    *   **Log de Imutabilidade (Blockchain Privada ou Ledger):** Para garantir o requisito de que os dados *não podem ser alteráveis* (quem, quando, por que). No MVP do hackathon, uma tabela restrita de *Audit Trail* (onde só se faz `INSERT`, nunca `UPDATE` ou `DELETE`) é suficiente para provar o conceito.

---

## 3. Fluxo de Dados Inteligente (O Caminho do Leite)

Como as etapas físicas se transformam no Segundo Cérebro:

1.  **Entrada (Portaria):** Sistema SAP libera e a Piju registra a placa/motorista. Cria-se o **Nó A (Caminhão)**.
2.  **Pesagem:** O volume é registrado e atrelado ao Nó A.
3.  **Laboratório de Análise (O Gargalo/Área Crítica):** 
    *   O analista não preenche planilhas gigantes. Ele informa a Piju: *"Piju, leite do caminhão X, ph 6.7, alizarol normal, aprovado"*.
    *   A IA estrutura isso, valida regras físico-químicas e emite um laudo imutável. Cria-se o **Nó B (Laudo de Qualidade)**, conectado ao Caminhão.
4.  **Descarga (Plataforma -> Silo):** Leite cru entra no tanque. Cria-se o **Nó C (Silo de Leite Cru)**, conectado ao Caminhão e ao Laudo.
5.  **Processamento:** Pasteurização, Padronização, UHT, Tanque Asséptico. Cada máquina gera dados que viram novos nós conectados na rede.
6.  **Envase & Expedição:** Leite na caixinha. Cria-se o **Nó Final (Lote do Produto)**.

**A Magia do Grafo:** Se o SAC receber uma reclamação de uma caixinha, o gestor digita o Lote. O Segundo Cérebro destaca visualmente toda a teia de trás para frente: a máquina que envasou, o tanque, o laboratório que aprovou, o técnico logado naquele turno, e os 3 caminhões que encheram aquele silo. Tudo rastreável em 3 segundos.

---

## 4. Funcionalidades Principais (O que desenvolver no Hackathon)

### Módulo 1: O Segundo Cérebro (Dashboard do Gestor)
*   **Vista de Grafo Interativa:** Um mapa mental 3D ou 2D flutuante. O usuário pode clicar num "ponto" (ex: Caminhão) e ver todos os dados à direita.
*   **Barra de Pesquisa Global:** Para achar rapidamente lotes ou motoristas.
*   **Sistema de Pastas:** Visualização em árvore por `Data > Turno > Etapa`.

### Módulo 2: Interface Piju (Apoio ao Analista/Técnico)
*   **Smart Input (Chat/Voz):** Uma tela limpa onde o técnico joga a informação da análise. Isso reduz a curva de aprendizado e o tempo gasto, ajudando no problema de déficit de mão de obra.
*   **Geração de Relatórios Automática:** A IA consolida as informações do dia e gera um PDF de rastreabilidade (requisito de compliance trabalhista/sanitário).

---

## 5. Plano de Execução Passo a Passo (Roadmap Grand Prix)

Como o tempo é curto, foque no impacto visual e na clareza da solução:

*   **Passo 1: Mockup dos Dados (JSON).** Não tente plugar os equipamentos da Piracanjuba agora. Crie um arquivo JSON com dados fictícios imitando a jornada de 1 caminhão até 1 caixinha.
*   **Passo 2: Protótipo do Grafo.** Use React e a biblioteca `react-force-graph` para renderizar esse JSON num formato parecido com o Obsidian. Essa será sua tela "UAU" para os jurados.
*   **Passo 3: Protótipo da Piju.** Crie a tela do analista. Faça um campo de texto conectado à API de um LLM que pegue uma frase solta ("leite do caminhao 10 ta com ph 6.5") e retorne um objeto JSON validado.
*   **Passo 4: Discurso de Venda (Pitch).** 
    *   *Foque em:* Eliminação de papel, segurança total (sistema imutável), ganho de tempo no laboratório (que é crítico) e uso de IA para mitigar o déficit de mão de obra.
