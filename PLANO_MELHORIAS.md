# Plano de melhorias do KRONO

Preferência confirmada: dados somente no dispositivo, sem login nem sincronização nesta etapa.

1. Integridade dos lançamentos: editar valor, conta, categoria e data; recalcular saldos; desfazer exclusão; confirmar duplicação.
2. Proteção local: salvar um estado completo, manter até 10 versões de recuperação, restaurar e exportar; alertar quando o armazenamento falhar. As cópias locais também são apagadas se os dados do navegador forem limpos.
3. Transferências reais: valor líquido recebido, tarifa na moeda de origem, câmbio efetivo e visualização das duas pontas no extrato.
4. Cartões: faturas por mês de vencimento, fechamento, pagamento parcial/total e compras parceladas. O limite fica comprometido pelo total das parcelas; relatórios consideram cada parcela no seu mês.
5. Conciliação: comparar saldo informado com o calculado e registrar um ajuste identificado no extrato, sem tratá-lo como renda ou despesa do mês.
6. Visibilidade: resumo mensal com comparação ao anterior, maiores categorias, próximos vencimentos, previsão de receita e idade das cotações.
7. Validação e publicação: testes de regressão, versão de produção, navegação em telas pequenas e publicação no mesmo endereço HTTPS. O app instalado atualiza após fechar suas janelas e abrir novamente.

Critérios: editar/excluir/restaurar não cria ou perde dinheiro; pagamento de fatura não duplica despesa; tarifas são contadas uma vez; arquivos antigos válidos continuam importáveis; nenhum dado financeiro é enviado ao servidor.

Fora desta etapa por escolha do usuário: autenticação, backup em nuvem e sincronização entre aparelhos.
