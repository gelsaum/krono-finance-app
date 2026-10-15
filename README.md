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
   git clone https://github.com/gelsaum/krono-finance-app.git
   cd krono-finance-app
   ```

2. Instale as dependências:
   ```bash
   npm ci
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse pelo navegador:
   - No computador: `http://localhost:3000`
   - No celular (mesmo Wi-Fi): `http://<SEU_IP_LOCAL>:3000`

## Validação e regras de funcionamento

- Execute `npm test` para os testes de regressão e `npm run build` para validar a versão de produção. Os testes usam armazenamento em memória e não acessam os dados do navegador.
- Valores aceitam milhares e decimais: `1.500.000`, `1.500.000,50` e `1,500,000.50`. Para cripto, um separador único é decimal (ex.: `1.234 BTC`); para moedas fiat, grupos de três dígitos são milhares.
- Pagar uma despesa fixa solicita a conta de origem, cria uma despesa no extrato e debita o saldo. Desmarcar o pagamento reverte esse lançamento. Na troca do mês, as despesas tornam-se pendentes novamente e o histórico anterior é preservado. Pagamentos legados sem lançamento vinculado mantêm seu status no mês da migração.
- O saldo livre reserva despesas fixas pendentes e faturas de cartões. O limite diário inclui o dia atual. Não cadastre a mesma fatura também como despesa fixa, para evitar reserva duplicada.
- Compras em cartões devem ser lançadas na moeda da fatura; informe o valor convertido pela operadora. O saldo existente é preservado ao recarregar. Saldos já perdidos em versões anteriores exigem recuperação de um backup confiável.
- O orçamento por categoria considera apenas o mês atual. Novas transações preservam o valor histórico na moeda base do lançamento; registros antigos sem denominação histórica e visualizações em outra moeda continuam usando a conversão disponível.
- Backups versão 1.3 incluem criptomoedas personalizadas e suas últimas cotações disponíveis. A importação valida a estrutura antes de substituir os dados. Backups antigos válidos continuam aceitos.
- Variações de mercado de 24h sem uma fonte disponível são exibidas como indisponíveis. As cotações mantêm cache para uso offline.

O PIN é um bloqueio local de interface; os dados continuam no localStorage do navegador, sem criptografia ou sincronização entre dispositivos.

## Instalar no Android

A versão de produção inclui manifesto, ícones e service worker. Publique o conteúdo de `dist/` em uma hospedagem HTTPS, na raiz ou em uma subpasta. A configuração usa caminhos relativos.

1. Abra o link HTTPS no Chrome do Android.
2. Em Configurações do KRONO, toque em **Instalar KRONO** quando disponível, ou use o menu **⋮ → Instalar aplicativo / Adicionar à tela inicial** do Chrome.
3. Confirme a instalação no celular.

O servidor HTTP por IP da rede local continua útil para testes, mas não oferece os requisitos normais de instalação PWA. Para verificar o build no computador, execute `npm run build` e `npm run preview`; localhost é permitido como contexto de desenvolvimento.

O cache offline guarda apenas o app e seus recursos locais. APIs de cotação e fontes externas dependem de rede; sem conexão, o app usa cotações salvas e fontes do sistema. Uma atualização completa entra em uso após fechar as janelas antigas do app e abri-lo novamente. A primeira abertura deve ser online para preparar o cache. Dados não sincronizam entre dispositivos ou origens: exporte e importe o backup ao migrar do IP local para o endereço publicado.

## Melhorias financeiras — versão 1.4

- Extrato: editar pelo lápis; duplicar exige confirmação; excluir oferece desfazer por 10 segundos. Ajustes de conciliação são corrigidos excluindo e conciliando novamente.
- Transferências: informar valor líquido recebido e tarifa adicional na moeda de origem. A origem é debitada pelo valor enviado mais a tarifa; o destino recebe exatamente o valor informado. O extrato mostra o câmbio efetivo. Tarifas entram nas saídas mensais; transferências e pagamentos de fatura não entram como despesas novamente.
- Cartões: a tela Carteiras oferece faturas por mês de vencimento, seus lançamentos e pagamento parcial/total. O dia de fechamento pertence ao ciclo seguinte. Dívida legada sem ciclo conhecido é migrada para a fatura corrente, preservando seu valor.
- Parcelas: selecione o cartão no Fast Pad, informe o valor TOTAL e escolha de 1 a 36 parcelas. A soma das parcelas preserva o total, inclusive centavos. O limite compromete o total imediatamente; cada parcela entra no relatório do seu mês. Editar ou excluir uma parcela afeta somente aquela parcela. O saldo livre reserva toda a dívida, incluindo parcelas futuras, como medida conservadora.
- Conciliação: Carteiras → Conferir saldo, ou Configurações → Conferir saldo das contas. O ajuste fica identificado e não altera as métricas de receita/despesa.
- Recuperação: o estado completo é salvo como um único registro. A primeira alteração de cada dia guarda a versão anterior; até 10 cópias locais ficam acessíveis nas Configurações. Restaurações, importações e limpeza guardam uma cópia preventiva quando há espaço. Falhas no estado principal revertem a alteração em memória. Cópias locais NÃO protegem contra limpeza do navegador/perda do aparelho; continue exportando arquivos.
- Safe-Spend: resumo mensal selecionável e comparação com mês anterior, maiores categorias, contas vencidas e próximas em até 14 dias, receita prevista informativa e data da última cotação disponível. Reservas maiores que os fundos mostram a insuficiência.
- Privacidade: por escolha do usuário, não há login, dados em nuvem ou sincronização. A hospedagem recebe apenas o código do app.
- Atualizações do app instalado: fechar todas as janelas do KRONO e reabrir permite ativar a versão nova; a atualização nunca recarrega uma tela em edição automaticamente.
