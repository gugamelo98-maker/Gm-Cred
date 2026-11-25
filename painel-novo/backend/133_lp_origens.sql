-- 133 · Origem de cada lead da LP (sem Supabase: no mesmo envio que já existia, LP -> n8n lp/lead -> credito.lp_lead)
create table if not exists credito.lp_origens (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), lead_id int,
  nome text, celular text, cpf text, respostas jsonb, pagina_entrada text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  fbclid text, fbp text, fbc text, referrer text, user_agent text);
-- credito.lp_lead antiga virou credito.lp_lead_base; a nova lp_lead chama a base e grava p->'origem' em lp_origens
-- dentro de begin/exception (se a gravação falhar, o lead segue para o WhatsApp normalmente).
-- A tabela fica no schema credito (sem acesso público); só o painel/banco leem.
