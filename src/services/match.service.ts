import "server-only";
// TODO: call one atomic database function to record a swipe and create a mutual match.
// Route validates input -> service applies business rules -> model queries Supabase.
// Do not create a global server Supabase client or use a service-role key here.
export {};
