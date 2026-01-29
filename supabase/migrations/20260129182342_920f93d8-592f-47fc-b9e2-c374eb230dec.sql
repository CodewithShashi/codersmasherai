-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'team_member');

-- Create project status enum
CREATE TYPE public.project_status AS ENUM ('active', 'on_hold', 'completed');

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');

-- Create task priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'team_member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create project_members junction table
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    due_date DATE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create task_comments table
CREATE TABLE public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is project member
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
  ) OR EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
      AND created_by = _user_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Projects policies
CREATE POLICY "Users can view projects they are members of" ON public.projects
    FOR SELECT TO authenticated 
    USING (public.is_project_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project managers and admins can create projects" ON public.projects
    FOR INSERT TO authenticated 
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'project_manager'));

CREATE POLICY "Project creator or admin can update" ON public.projects
    FOR UPDATE TO authenticated 
    USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project creator or admin can delete" ON public.projects
    FOR DELETE TO authenticated 
    USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Project members policies
CREATE POLICY "Project members can view members" ON public.project_members
    FOR SELECT TO authenticated 
    USING (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project creator or admin can manage members" ON public.project_members
    FOR ALL TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
    );

-- Tasks policies
CREATE POLICY "Project members can view tasks" ON public.tasks
    FOR SELECT TO authenticated 
    USING (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project members can create tasks" ON public.tasks
    FOR INSERT TO authenticated 
    WITH CHECK (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can update tasks" ON public.tasks
    FOR UPDATE TO authenticated 
    USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Task creator or admin can delete" ON public.tasks
    FOR DELETE TO authenticated 
    USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Task comments policies
CREATE POLICY "Project members can view comments" ON public.task_comments
    FOR SELECT TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)
        )
    );

CREATE POLICY "Project members can create comments" ON public.task_comments
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = task_id AND public.is_project_member(auth.uid(), t.project_id)
        )
    );

CREATE POLICY "Comment author can update" ON public.task_comments
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Comment author can delete" ON public.task_comments
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Activity logs policies
CREATE POLICY "Users can view activity for their projects" ON public.activity_logs
    FOR SELECT TO authenticated 
    USING (
        project_id IS NULL OR public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Users can create activity logs" ON public.activity_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    -- First user becomes admin, rest are team members
    IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'team_member');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();