-- Reusable catalog only. Safe to run repeatedly after all migrations. No demo identities.
begin;
insert into public.skill_categories(id,name) values
('living','Everyday & living'),('technical','Technical skills'),('creative','Art & design'),('music','Music'),('languages','Languages'),('wellness','Sports & wellness'),('career','Career & business') on conflict(id) do update set name=excluded.name;
insert into public.skills(name,category_id) values
('Cooking','living'),('Baking','living'),('Budgeting','living'),('Home repair','living'),('Gardening','living'),
('Python','technical'),('JavaScript','technical'),('Web Development','technical'),('Excel','technical'),('SQL','technical'),('Figma','technical'),('Git & GitHub','technical'),('Data Analysis','technical'),
('Photography','creative'),('Graphic Design','creative'),('UI design','creative'),('Drawing','creative'),('Painting','creative'),('Pottery','creative'),
('Guitar','music'),('Piano','music'),('Singing','music'),('Music production','music'),
('Spanish','languages'),('French','languages'),('Nepali','languages'),('English','languages'),('Mandarin','languages'),('Arabic','languages'),
('Yoga','wellness'),('Dance','wellness'),('Fitness','wellness'),('Swimming','wellness'),('Basketball','wellness'),('Football','wellness'),
('Public speaking','career'),('Resume writing','career'),('Marketing','career'),('Accounting','career'),('Entrepreneurship','career')
on conflict(name) do update set category_id=excluded.category_id;
commit;
