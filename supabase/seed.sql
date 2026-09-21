-- Catalog only: users must be created through Supabase Auth.
insert into public.skills(name) values
('Python'),('JavaScript'),('Web Development'),('Photography'),('Guitar'),('Spanish'),('Data Analysis'),('Graphic Design')
on conflict(name) do nothing;
