-- 064: disparos novos terminam às 22h por padrão (antes 20h). Duplicar continua copiando o horário do original.
alter table credito.disparos alter column hora_fim set default 22;
