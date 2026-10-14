# ⚡ KRONO | App Financeiro Zero-Friction (Fiat + Cripto)

Aplicativo financeiro *input-first* focado em velocidade extrema (< 3 segundos por lançamento), controle multi-moedas com moeda principal em **Guaraní Paraguaio (PYG)**, gestão de contas bancárias e carteiras cripto, módulo dinâmico de Despesas Fixas e painel inteligente **Safe-to-Spend**.

---

## 🚀 Principais Funcionalidades

1. **Fast Pad (< 3s)**:
   - Teclado numérico customizado integrado.
   - Botão **`000`** para digitação ultrarrápida de valores em Guaranís (PYG) sem repetição.
   - Ponto de milhar em tempo real durante a digitação.
   - Carrossel horizontal de categorias com arrasto via mouse (*drag-to-scroll*), navegação por setas laterais e rolagem pela rodinha (*mouse wheel*).
   - Tags rápidas (`#almoço`, `#uber`, `#mercado`, etc.) e suporte a comandos por voz / IA NLP.

2. **Moeda Principal em Guaraní (PYG)**:
   - Suporte nativo completo a Guaranís (PYG), Dólares (USD), Reais (BRL), Euros (EUR), USDT, Bitcoin (BTC), Ethereum (ETH) e Solana (SOL).
   - Câmbio e cotações dinâmicas em tempo real.

3. **Cofres & Multi-Moedas (Vaults)**:
   - Gestão de contas bancárias fiat, dinheiro em espécie, carteiras Web3 e cartões de crédito.
   - Botão direto para cadastrar novos bancos e carteiras.
   - Conversor com 1 clique para visualizar todo o patrimônio na moeda desejada.

4. **Despesas Fixas & Safe-to-Spend**:
   - Cadastro e gestão de despesas recorrentes do mês com status de pago/pendente.
   - Cálculo automático do Saldo Livre para Gasto:
     $$\text{Safe-to-Spend} = (\text{Saldo Fiat} + \text{Stablecoins Giro}) - \text{Despesas Fixas Pendentes}$$

5. **Extrato & Linha do Tempo**:
   - Registro cronológico com *snapshots* históricos da cotação no momento exato do lançamento.
   - Exclusão instantânea e duplicação rápida com botões acessíveis e destacados.
   - Busca em tempo real por descrição, conta, categoria ou tag.

6. **Gerenciador de Categorias**:
   - Criação de categorias personalizadas com nome, ícone emoji, seletor de cor neon e teto de orçamento mensal.

7. **Acesso Mobile & Rede Local**:
   - Servidor configurado com `host: 0.0.0.0` para teste instantâneo em qualquer celular ou dispositivo na mesma rede Wi-Fi.
   - 100% responsivo, com suporte a toque e vibração háptica (*haptic feedback*).

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, Vanilla CSS (Design Obsidian Cyber Fintech & Glassmorphism) e JavaScript ES Modules.
- **Build & Dev**: [Vite](https://vitejs.dev/)
- **Persistência**: LocalStorage *Offline-First* com importação e exportação de backup em JSON.

---

## 📦 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd "app gastos"
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse pelo navegador:
   - No computador: `http://localhost:3000`
   - No celular (mesmo Wi-Fi): `http://<SEU_IP_LOCAL>:3000`
