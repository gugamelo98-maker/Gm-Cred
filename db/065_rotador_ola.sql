-- 065: o link da API oficial (gmcredconsignado.com.br / www / redirect1) manda "Olá!" — é a identificação de origem.
--      Os chips continuam com "Oi! Quero *simular* meu crédito CLT 😊".
update credito.rotadores set texto = 'Olá! Quero *simular* meu crédito CLT' where slug = 'redirect1';
