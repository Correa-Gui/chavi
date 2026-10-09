-- Fase 0 · T13: schema do pg-boss sem acesso para os papéis da API (ADR-006).
-- O worker conecta como dono do banco (session pooler) e o próprio pg-boss cria suas tabelas em
-- `pgboss` na primeira inicialização. Criamos o schema antes, para fechar os grants desde o
-- primeiro objeto: nenhum papel da API (anon/authenticated) lê ou escreve a fila.
-- O schema não é exposto pela Data API; os revokes são a segunda barreira.
create schema if not exists pgboss;

revoke all on schema pgboss from public, anon, authenticated;

-- Objetos que o pg-boss criar depois (como `postgres`) já nascem sem privilégio para a API.
alter default privileges in schema pgboss revoke all on tables from public, anon, authenticated;
alter default privileges in schema pgboss revoke all on sequences from public, anon, authenticated;
alter default privileges in schema pgboss revoke all on functions from public, anon, authenticated;
