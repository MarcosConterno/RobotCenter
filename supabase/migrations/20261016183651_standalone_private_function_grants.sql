-- Preserve the function permissions used by RLS in the standalone database.
-- These helpers are callable only by an authenticated transaction; the server
-- still applies all existing row policies and per-user/client checks.
GRANT EXECUTE ON FUNCTION
  private.can_update_robot(uuid),
  private.get_flow_creator_name(uuid),
  private.has_role(text),
  private.is_active_user(),
  private.publish_flow(uuid, jsonb),
  private.update_flow_metadata(uuid, text, uuid)
TO authenticated;
