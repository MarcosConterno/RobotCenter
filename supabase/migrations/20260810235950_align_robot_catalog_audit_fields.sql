alter table public.robot_packages add column deleted_at timestamptz, add column deleted_by uuid;
alter table public.robot_stacks add column deleted_at timestamptz, add column deleted_by uuid;
alter table public.robot_queues add column deleted_at timestamptz, add column deleted_by uuid;
alter table public.robot_commands add column deleted_at timestamptz, add column deleted_by uuid;
