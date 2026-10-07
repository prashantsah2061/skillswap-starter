import "server-only";
// TODO: load and update profiles using a request-scoped authenticated Supabase client.
// Route validates input -> service applies business rules -> model queries Supabase.
// Do not create a global server Supabase client or use a service-role key here.
export {};
