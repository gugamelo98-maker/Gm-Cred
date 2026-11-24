-- 104 · Comissões do motor de crédito (aplicado em 24/11/2026). Separado da Ana: tabela credito.motor_comissao.
-- V8 FGTS: bancarizadora (GIRO/BMP) + tabela. Unno FGTS: tabela + faixa sobre o líquido (BMP e J17 iguais; ONIX só J17).
-- HUB CLT: planilha COMISSÃO CLT 25/08/2026, um valor por tabela+prazo (repetidos: fica o primeiro/maior).

-- Comissões do motor de crédito (separadas das tabelas usadas pela Ana)
create table if not exists credito.motor_comissao (
  id serial primary key,
  banco text not null,            -- v8 | unno | hub
  produto text not null,          -- clt | fgts
  bancarizadora text,             -- GIRO, BMP, J17… (null = vale para qualquer uma)
  tabela text not null,           -- nome normalizado (maiúsculas, sem acento)
  prazo int,                      -- null = qualquer prazo
  valor_min numeric,              -- faixa sobre o valor líquido do cliente (null = sem faixa)
  valor_max numeric,
  percentual numeric not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists motor_comissao_uk on credito.motor_comissao
  (banco, produto, coalesce(bancarizadora, ''), tabela, coalesce(prazo, 0), coalesce(valor_min, 0));
insert into credito.motor_comissao (banco, produto, bancarizadora, tabela, prazo, valor_min, valor_max, percentual) values
('v8','fgts','GIRO','ACELERA 2.0',null,null,null,65.0),
('v8','fgts','GIRO','COMETA',null,null,null,49.0),
('v8','fgts','GIRO','TURBO',null,null,null,34.99),
('v8','fgts','GIRO','NORMAL',null,null,null,29.0),
('v8','fgts','GIRO','PITSTOP',null,null,null,16.99),
('v8','fgts','BMP','ACELERA 2.0',null,null,null,58.01),
('v8','fgts','BMP','COMETA',null,null,null,42.0),
('v8','fgts','BMP','TURBO',null,null,null,29.01),
('v8','fgts','BMP','NORMAL',null,null,null,23.0),
('v8','fgts','BMP','PITSTOP',null,null,null,9.0),
('unno','fgts',null,'TSUNAMI',null,50,2500,45),
('unno','fgts',null,'OURO TOP',null,50,2500,41),
('unno','fgts',null,'ESMERALDA',null,50,350,25),
('unno','fgts',null,'ESMERALDA',null,350.01,800,22),
('unno','fgts',null,'ESMERALDA',null,800.01,1000,20),
('unno','fgts',null,'ESMERALDA',null,1000.01,2500,18),
('unno','fgts',null,'RUBI',null,50,350,22),
('unno','fgts',null,'RUBI',null,350.01,1000,19),
('unno','fgts',null,'RUBI',null,1000.01,2500,17),
('unno','fgts',null,'SAFIRA',null,50,2500,14),
('unno','fgts',null,'AMETISTA',null,50,2500,3),
('unno','fgts','J17','ONIX',null,50,2500,57),
('hub','clt',null,'MEGA CLT',46,null,null,9.5),
('hub','clt',null,'MEGA CLT',36,null,null,8.0),
('hub','clt',null,'MAPA DA MINA CLT',46,null,null,7.0),
('hub','clt',null,'TESOURO DA MINA CLT',48,null,null,6.5),
('hub','clt',null,'MEGA CLT',30,null,null,6.0),
('hub','clt',null,'POWER CLT 60X',60,null,null,6.0),
('hub','clt',null,'POWER CLT ONE 48X',48,null,null,5.625),
('hub','clt',null,'POWER CLT 36X',36,null,null,5.625),
('hub','clt',null,'POWER CLT 48X',48,null,null,5.625),
('hub','clt',null,'POWER CLT ONE 36X',36,null,null,5.625),
('hub','clt',null,'MAPA DA MINA CLT',36,null,null,5.25),
('hub','clt',null,'POWER CLT ONE 24X',24,null,null,5.25),
('hub','clt',null,'TESOURO DA MINA CLT',36,null,null,4.5),
('hub','clt',null,'POWER CLT 24X',24,null,null,4.5),
('hub','clt',null,'POWER CLT ONE 60X',60,null,null,4.5),
('hub','clt',null,'MAPA DA MINA CLT',24,null,null,4.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 1',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 10',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 13',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 2',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 3',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 4',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 6',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 8',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 9',48,null,null,3.5),
('hub','clt',null,'CHAVE DA MINA CLT MAX 1',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 10',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 13',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 2',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 3',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 4',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 6',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 8',36,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 9',36,null,null,3.25),
('hub','clt',null,'MAPA DA MINA CLT',18,null,null,3.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 1',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 10',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 13',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 2',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 3',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 4',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 6',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 8',24,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT MAX 9',24,null,null,3.0),
('hub','clt',null,'MAPA DA MINA CLT',12,null,null,3.0),
('hub','clt',null,'MEGA CLT',18,null,null,3.0),
('hub','clt',null,'CHAVE DA MINA CLT 1',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 10',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 13',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 2',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 3',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 4',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 6',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 8',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 9',48,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 1',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 10',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 13',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 2',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 3',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 4',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 6',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 8',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT MAX 9',18,null,null,2.75),
('hub','clt',null,'CHAVE DA MINA CLT 1',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 10',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 13',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 2',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 3',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 4',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 6',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 8',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 9',36,null,null,2.5),
('hub','clt',null,'TESOURO DA MINA CLT ESP',36,null,null,2.5),
('hub','clt',null,'CHAVE DA MINA CLT 1',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 10',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 13',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 2',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 3',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 4',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 6',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 8',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 9',24,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 1',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 10',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 13',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 2',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 3',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 4',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 6',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 8',14,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT MAX 9',14,null,null,2.25),
('hub','clt',null,'MAPA DA MINA CLT',6,null,null,2.25),
('hub','clt',null,'MAPA DA MINA CLT',8,null,null,2.25),
('hub','clt',null,'MAPA DA MINA CLT',10,null,null,2.25),
('hub','clt',null,'CHAVE DA MINA CLT 1',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 10',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 13',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 2',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 3',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 4',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 6',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 8',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 9',18,null,null,2.0),
('hub','clt',null,'CHAVE DA MINA CLT 1',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 10',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 13',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 2',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 3',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 4',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 6',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 8',14,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT 9',14,null,null,1.5),
('hub','clt',null,'TESOURO DA MINA CLT',24,null,null,1.5),
('hub','clt',null,'CHAVE DA MINA CLT ESP 4',14,null,null,0.3),
('hub','clt',null,'CHAVE DA MINA CLT ESP 4',18,null,null,0.3),
('hub','clt',null,'CHAVE DA MINA CLT ESP 6',18,null,null,0.3),
('hub','clt',null,'TESOURO DA MINA CLT',18,null,null,0.3)
on conflict do nothing;

create or replace function credito.motor_norm(p text) returns text language sql immutable as $$
  select regexp_replace(upper(translate(trim(coalesce(p, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')), '\s+', ' ', 'g') $$;

-- % de comissão do motor. Procura: mesma bancarizadora antes de "qualquer uma"; nome exato antes de nome contido;
-- prazo exato antes do maior prazo cadastrado abaixo; faixa de valor sobre o líquido quando houver.
create or replace function credito.motor_comissao_pct(p_banco text, p_produto text, p_bancarizadora text, p_tabela text, p_prazo int, p_valor numeric)
returns numeric language sql stable as $$
  select c.percentual from credito.motor_comissao c
   where c.ativo and c.banco = lower(p_banco) and c.produto = lower(p_produto)
     and (c.bancarizadora is null or c.bancarizadora = credito.motor_norm(p_bancarizadora))
     and (c.tabela = credito.motor_norm(p_tabela) or ' ' || credito.motor_norm(p_tabela) || ' ' like '% ' || c.tabela || ' %')
     and (c.prazo is null or c.prazo <= coalesce(p_prazo, c.prazo))
     and (c.valor_min is null or coalesce(p_valor, 0) between c.valor_min and c.valor_max)
   order by (c.bancarizadora is not null) desc, (c.tabela = credito.motor_norm(p_tabela)) desc, length(c.tabela) desc,
            (c.prazo = p_prazo) desc nulls last, c.prazo desc nulls last
   limit 1 $$;
