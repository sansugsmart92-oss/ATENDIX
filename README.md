# ATENDIX — by Site Fácil TO
Starter SaaS multi-tenant para agendamentos.

1. Crie o projeto Supabase `atendix`.
2. Rode `supabase/schema.sql`.
3. Coloque somente URL + publishable key em `config.js`.
4. Configure Site URL/Redirect URL no Supabase.
5. Publique no GitHub/Vercel.

PKCE já está configurado no cliente. RLS usa `business_id` + memberships. Não coloque service_role/secrets no frontend.

Próximas etapas: onboarding controlado, booking público via RPC/Edge Function, QR Code real, capacidade por dia, relatórios, teste de 7 dias, assinatura Mercado Pago/Asaas e admin completo.
