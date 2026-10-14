# Documentação de Produto e Arquitetura: App Financeiro "Zero-Friction" (Fiat + Cripto)

## 1. Visão Geral do Produto
* **Proposta de Valor:** Registrar qualquer despesa, receita ou conversão (Fiat $\leftrightarrow$ Cripto) em menos de **3 segundos**, eliminando a fricção que causa o abandono dos apps tradicionais.
* **Diferencial Competitivo:** Interface *Input-First* (abre direto para o lançamento) combinada com gestão nativa multi-moeda (ex: USD, BRL, PYG, EUR) e carteiras de criptomoedas (Stablecoins e ativos voláteis).

---

## 2. Mapa de Telas e Fluxo de Navegação (UX/UI)

A navegação principal é dividida em uma barra inferior (*Bottom Tab*) enxuta ou navegação por gestos (*Swipe*), priorizando a tela de lançamento.

### 2.1. Tela Inicial: "Fast Pad" (Foco Central)
Ao abrir o aplicativo, o usuário **não** vê gráficos pesados; ele vê o teclado pronto para ação.
* **Topo:** Seletor rápido de Tipo de Transação: `[ Despesa ]` | `[ Receita ]` | `[ Swap / Transferência ]`.
* **Visor Central:** Valor gigante sendo digitado + Seletor de Moeda/Ativo ao lado (ex: `Gs.`, `USD`, `USDT`, `BTC`).
* **Barra de Contexto Rápido (Acima do Teclado):**
  * **Pílula de Conta/Banco:** Pré-selecionada de forma inteligente (ex: `Itaú`, `Carteira Física`, `Binance`). Um toque abre um *bottom sheet* para trocar.
  * **Carrossel de Categorias:** Ícones grandes das 6 a 8 categorias mais usadas no horário atual.
  * **Campo de Nota / `#tag` / Botão de Voz (IA):** Opcional. Ao segurar o ícone de microfone, o usuário fala *"Gasolina 50 dólares no cartão X"* e o app preenche tudo.
* **Ação Principal:** Botão de confirmação rápida (ou gesto de deslizar para cima para salvar instantaneamente).

### 2.2. Tela de Carteiras & "Bancos" (Vaults)
Visão consolidada de onde o dinheiro está guardado, dividida em 3 grupos:
1. **Contas Tradicionais (Fiat):** Contas correntes, poupanças e dinheiro em espécie.
2. **Cripto Wallets & Exchanges:** Carteiras separadas por custódia (ex: *Binance*, *Ledger*, *Metamask*). Exibe a quantidade de tokens (ex: `0.15 BTC`, `1.500 USDT`) e o valor convertido na moeda base.
3. **Cartões de Crédito:** Faturas abertas, limite disponível e data de fechamento.

* **Recursos de Topo da Tela:**
  * **Toggle de Moeda Base (1-Click):** Alterna a visualização do Patrimônio Líquido Total entre `Moeda Local` $\rightarrow$ `USD` $\rightarrow$ `BTC`.
  * **Switch de Liquidez:** Permite ocultar ativos cripto de longo prazo (*Hold*) do saldo disponível para uso diário.

### 2.3. Tela de Dashboard & "Safe-to-Spend"
Focada em leitura de 10 segundos:
* **Card Principal (Quanto posso gastar):**
  $$\text{Saldo Livre} = (\text{Saldo Fiat} + \text{Stablecoins de Giro}) - \text{Despesas Fixas Pendentes do Mês}$$
* **Resumo do Mês:** Entradas vs. Saídas + Taxa de Poupança ($\text{Savings Rate } \%$).
* **Top 5 Categorias de Gasto:** Barras de progresso horizontais simples com alerta visual se ultrapassar a média histórica.

### 2.4. Tela de Extrato (Timeline)
* Lista cronológica agrupada por dia (*Hoje*, *Ontem*, datas anteriores).
* Busca instantânea por texto, categoria, conta ou `#tag`.
* Gesto *Swipe Left* para excluir ou *Swipe Right* para duplicar/repetir um lançamento.

---

## 3. Módulos de Automação e Velocidade Extrema

1. **Motor de NLP (Linguagem Natural por Texto e Voz):**
   * O usuário digita ou fala: `"Almoço 45 mil guaranis banco Atlas"` ou `"Comprei 200 USDT com 202 USD da conta X"`.
   * O parser identifica: $\text{Ação} + \text{Valor} + \text{Moeda} + \text{Conta} + \text{Categoria}$.
2. **Atalhos Fora do App:**
   * **Widgets (iOS/Android):** Botões diretos na tela inicial do celular (ex: botão `[+ Café]`, `[+ Uber]`, `[+ Áudio IA]`).
   * **Modo "Quick Launch" sem Biometria:** Permite abrir apenas o teclado de registro de gastos sem exigir FaceID/Impressão Digital (os saldos e históricos ficam ocultos com *blur* até autenticar).
   * **Bot de WhatsApp / Telegram:** Integração para enviar áudios rápidos ou fotos de recibos/comprovantes de transferência.
   * **Notification Listener (Android):** Lê notificações de apps bancários e gera um pop-up de 1 clique para confirmar o registro da despesa.

---

## 4. Regras de Negócio para Criptomoedas e Multi-Moeda

* **Snapshot de Cotação Histórica:**
  * Quando o usuário gasta em cripto ou moeda estrangeira, o sistema salva o valor na moeda original (`amount_original`) **e** grava a cotação do exato segundo da transação (`exchange_rate_at_tx`).
  * *Por que isso é vital?* Se o usuário pagou um jantar com `0.001 BTC` quando o Bitcoin valia $\$60.000$ (jantar de $\$60$), e no mês seguinte o Bitcoin sobe para $\$90.000$, o gasto histórico de alimentação continua sendo $\$60$, não distorcendo o orçamento passado.
* **Transações de Swap / Conversão:**
  * Comprar cripto com moeda fiduciária (ou trocar `USDT` por `BTC`) utiliza o tipo `SWAP`.
  * Registra a saída da Conta A, a entrada na Carteira B e contabiliza eventual diferença como `Taxa/Fee`, sem inflar os gráficos de "Despesas do Mês".

---

## 5. Modelagem de Dados (Database Schema - MVP)

Estrutura relacional pensada para funcionar em SQLite local (Offline-First) e sincronizar com PostgreSQL na nuvem.

### Tabela: `accounts` (Bancos e Carteiras)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID` (PK) | Identificador único da conta/carteira |
| `name` | `VARCHAR` | Ex: "Itaú", "Carteira Física", "Binance", "Ledger" |
| `type` | `ENUM` | `FIAT_BANK`, `CASH`, `CRYPTO_WALLET`, `CREDIT_CARD` |
| `default_currency` | `VARCHAR` | Moeda padrão (ex: `USD`, `PYG`, `BRL`, `USDT`, `BTC`) |
| `include_in_daily_balance`| `BOOLEAN` | Define se entra no cálculo do "Safe-to-Spend" |
| `updated_at` | `TIMESTAMP` | Controle de sincronização |

### Tabela: `account_balances` (Saldos Multi-Ativo por Carteira)
*Permite que uma mesma carteira (ex: Binance ou Banco Multi-moeda) tenha saldos em vários ativos diferentes.*
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID` (PK) | Identificador único |
| `account_id` | `UUID` (FK) | Referência para `accounts.id` |
| `asset_code` | `VARCHAR` | Código do ativo (`USD`, `PYG`, `BTC`, `ETH`, `USDT`) |
| `balance` | `DECIMAL(24,8)`| Saldo atual (8 casas decimais para suportar Satoshis/Cripto) |

### Tabela: `transactions` (Lançamentos)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID` (PK) | Identificador único da transação |
| `tx_type` | `ENUM` | `EXPENSE`, `INCOME`, `TRANSFER`, `SWAP` |
| `account_from_id` | `UUID` (FK) | Conta de origem (usado em `EXPENSE`, `TRANSFER`, `SWAP`) |
| `account_to_id` | `UUID` (FK) | Conta de destino (usado em `INCOME`, `TRANSFER`, `SWAP`) |
| `asset_from` | `VARCHAR` | Moeda/Token de saída (ex: `USDT`) |
| `amount_from` | `DECIMAL(24,8)`| Quantidade de saída |
| `asset_to` | `VARCHAR` | Moeda/Token de entrada (para `SWAP` ou `INCOME`) |
| `amount_to` | `DECIMAL(24,8)`| Quantidade de entrada |
| `base_currency_value` | `DECIMAL(18,2)`| Valor equivalente na moeda padrão do usuário no ato da compra |
| `exchange_rate_snapshot`| `DECIMAL(24,8)`| Cotação exata no momento do registro |
| `category_id` | `UUID` (FK) | Categoria do lançamento (nulo em caso de `TRANSFER`/`SWAP`) |
| `tags` | `JSONB` | Array de tags rápidas (ex: `["#viagem", "#clienteX"]`) |
| `note` | `VARCHAR` | Descrição curta opcional |
| `tx_date` | `TIMESTAMP` | Data e hora da transação |
| `sync_status` | `ENUM` | `SYNCED`, `PENDING_UPLOAD`, `CONFLICT` |

---

## 6. Stack Tecnológica Recomendada

* **Mobile App (iOS & Android):**
  * **Framework:** React Native (com Expo) ou Flutter.
  * **Banco de Dados Local (Offline-First):** WatermelonDB ou OP-SQLite (garante que o app abra e salve transações em menos de $50\text{ ms}$, mesmo sem internet).
* **Back-end & Cloud:**
  * **BaaS / Banco Nuvem:** Supabase (PostgreSQL + Autenticação + Edge Functions).
  * **Motor de IA (Voz e Texto):** OpenAI API (`gpt-4o-mini` para extração estruturada em JSON via texto e `Whisper` para transcrição de áudio rápida).
  * **APIs de Cotação (Cripto & Fiat):** CoinGecko API / Binance WebSocket (Cripto) + AwesomeAPI / OpenExchangeRates (Moedas Fiduciárias).

---

## 7. Roadmap de Desenvolvimento (Fases do MVP)

* **Fase 1: Core "3-Second Logger" (Semanas 1 a 4)**
  * Banco de dados local (Offline-First).
  * Tela "Fast Pad" com teclado imediato.
  * Gestão de Contas Fiat e Carteiras Cripto manuais + Transações de Receita, Despesa e Swap.
* **Fase 2: Cotações em Tempo Real & Nuvem (Semanas 5 a 7)**
  * Sincronização em nuvem e backup.
  * Integração com APIs de cotações cripto/fiat e cálculo do Patrimônio Líquido em 1 clique.
  * Dashboard "Safe-to-Spend".
* **Fase 3: Automação & IA (Semanas 8 a 10)**
  * Lançamento por comando de voz e texto natural (NLP).
  * Widgets de tela inicial e leitura de comprovantes via OCR.