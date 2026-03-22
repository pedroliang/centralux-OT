-- Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    client_name VARCHAR(100),
    salesperson VARCHAR(100),
    start_photo_url TEXT,
    end_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress INT DEFAULT 0,
    route VARCHAR(100),
    delivery_forecast VARCHAR(100),
    is_delivery BOOLEAN DEFAULT FALSE
);

-- Adicionar colunas novas se a tabela já existir (Evita erro caso a tabela já tenha sido criada)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS salesperson VARCHAR(100),
ADD COLUMN IF NOT EXISTS start_photo_url TEXT,
ADD COLUMN IF NOT EXISTS end_photo_url TEXT,
ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE;

-- Habilitar RLS (opcional para testes, mas recomendado)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Criar política permitindo leitura/escrita anônima (Apenas para este protótipo/teste!)
CREATE POLICY "Permitir acesso total anônimo" ON public.orders
FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Métricas do Dia
CREATE TABLE IF NOT EXISTS public.hub_metrics (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    entregas INT DEFAULT 0,
    retiradas INT DEFAULT 0
);

-- Habilitar RLS
ALTER TABLE public.hub_metrics ENABLE ROW LEVEL SECURITY;

-- Política de acesso total anônimo (Prototipação)
CREATE POLICY "Permitir acesso total anônimo" ON public.hub_metrics
FOR ALL USING (true) WITH CHECK (true);

-- Inserir os dados iniciais mockados (Igual ao HTML atual)
INSERT INTO public.orders (order_id, priority, status, progress) VALUES
('#Luz-9842', 'Urgente', 'col-recebido', 0),
('#Luz-9845', 'Normal', 'col-recebido', 0),
('#Luz-9721', 'Urgente', 'col-andamento', 65),
('#Luz-9550', 'Baixo', 'col-separado', 0);

INSERT INTO public.orders (order_id, priority, status, progress, route, delivery_forecast) VALUES
('#Luz-8890', 'Trânsito', 'col-enviado', 0, 'Rota C-4', '18:45 Hoje');

INSERT INTO public.orders (order_id, priority, status, progress, delivery_forecast) VALUES
('#Luz-8871', 'Entregue', 'col-concluido', 100, '14 de Nov, 2026'),
('#Luz-8865', 'Entregue', 'col-concluido', 100, '14 de Nov, 2026');

-- Inserir métrica inicial do dia
INSERT INTO public.hub_metrics (date, entregas, retiradas) VALUES (CURRENT_DATE, 142, 28)
ON CONFLICT (date) DO NOTHING;

