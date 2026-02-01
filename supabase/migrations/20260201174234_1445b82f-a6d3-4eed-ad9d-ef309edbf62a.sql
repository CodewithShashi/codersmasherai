-- Create table to track which clients can access which projects
CREATE TABLE public.project_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;