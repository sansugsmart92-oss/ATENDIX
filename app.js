(() => {
  const C = window.ATENDIX_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));

  const money = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const today = () =>
    new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo'
    });

  const monthKey = () => {
    const d = new Date();
    return {
      year: Number(
        new Intl.DateTimeFormat('en', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric'
        }).format(d)
      ),
      month: Number(
        new Intl.DateTimeFormat('en', {
          timeZone: 'America/Sao_Paulo',
          month: 'numeric'
        }).format(d)
      )
    };
  };

  const dayStart = () => `${today()}T00:00:00`;
  const dayEnd = () => `${today()}T23:59:59.999`;

  const ready =
    /^https:\/\/[^\s]+\.supabase\.co$/.test(C.SUPABASE_URL || '') &&
    !!C.SUPABASE_PUBLISHABLE_KEY &&
    !String(C.SUPABASE_PUBLISHABLE_KEY).includes('COLE_AQUI');

  const sb = ready
    ? window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true
          }
        }
      )
    : null;

  const S = {
    user: null,
    business: null,
    profile: null,
    membership: null,
    role: null
  };

  let signup = false;

  const menus = [
    ['dashboard','Dashboard'],
    ['agenda','Agenda'],
    ['clientes','Clientes'],
    ['servicos','Serviços'],
    ['profissionais','Profissionais'],
    ['financeiro','Financeiro'],
    ['metas','Metas'],
    ['relatorios','Relatórios'],
    ['historico','Histórico'],
    ['configuracoes','Configurações']
  ];

  function msg(text, type = '') {
    const el = $('#configWarn');
    if (el) {
      el.textContent = text;
      el.className = 'notice ' + type;
    }
  }

  function setNav(k) {
    $$('#nav button').forEach(b =>
      b.classList.toggle('active', b.dataset.k === k)
    );

    $('#title').textContent =
      menus.find(x => x[0] === k)?.[1] || k;

    render(k);
  }

  function buildNav() {
    $('#nav').innerHTML = menus
      .map(([k, t]) =>
        `<button type="button" data-k="${k}">${t}</button>`
      )
      .join('');

    $$('#nav button').forEach(b => {
      b.addEventListener('click', () => {
        setNav(b.dataset.k);
        $('#app aside').classList.remove('open');
      });
    });
  }

  function modal(title, body) {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `
      <div class="modal-card">
        <h2>${title}</h2>
        ${body}
      </div>
    `;
    return m;
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modal').innerHTML = '';
  }

  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });

  $('#menu').addEventListener('click', () =>
    $('#app aside').classList.toggle('open')
  );

  $('#toggle').addEventListener('click', () => {
    signup = !signup;

    $('#authTitle').textContent =
      signup ? 'Criar conta' : 'Entrar no painel';

    $('#authSubmit').textContent =
      signup ? 'Criar conta' : 'Entrar';

    $('#toggle').textContent =
      signup ? 'Já tenho conta' : 'Criar minha conta';

    $('#forgot').classList.toggle('hidden', signup);

    msg('');
  });

  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!sb) {
      return msg(
        'Configure a chave publicável do Supabase no config.js.'
      );
    }

    const email = $('#email').value.trim();
    const password = $('#password').value;

    if (signup) {
      const { data, error } = await sb.auth.signUp({
        email,
        password
      });

      if (error) return msg(error.message);

      if (data.session) {
        await finishLogin(data.session);
      } else {
        msg(
          'Conta criada. Verifique seu e-mail para confirmar o acesso.',
          'success'
        );
      }
    } else {
      const { data, error } =
        await sb.auth.signInWithPassword({
          email,
          password
        });

      if (error) return msg(error.message);

      await finishLogin(data.session);
    }
  });

  $('#google').addEventListener('click', async () => {
    if (!sb) {
      return msg(
        'Configure a chave publicável do Supabase no config.js.'
      );
    }

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname
      }
    });

    if (error) msg(error.message);
  });

  $('#forgot').addEventListener('click', async () => {
    if (!sb) return msg('Configure o Supabase primeiro.');

    const email = prompt(
      'Digite seu e-mail para receber o link de recuperação:'
    );

    if (!email) return;

    const { error } =
      await sb.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: location.origin + location.pathname
        }
      );

    msg(
      error
        ? error.message
        : 'Se o e-mail existir, enviaremos as instruções de recuperação.',
      error ? '' : 'success'
    );
  });

  $('#logout').addEventListener('click', async () => {
    await sb?.auth.signOut();

    S.user = null;
    S.business = null;
    S.membership = null;
    S.profile = null;
    S.role = null;

    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
  });

  async function finishLogin(session) {
    if (!session) return;
    await loadContext();
  }

  async function loadContext() {
    const {
      data: { user }
    } = await sb.auth.getUser();

    if (!user) return;

    S.user = user;

    const {
      data: mem,
      error: me
    } = await sb
      .from('memberships')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (me) {
      console.error(me);
      return msg(
        'Não foi possível carregar sua conta: ' +
        me.message
      );
    }

    if (!mem) {
      return onboarding();
    }

    S.membership = mem;
    S.role = mem.role;

    const [p, b] = await Promise.all([
      sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),

      sb
        .from('businesses')
        .select('*')
        .eq('id', mem.business_id)
        .maybeSingle()
    ]);

    if (p.error || b.error) {
      console.error(
        'loadContext',
        p.error || b.error
      );

      return msg(
        'Erro ao carregar os dados da empresa: ' +
        (p.error || b.error).message
      );
    }

    if (!b.data) {
      return msg(
        'Sua conta está sem empresa vinculada. Saia e entre novamente ou conclua o primeiro acesso.'
      );
    }

    S.profile = p.data;
    S.business = b.data;

    $('#emailTop').textContent = user.email || '';
    $('#tenant').textContent =
      S.business.name || 'Minha empresa';

    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');

    setNav('dashboard');
  }

  function onboarding() {
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');

    $('#tenant').textContent = 'Configuração inicial';
    $('#emailTop').textContent = S.user?.email || '';

    $('#content').innerHTML = `
      <div class="panel">
        <span class="tag">PRIMEIRO ACESSO</span>

        <h1>Configure sua empresa</h1>

        <p class="muted">
          Vamos criar sua conta empresarial no ATENDIX.
          Seus dados ficarão separados dos demais negócios.
        </p>

        <form id="onboard">

          <input
            id="obName"
            placeholder="Nome da empresa"
            required
          >

          <input
            id="obOwner"
            placeholder="Nome do responsável"
            required
          >

          <input
            id="obWa"
            placeholder="WhatsApp"
          >

          <div class="row">
            <input
              id="obOpen"
              type="time"
              value="08:00"
              required
            >

            <input
              id="obClose"
              type="time"
              value="18:00"
              required
            >
          </div>

          <input
            id="obCap"
            type="number"
            min="1"
            value="20"
            placeholder="Capacidade diária"
          >

          <button
            class="primary"
            type="submit"
          >
            Criar minha empresa
          </button>

          <p id="obMsg" class="notice"></p>

        </form>
      </div>
    `;

    $('#onboard').addEventListener(
      'submit',
      async e => {
        e.preventDefault();

        const button =
          $('#onboard button[type="submit"]');

        button.disabled = true;
        button.textContent = 'Criando empresa...';

        const payload = {
          p_business_name:
            $('#obName').value.trim(),

          p_responsible_name:
            $('#obOwner').value.trim(),

          p_whatsapp:
            $('#obWa').value.trim(),

          p_opening_time:
            $('#obOpen').value,

          p_closing_time:
            $('#obClose').value,

          p_daily_capacity:
            Number($('#obCap').value || 20)
        };

        const { error } =
          await sb.rpc(
            'create_business_onboarding',
            payload
          );

        if (error) {
          console.error(
            'create_business_onboarding',
            error
          );

          $('#obMsg').textContent =
            error.message;

          button.disabled = false;
          button.textContent =
            'Criar minha empresa';

          return;
        }

        $('#obMsg').textContent =
          'Empresa criada! Carregando seu painel...';

        await new Promise(resolve =>
          setTimeout(resolve, 500)
        );

        await loadContext();

        button.disabled = false;
        button.textContent =
          'Criar minha empresa';
      }
    );
  }

  async function render(k) {
    const fn = {
      dashboard,
      agenda,
      clientes,
      servicos,
      profissionais,
      financeiro,
      metas,
      relatorios,
      historico,
      configuracoes
    }[k];

    if (!fn) return;

    if (!S.business) {
      $('#content').innerHTML = `
        <div class="panel">
          <p class="error">
            A empresa ainda não foi carregada.
            Aguarde alguns segundos e tente novamente.
          </p>
        </div>
      `;

      return;
    }

    $('#content').innerHTML = `
      <div class="panel">
        <p class="muted">Carregando...</p>
      </div>
    `;

    try {
      $('#content').innerHTML = await fn();
    } catch (e) {
      console.error(e);

      $('#content').innerHTML = `
        <div class="panel">
          <p class="error">
            Não foi possível carregar esta área.
          </p>
          <small>${esc(e.message)}</small>
        </div>
      `;
    }
  }

  function metric(t, v, s) {
    return `
      <div class="metric">
        <small>${t}</small>
        <strong>${v}</strong>
        <small>${s}</small>
      </div>
    `;
  }

  async function dashboard() {
    if (!S.business) return '';

    const { data: a = [], error } =
      await sb
        .from('appointments')
        .select(`
          id,
          status,
          value,
          scheduled_at,
          customers(name),
          services(name)
        `)
        .eq('business_id', S.business.id)
        .gte('scheduled_at', dayStart())
        .lte('scheduled_at', dayEnd())
        .order('scheduled_at');

    if (error) throw error;

    const done =
      a.filter(x => x.status === 'finalizado');

    const open =
      a.filter(x =>
        ['agendado', 'confirmado']
          .includes(x.status)
      );

    const rev =
      done.reduce(
        (n, x) => n + Number(x.value || 0),
        0
      );

    const next = open[0];

    const { year, month } = monthKey();

    const g =
      (
        await sb
          .from('monthly_goals')
          .select('target_value')
          .eq('business_id', S.business.id)
          .eq('year', year)
          .eq('month', month)
          .maybeSingle()
      ).data;

    const target =
      Number(g?.target_value || 0);

    const pct =
      target
        ? Math.min(100, rev / target * 100)
        : 0;

    const trial =
      S.business.trial_ends_at
        ? Math.max(
            0,
            Math.ceil(
              (
                new Date(
                  S.business.trial_ends_at
                ) - new Date()
              ) / 86400000
            )
          )
        : null;

    const nextTime = next?.scheduled_at
      ? new Date(
          next.scheduled_at
        ).toLocaleTimeString(
          'pt-BR',
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        )
      : '';

    return `
      <div class="welcome">
        <div>
          <small>VISÃO GERAL</small>

          <h1>
            Olá,
            ${esc(
              S.profile?.full_name ||
              S.business.name
            )}
            👋
          </h1>

          <p class="muted">
            Acompanhe seus atendimentos de hoje.
          </p>
        </div>

        <button
          class="primary"
          type="button"
          onclick="window.ATENDIX.newAppt()"
        >
          + Novo agendamento
        </button>
      </div>

      ${
        trial !== null
          ? `
            <div class="trial">
              Teste gratuito:
              ${trial} dia(s) restante(s).
            </div>
          `
          : ''
      }

      <div class="metrics">

        ${metric(
          'Faturamento hoje',
          money(rev),
          'Somente finalizados'
        )}

        ${metric(
          'Agendamentos',
          a.length,
          'Hoje'
        )}

        ${metric(
          'Clientes atendidos',
          done.length,
          'Hoje'
        )}

        ${metric(
          'Vagas restantes',
          Math.max(
            0,
            Number(
              S.business.daily_capacity || 0
            ) - open.length
          ),
          'Capacidade diária'
        )}

      </div>

      <div class="grid">

        <div class="panel">
          <h3>Próximo cliente</h3>

          ${
            next
              ? `
                <b>
                  ${esc(
                    next.customers?.name ||
                    'Cliente'
                  )}
                </b>

                <p class="muted">
                  ${esc(nextTime)}
                  ·
                  ${esc(
                    next.services?.name || ''
                  )}
                </p>
              `
              : `
                <div class="empty">
                  Nenhum próximo atendimento.
                </div>
              `
          }
        </div>

        <div class="panel">

          <h3>Meta mensal</h3>

          <div class="kpi">
            ${money(rev)}
          </div>

          <p class="muted">
            Meta
