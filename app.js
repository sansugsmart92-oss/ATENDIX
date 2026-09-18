(() => {
  const C = window.ATENDIX_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR',{
    style:'currency',
    currency:'BRL'
  });
  const today = () => new Date().toLocaleDateString('en-CA',{
    timeZone:'America/Sao_Paulo'
  });
  const monthKey = () => {
    const d = new Date();
    return {
      year:Number(new Intl.DateTimeFormat('en',{
        timeZone:'America/Sao_Paulo',
        year:'numeric'
      }).format(d)),
      month:Number(new Intl.DateTimeFormat('en',{
        timeZone:'America/Sao_Paulo',
        month:'numeric'
      }).format(d))
    };
  };

  const ready =
    /^https:\/\/[^\s]+\.supabase\.co$/.test(C.SUPABASE_URL || '') &&
    !!C.SUPABASE_PUBLISHABLE_KEY &&
    !String(C.SUPABASE_PUBLISHABLE_KEY).includes('COLE_AQUI');

  const sb = ready
    ? window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY,
        {
          auth:{
            flowType:'pkce',
            detectSessionInUrl:true,
            persistSession:true,
            autoRefreshToken:true
          }
        }
      )
    : null;

  const S = {
    user:null,
    business:null,
    profile:null,
    membership:null,
    role:null
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

  function msg(text,type=''){
    const el = $('#configWarn');
    if(el){
      el.textContent = text;
      el.className = 'notice '+type;
    }
  }

  function setNav(k){
    $$('#nav button').forEach(b =>
      b.classList.toggle('active',b.dataset.k===k)
    );
    $('#title').textContent =
      menus.find(x=>x[0]===k)?.[1] || k;
    render(k);
  }

  function buildNav(){
    $('#nav').innerHTML = menus.map(([k,t]) =>
      `<button type="button" data-k="${k}">${t}</button>`
    ).join('');

    $$('#nav button').forEach(b =>
      b.addEventListener('click',()=>{
        setNav(b.dataset.k);
        $('#app aside').classList.remove('open');
      })
    );
  }

  function modal(title,body){
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="modal-card"><h2>${title}</h2>${body}</div>`;
    return m;
  }

  function closeModal(){
    $('#modal').classList.add('hidden');
    $('#modal').innerHTML = '';
  }

  $('#modal').addEventListener('click',e=>{
    if(e.target.id==='modal') closeModal();
  });

  $('#menu').addEventListener('click',()=>{
    $('#app aside').classList.toggle('open');
  });

  $('#toggle').addEventListener('click',()=>{
    signup = !signup;

    $('#authTitle').textContent =
      signup ? 'Criar conta' : 'Entrar no painel';

    $('#authSubmit').textContent =
      signup ? 'Criar conta' : 'Entrar';

    $('#toggle').textContent =
      signup ? 'Já tenho conta' : 'Criar minha conta';

    $('#forgot').classList.toggle('hidden',signup);
    msg('');
  });

  $('#authForm').addEventListener('submit',async e=>{
    e.preventDefault();

    if(!sb)
      return msg('Configure a chave publicável do Supabase no config.js.');

    const email = $('#email').value.trim();
    const password = $('#password').value;

    if(signup){
      const {data,error} = await sb.auth.signUp({
        email,
        password
      });

      if(error) return msg(error.message);

      if(data.session){
        await finishLogin(data.session);
      }else{
        msg(
          'Conta criada. Verifique seu e-mail para confirmar o acesso.',
          'success'
        );
      }
    }else{
      const {data,error} =
        await sb.auth.signInWithPassword({
          email,
          password
        });

      if(error) return msg(error.message);

      await finishLogin(data.session);
    }
  });

  $('#google').addEventListener('click',async()=>{
    if(!sb)
      return msg('Configure a chave publicável do Supabase no config.js.');

    const {error} =
      await sb.auth.signInWithOAuth({
        provider:'google',
        options:{
          redirectTo:location.origin+location.pathname
        }
      });

    if(error) msg(error.message);
  });

  $('#forgot').addEventListener('click',async()=>{
    if(!sb) return msg('Configure o Supabase primeiro.');

    const email = prompt(
      'Digite seu e-mail para receber o link de recuperação:'
    );

    if(!email) return;

    const {error} =
      await sb.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:location.origin+location.pathname
        }
      );

    msg(
      error
        ? error.message
        : 'Se o e-mail existir, enviaremos as instruções de recuperação.',
      'success'
    );
  });

  $('#logout').addEventListener('click',async()=>{
    await sb?.auth.signOut();

    S.user = null;
    S.business = null;
    S.membership = null;

    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
  });

  async function finishLogin(session){
    if(!session) return;
    await loadContext();
  }

  async function loadContext(){
    const {data:{user}} = await sb.auth.getUser();

    if(!user) return;

    S.user = user;

    const {
      data:mem,
      error:me
    } = await sb
      .from('memberships')
      .select('*')
      .eq('user_id',user.id)
      .limit(1)
      .maybeSingle();

    if(me){
      console.error(me);
      return msg(
        'Não foi possível carregar sua conta: '+me.message
      );
    }

    if(!mem) return onboarding();

    S.membership = mem;
    S.role = mem.role;

    const [p,b] = await Promise.all([
      sb
        .from('profiles')
        .select('*')
        .eq('id',user.id)
        .maybeSingle(),

      sb
        .from('businesses')
        .select('*')
        .eq('id',mem.business_id)
        .maybeSingle()
    ]);

    if
