import "server-only";
// TODO: find complementary profiles; exclude self and already-swiped users; paginate.
// Route validates input -> service applies business rules -> model queries Supabase.
// Do not create a global server Supabase client or use a service-role key here.
export {};
