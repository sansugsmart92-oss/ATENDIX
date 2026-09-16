# ATENDIX — by Site Fácil TO — V2

Versão atualizada do ATENDIX com foco em estabilidade, autenticação PKCE, onboarding empresarial controlado, RLS multi-tenant e fluxo financeiro baseado em serviços finalizados.

## 1. Configuração

Abra `config.js` e coloque somente a **Publishable Key** do seu projeto Supabase no campo `SUPABASE_PUBLISHABLE_KEY`.

A URL do projeto já está configurada para o projeto ATENDIX.

> Nunca coloque `service_role` ou qualquer chave secreta no frontend.

## 2. Banco

No Supabase → SQL Editor, execute `supabase/schema.sql`.

O script cria/atualiza as tabelas e políticas necessárias, incluindo a função segura `create_business_onboarding`.

Se você já executou uma versão anterior do banco, este script foi escrito para ser reaplicável em grande parte, mas faça backup antes de mudanças em produção.

## 3. Auth

No Supabase → Authentication:
- Email habilitado
- Google habilitado se quiser login Google
- URL do site configurada para o domínio do Vercel

O frontend usa Supabase Auth com PKCE.

## 4. Deploy

GitHub → arquivos na raiz do repositório → Vercel → Deploy.

Não use `service_role` no `config.js`.

## 5. Fluxos implementados

- login por e-mail/senha
- criação de conta
- recuperação de senha
- Google OAuth
- onboarding automático da primeira empresa
- isolamento por `business_id` + RLS
- dashboard
- agenda
- clientes
- serviços
- profissionais
- financeiro
- metas
- relatórios
- histórico
- configurações
- teste gratuito de 7 dias na estrutura do banco
- serviço só entra no faturamento quando marcado como finalizado

## 6. Próximas etapas

- página pública de agendamento com RPC/Edge Function segura
- bloqueio real após expiração do trial
- Mercado Pago/Asaas
- QR Code
- capacidade por horário e prevenção de conflitos
- área administrativa separada para suporte/super admin
- testes automatizados de RLS
