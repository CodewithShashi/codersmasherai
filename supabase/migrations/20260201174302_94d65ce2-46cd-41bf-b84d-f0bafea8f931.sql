-- Function to check if user is a client of a project
CREATE OR REPLACE FUNCTION public.is_project_client(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_clients
    WHERE user_id = _user_id
      AND project_id = _project_id
  ) AND has_role(_user_id, 'client')
$$;

-- RLS Policies for project_clients table
CREATE POLICY "Project creator or admin can manage clients"
ON public.project_clients
FOR ALL
USING (
    (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_clients.project_id
        AND projects.created_by = auth.uid()
    )) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Project members can view clients"
ON public.project_clients
FOR SELECT
USING (is_project_member(auth.uid(), project_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can see their own access"
ON public.project_clients
FOR SELECT
USING (user_id = auth.uid());

-- Update projects RLS to allow clients to view their assigned projects
CREATE POLICY "Clients can view assigned projects"
ON public.projects
FOR SELECT
USING (is_project_client(auth.uid(), id));

-- Update tasks RLS to allow clients to view tasks in their assigned projects  
CREATE POLICY "Clients can view tasks in assigned projects"
ON public.tasks
FOR SELECT
USING (is_project_client(auth.uid(), project_id));