import "server-only";
// TODO: verify match membership, then paginate or insert messages.
// Route validates input -> service applies business rules -> model queries Supabase.
// Do not create a global server Supabase client or use a service-role key here.
export {};
