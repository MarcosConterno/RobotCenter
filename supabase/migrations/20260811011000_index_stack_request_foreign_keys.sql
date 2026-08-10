create index stack_requests_queue_idx on public.stack_requests (queue_id) where queue_id is not null;
create index stack_requests_created_by_idx on public.stack_requests (created_by);
create index stack_requests_updated_by_idx on public.stack_requests (updated_by) where updated_by is not null;
create index stack_request_history_created_by_idx on public.stack_request_history (created_by);
