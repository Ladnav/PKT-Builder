-- ====================================================================
-- POKÉCHAMPION — Extensão de Boosters, Coleção, ELO e Conquistas
-- Cole este script no SQL Editor do Supabase e clique em RUN
-- ====================================================================

-- 1. ADICIONA NOVAS COLUNAS NOS PERFIS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS boosters_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS elo_points INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tournaments_played INTEGER DEFAULT 0;

-- 2. CRIA TABELA DE CARDS COLECIONADOS (ÁLBUM)
CREATE TABLE IF NOT EXISTS public.user_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pokemon_id  INTEGER NOT NULL,
  is_shiny    BOOLEAN NOT NULL DEFAULT FALSE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_card UNIQUE (user_id, pokemon_id, is_shiny)
);

-- Ativa RLS para user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para user_cards
DROP POLICY IF EXISTS "Qualquer um pode ver as cartas dos jogadores" ON public.user_cards;
CREATE POLICY "Qualquer um pode ver as cartas dos jogadores" 
ON public.user_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias cartas" ON public.user_cards;
CREATE POLICY "Usuários podem gerenciar suas próprias cartas" 
ON public.user_cards FOR ALL USING (auth.uid() = user_id);


-- 3. CRIA TABELA DE CONQUISTAS (BADGES)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

-- Ativa RLS para user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para user_badges
DROP POLICY IF EXISTS "Qualquer um pode ver as conquistas dos jogadores" ON public.user_badges;
CREATE POLICY "Qualquer um pode ver as conquistas dos jogadores" 
ON public.user_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem inserir suas próprias conquistas" ON public.user_badges;
CREATE POLICY "Usuários podem inserir suas próprias conquistas" 
ON public.user_badges FOR ALL USING (auth.uid() = user_id);


-- 4. CRIA TABELA DE SHINIES (COLEÇÃO DE SHINIES RELACIONAIS)
CREATE TABLE IF NOT EXISTS public.user_shinies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pokemon_id   INTEGER NOT NULL,
  pokemon_data JSONB NOT NULL DEFAULT '{}',
  caught_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ativa RLS para user_shinies
ALTER TABLE public.user_shinies ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para user_shinies
DROP POLICY IF EXISTS "Shinies visíveis para todos" ON public.user_shinies;
CREATE POLICY "Shinies visíveis para todos" 
ON public.user_shinies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário insere shinies" ON public.user_shinies;
CREATE POLICY "Usuário insere shinies" 
ON public.user_shinies FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 5. CRIA TABELA DE HALL OF FAME (TIMES CAMPEÕES)
CREATE TABLE IF NOT EXISTS public.hall_of_fame (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_name   TEXT,
  team_json   JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ativa RLS para hall_of_fame
ALTER TABLE public.hall_of_fame ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para hall_of_fame
DROP POLICY IF EXISTS "Hall of fame visível para todos" ON public.hall_of_fame;
CREATE POLICY "Hall of fame visível para todos" 
ON public.hall_of_fame FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sistema/Admin insere no hall of fame" ON public.hall_of_fame;
CREATE POLICY "Sistema/Admin insere no hall of fame" 
ON public.hall_of_fame FOR INSERT WITH CHECK (true);


-- Mensagem de Confirmação
SELECT 'Todas as tabelas de coleção, conquistas, shinies, ELO e boosters configuradas com sucesso! 📦✨' AS status;
