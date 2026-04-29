-- Partidas (line items within a pedimento)
-- Run in Supabase SQL Editor

create table if not exists public.partidas (
  id bigserial primary key,
  pedimento_id text not null references public.pedimentos(pedimento_id) on delete cascade,
  partida_numero int not null,
  fraccion_arancelaria text,
  descripcion text,
  cantidad_comercial numeric(18,4),
  unidad_comercial text,
  cantidad_tarifa numeric(18,4),
  unidad_tarifa text,
  valor_dolares numeric(18,4),
  valor_aduana numeric(18,4),
  precio_unitario numeric(18,4),
  pais_origen text,
  pais_vendedor text,
  marca text,
  modelo text,
  vinculacion text,
  metodo_valoracion text,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pedimento_id, partida_numero)
);

create index if not exists partidas_pedimento_idx on public.partidas (pedimento_id);
create index if not exists partidas_fraccion_idx on public.partidas (fraccion_arancelaria);

create trigger partidas_updated_at before update on public.partidas
  for each row execute procedure public.set_updated_at();
