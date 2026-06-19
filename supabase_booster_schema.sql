-- ====================================================================
-- POKÉCHAMPION — Extensão de Boosters, Coleção de Cartas e Conquistas
-- Cole este script no SQL Editor do Supabase e clique em RUN
-- ====================================================================

-- 1. ADICIONA COLUNA DE BOOSTERS NOS PERFIS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS boosters_count INTEGER DEFAULT 0;

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

-- Mensagem de Confirmação
SELECT 'Estruturas de Coleção e Boosters configuradas com sucesso! 📦✨' AS status;
