import { createClient } from '@supabase/supabase-js'

// Solo la URL y la llave pública van al cliente. Las credenciales de pey y la
// llave service_role viven únicamente en la configuración del backend.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// La navegación pública también funciona sin configurar un backend.
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null
