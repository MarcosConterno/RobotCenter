-- Rebuild the database roles used by the standalone application without
-- trusting a Supabase API gateway to provide SQL privileges.
-- Data is not changed and no existing RLS policy is replaced.

DO $$
DECLARE
  schema_name text;
  table_row record;
  function_row record;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['public', 'auth', 'private', 'storage']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, service_role', schema_name);
      EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO service_role', schema_name);
      EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO service_role', schema_name);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO service_role', schema_name);
    END IF;
  END LOOP;

  FOR table_row IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO authenticated',
      table_row.schema_name,
      table_row.table_name
    );
  END LOOP;

  FOR function_row IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('has_permission', 'can_access_cliente')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      function_row.schema_name,
      function_row.function_name,
      function_row.identity_arguments
    );
  END LOOP;

  FOR function_row IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'append_robot_documentation_image_block',
        'archive_client_with_user_reassignment',
        'archive_robot_requirement',
        'begin_robot_center_documentation_publication',
        'complete_robot_center_documentation_publication',
        'create_tutorial',
        'fail_robot_center_documentation_publication',
        'get_flow_creator_name',
        'initialize_robot_center_documentation',
        'publish_flow',
        'publish_tutorial',
        'reorder_robot_documentation_blocks',
        'reorder_robot_requirements',
        'save_budget',
        'save_tutorial_draft',
        'update_flow_metadata',
        'update_robot_capacity',
        'update_role_permission_matrix'
      )
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      function_row.schema_name,
      function_row.function_name,
      function_row.identity_arguments
    );
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated';
  END IF;
END
$$;
