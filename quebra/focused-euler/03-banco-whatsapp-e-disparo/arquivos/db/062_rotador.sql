-- 062: rotacionador de números (redirect1.gmcredconsignado.com.br -> Vercel -> n8n GET /webhook/gmcred/r?s=<slug> -> 302 wa.me)
create table if not exists credito.rotadores (slug text primary key, nome text not null, numeros text[] not null default '{}', texto text not null,
  ativo boolean not null default true, idx int not null default 0, criado_em timestamptz not null default now());
create table if not exists credito.rotador_cliques (id bigserial primary key, slug text not null, instancia text, numero text, em timestamptz not null default now());
insert into credito.rotadores (slug, nome, numeros, texto) values ('redirect1', 'Rotacionador 1', '{}', 'Oi! Quero *simular* meu crédito CLT 😊') on conflict do nothing;
-- credito.rotador_proximo(p_slug) -> jsonb {numero, texto, instancia}: um clique para cada número (round-robin) entre os conectados da lista;
-- lista vazia = números de atendimento conectados. Registra o clique em rotador_cliques.
