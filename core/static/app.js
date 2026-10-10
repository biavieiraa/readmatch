// ============================================================
// READMATCH — JavaScript completo
// Mantém os IDs e nomes de funções usados no código original.
// Observação: localStorage é adequado para protótipo local, não
// para autenticação segura ou armazenamento multiusuário real.
// ============================================================

// --- CONFIGURAÇÃO E DADOS ---
const CAPA_PADRAO = 'https://placehold.co/150x225/fce7f3/c94672?text=Sem+Capa';
const CHAVE_USUARIOS = 'readmatch_usuarios_cadastrados';
const CHAVE_USUARIO_ATUAL = 'readmatch_usuario_atual';
const CHAVE_META = 'readmatch_meta';

let usuarioAtual = JSON.parse(localStorage.getItem(CHAVE_USUARIO_ATUAL)) || null;
let filtroAtual = 'todos';
let resultadosBuscaAPI = [];
let recomendacoesQuizAtuais = [];
let etapaAtual = 1;
let respostas = { vibe: '', tempo: '', genero: '' };

// Evita repetir chamadas às APIs durante a mesma sessão.
const cacheRecomendacoes = new Map();
let googleBooksBloqueadoAte = 0;

function getChaveStorage() {
  return usuarioAtual ? `readmatch_livros_${usuarioAtual.email}` : 'readmatch_livros_visitante';
}

function carregarBiblioteca() {
  try {
    return JSON.parse(localStorage.getItem(getChaveStorage())) || [];
  } catch (erro) {
    console.error('Não foi possível carregar a biblioteca:', erro);
    return [];
  }
}

let biblioteca = carregarBiblioteca();
let metaLeitura = Number(localStorage.getItem(CHAVE_META)) || 12;

function salvarStorage() {
  localStorage.setItem(getChaveStorage(), JSON.stringify(biblioteca));
}

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caractere]);
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tituloJaExiste(titulo) {
  return biblioteca.some(livro => normalizar(livro.titulo) === normalizar(titulo));
}

// --- LOGIN, CADASTRO E RECUPERAÇÃO ---
function abrirModalLogin() {
  document.getElementById('modal-login')?.classList.remove('hidden');
}

function fecharModalLogin() {
  document.getElementById('modal-login')?.classList.add('hidden');
}

function autenticarUsuario(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('login-email')?.value.trim().toLowerCase();
  const senha = document.getElementById('login-senha')?.value.trim();
  const campoNome = document.getElementById('login-nome')?.value.trim();

  if (!email || !senha) {
    alert('Por favor, preencha e-mail e senha.');
    return;
  }

  if (!email.includes('@')) {
    alert('Digite um e-mail válido.');
    return;
  }

  const usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
  const user = usuarios.find(u => u.email === email);

  if (!user) {
    const nome = campoNome || email.split('@')[0];
    const novoUsuario = { nome, email, senha };

    usuarios.push(novoUsuario);
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));

    usuarioAtual = { nome, email };
  } else {
    if (user.senha !== senha) {
      alert('Senha incorreta!');
      return;
    }

    usuarioAtual = { nome: user.nome, email: user.email };
  }

  localStorage.setItem(CHAVE_USUARIO_ATUAL, JSON.stringify(usuarioAtual));

  biblioteca = carregarBiblioteca();
  atualizarHeaderUsuario();
  renderizarEstante();
  fecharModalLogin();
}

function esqueciSenha() {
  const emailInput = document.getElementById('login-email')?.value.trim().toLowerCase();
  const email = prompt('Digite o e-mail cadastrado para redefinir a senha:', emailInput || '');

  if (!email) return;

  const usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
  const index = usuarios.findIndex(u => u.email === email.trim().toLowerCase());

  if (index === -1) {
    alert('Nenhum usuário cadastrado com este e-mail.');
    return;
  }

  // Protótipo local: em um produto real, a redefinição deve ocorrer por e-mail.
  const novaSenha = prompt(`Usuário "${usuarios[index].nome}" encontrado!\nDigite sua nova senha:`);

  if (!novaSenha || !novaSenha.trim()) return;

  usuarios[index].senha = novaSenha.trim();
  localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));

  alert('Senha alterada neste navegador. Agora você já pode entrar com a nova senha.');
}

function fazerLogout() {
  localStorage.removeItem(CHAVE_USUARIO_ATUAL);
  usuarioAtual = null;
  biblioteca = carregarBiblioteca();

  atualizarHeaderUsuario();
  renderizarEstante();
  abrirModalLogin();
}

function atualizarHeaderUsuario() {
  const elUser = document.getElementById('info-usuario-header');

  if (!elUser) return;

  if (usuarioAtual) {
    elUser.innerHTML = `
      <div class="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl">
        <span class="text-xs font-semibold text-stone-700">Olá, <b>${escaparHTML(usuarioAtual.nome)}</b></span>
        <button type="button" onclick="fazerLogout()" class="text-[10px] text-red-500 font-bold hover:underline cursor-pointer">Sair</button>
      </div>`;
  } else {
    elUser.innerHTML = `
      <button type="button" onclick="abrirModalLogin()" class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm">Entrar / Cadastrar</button>`;
  }
}

// --- META DE LEITURA ---
function atualizarMeta() {
  const lidos = biblioteca.filter(l => l.status === 'lido').length;
  const porcentagem = metaLeitura > 0
    ? Math.min(Math.round((lidos / metaLeitura) * 100), 100)
    : 0;

  const elProgresso = document.getElementById('meta-progresso');
  const elPorcentagem = document.getElementById('meta-porcentagem');
  const elBarra = document.getElementById('meta-barra');
  const elMensagem = document.getElementById('meta-mensagem');

  if (elProgresso) elProgresso.innerText = `${lidos} de ${metaLeitura} livros`;
  if (elPorcentagem) elPorcentagem.innerText = `${porcentagem}% concluído`;
  if (elBarra) elBarra.style.width = `${porcentagem}%`;

  if (elMensagem) {
    elMensagem.innerText = lidos >= metaLeitura
      ? 'Parabéns! Você alcançou sua meta do ano.'
      : `Faltam ${metaLeitura - lidos} livro${metaLeitura - lidos === 1 ? '' : 's'} para atingir seu objetivo.`;
  }
}

function alterarMeta() {
  const novaMeta = prompt('Qual é a sua nova meta de leitura para este ano?', metaLeitura);

  if (novaMeta === null || novaMeta.trim() === '') return;

  const valor = Number(novaMeta);

  if (Number.isFinite(valor) && valor > 0) {
    metaLeitura = Math.floor(valor);
    localStorage.setItem(CHAVE_META, String(metaLeitura));
    atualizarMeta();
  } else {
    alert('Digite um número maior que zero.');
  }
}

// --- ESTANTE E FILTROS ---
function filtrarEstante(status) {
  filtroAtual = status;

  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.className = 'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer text-stone-600 hover:bg-stone-100';
  });

  const btnAtivo = document.getElementById(`btn-filtro-${status}`);

  if (btnAtivo) {
    btnAtivo.className = 'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer bg-blush-500 text-white font-semibold';
  }

  renderizarEstante();
}

function renderizarEstante() {
  const container = document.getElementById('grid-livros');
  const contador = document.getElementById('contador-livros');

  if (!container) return;

  if (contador) contador.innerText = biblioteca.length;

  atualizarMeta();

  let livrosExibidos = biblioteca;

  if (filtroAtual === 'favoritos') {
    livrosExibidos = biblioteca.filter(l => l.favorito);
  } else if (filtroAtual !== 'todos') {
    livrosExibidos = biblioteca.filter(l => l.status === filtroAtual);
  }

  if (livrosExibidos.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center space-y-2">
        <span class="text-3xl">📚</span>
        <p class="text-xs text-cozy-muted font-medium">Sua estante está vazia nesta categoria.</p>
        <button type="button" onclick="abrirModalCadastro()" class="text-xs text-blush-600 font-bold hover:underline cursor-pointer">Adicionar o primeiro livro</button>
      </div>`;
    return;
  }

  const badgeStatus = {
    quero_ler: '<span class="bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Quero Ler</span>',
    lendo: '<span class="bg-pink-50 text-blush-600 border border-blush-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Lendo</span>',
    lido: '<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Lido</span>',
    abandonado: '<span class="bg-stone-100 text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Abandonado</span>'
  };

  container.innerHTML = livrosExibidos.map(livro => {
    const pagAtual = Number(livro.paginaAtual) || 0;
    const totalPag = Math.max(1, Number(livro.paginas) || 1);
    const porcentagem = Math.min(100, Math.round((pagAtual / totalPag) * 100));
    const idSeguro = escaparHTML(livro.id);

    return `
      <div onclick="abrirDetalhes('${idSeguro}')" class="bg-white p-2.5 rounded-xl border border-blush-100 shadow-sm hover:shadow transition relative group cursor-pointer flex flex-col justify-between">
        <button type="button" onclick="deletarLivro(event, '${idSeguro}')" title="Excluir" class="absolute top-2 right-2 bg-stone-900/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition z-10 flex items-center justify-center">✕</button>
        <div>
          <div class="aspect-[2/3] w-full bg-stone-100 rounded-lg overflow-hidden mb-2.5 relative">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}" alt="${escaparHTML(livro.titulo)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${CAPA_PADRAO}';">
            ${livro.favorito ? '<span class="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-white/90 text-blush-600 px-1.5 py-0.5 rounded border border-blush-100 shadow-sm">Favorito</span>' : ''}
          </div>
          <div class="mb-1 flex items-center justify-between">${badgeStatus[livro.status] || ''}${Number(livro.nota) > 0 ? `<span class="text-[11px] font-bold text-amber-600">${Number(livro.nota)}/5</span>` : ''}</div>
          <h4 class="font-serif font-bold text-xs text-stone-800 line-clamp-1 mt-1">${escaparHTML(livro.titulo)}</h4>
          <p class="text-[11px] text-cozy-muted truncate">${escaparHTML(livro.autor)}</p>
          ${livro.status === 'lendo' ? `
            <div class="mt-2.5 pt-2 border-t border-stone-100 space-y-1">
              <div class="flex justify-between text-[10px] font-medium text-cozy-muted"><span>Pág. ${pagAtual} / ${totalPag}</span><span class="font-bold text-blush-600">${porcentagem}%</span></div>
              <div class="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden"><div class="bg-blush-500 h-full rounded-full transition-all" style="width:${porcentagem}%"></div></div>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// --- BUSCA E CADASTRO DE LIVROS ---
function abrirModalCadastro() {
  document.getElementById('modal-cadastro')?.classList.remove('hidden');
}

function fecharModalCadastro() {
  document.getElementById('modal-cadastro')?.classList.add('hidden');

  const container = document.getElementById('container-resultados');
  if (container) {
    container.innerHTML = '<p class="text-xs text-cozy-muted text-center py-8">Digite o nome de um livro acima para pesquisar.</p>';
  }

  const input = document.getElementById('input-busca-api');
  if (input) input.value = '';
}

function normalizarLivroAPI(item) {
  const info = item.volumeInfo || {};

  let capa = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || CAPA_PADRAO;

  if (capa.startsWith('http:')) {
    capa = capa.replace('http:', 'https:');
  }

  return {
    titulo: info.title || 'Sem título',
    autor: Array.isArray(info.authors) ? info.authors.join(', ') : 'Autor desconhecido',
    paginas: Number(info.pageCount) > 0 ? Number(info.pageCount) : null,
    genero: Array.isArray(info.categories) && info.categories.length
      ? info.categories[0].split('/')[0].trim()
      : '',
    capa,
    descricao: info.description || '',
    tags: []
  };
}

async function buscarLivrosAPI(e) {
  if (e) e.preventDefault();

  const input = document.getElementById('input-busca-api');
  const query = input ? input.value.trim() : '';
  const container = document.getElementById('container-resultados');
  const btn = document.getElementById('btn-buscar-api');

  if (!query) {
    return alert('Digite o nome de um livro ou autor para buscar.');
  }

  if (btn) {
    btn.innerText = 'Buscando...';
    btn.disabled = true;
  }

  if (container) {
    container.innerHTML = '<p class="text-xs text-cozy-muted text-center py-8 animate-pulse">Pesquisando nas bibliotecas...</p>';
  }

  resultadosBuscaAPI = [];

  try {
    // Limita a quantidade de resultados para reduzir o uso da API.
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`;
    const resposta = await fetch(url);

    if (resposta.status === 429) {
      console.warn('Google Books limitou as chamadas. Tentando Open Library.');
      googleBooksBloqueadoAte = Date.now() + 5 * 60 * 1000;
    } else if (resposta.ok) {
      const dados = await resposta.json();
      resultadosBuscaAPI = (dados.items || []).map(normalizarLivroAPI);
    }
  } catch (erro) {
    console.warn('Google Books indisponível:', erro);
  }

  // Se o Google Books falhar ou não encontrar resultados, usa a Open Library.
  if (resultadosBuscaAPI.length === 0) {
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`;
      const resposta = await fetch(url);

      if (resposta.ok) {
        const dados = await resposta.json();

        resultadosBuscaAPI = (dados.docs || []).map(doc => ({
          titulo: doc.title || 'Sem título',
          autor: doc.author_name?.join(', ') || 'Autor desconhecido',
          paginas: Number(doc.number_of_pages_median) > 0
            ? Number(doc.number_of_pages_median)
            : null,
          genero: doc.subject?.[0] || '',
          capa: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : CAPA_PADRAO,
          descricao: '',
          tags: Array.isArray(doc.subject)
            ? doc.subject.slice(0, 8).map(normalizar)
            : []
        }));
      }
    } catch (erro) {
      console.error('Erro na Open Library:', erro);
    }
  }

  if (container) {
    if (!resultadosBuscaAPI.length) {
      container.innerHTML = `
        <div class="text-center py-8 space-y-1">
          <p class="text-xs text-stone-600 font-bold">Nenhum livro encontrado para "${escaparHTML(query)}".</p>
          <p class="text-[11px] text-stone-400">Tente buscar apenas o nome principal do livro ou autor.</p>
        </div>`;
    } else {
      container.innerHTML = resultadosBuscaAPI.map((item, index) => `
        <div class="flex items-center gap-3 p-2 bg-stone-50 hover:bg-blush-50/50 rounded-xl border border-stone-200 transition">
          <img src="${escaparHTML(item.capa)}" class="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0" onerror="this.onerror=null; this.src='${CAPA_PADRAO}';">
          <div class="flex-1 min-w-0">
            <h5 class="font-serif font-bold text-xs text-stone-800 truncate">${escaparHTML(item.titulo)}</h5>
            <p class="text-[11px] text-cozy-muted truncate">${escaparHTML(item.autor)}</p>
            <span class="text-[10px] bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-600 mt-1 inline-block">
              ${item.paginas ? `${item.paginas} págs` : 'Páginas não informadas'} • ${escaparHTML(item.genero || 'Gênero não informado')}
            </span>
          </div>
          <button type="button" onclick="selecionarLivroAPI(${index})" class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer">Adicionar</button>
        </div>`).join('');
    }
  }

  if (btn) {
    btn.innerText = 'Buscar';
    btn.disabled = false;
  }
}

function selecionarLivroAPI(index) {
  const dados = resultadosBuscaAPI[index];

  if (!dados) return;

  if (tituloJaExiste(dados.titulo)) {
    alert('Esse livro já está na sua estante.');
    return;
  }

  const novoLivro = {
    id: (Date.now() + Math.random()).toString(),
    ...dados,
    paginas: Number(dados.paginas) > 0 ? Number(dados.paginas) : null,
    paginaAtual: 0,
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: Array.isArray(dados.tags) ? dados.tags : [],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    dataInicio: null,
    dataFim: null
  };

  biblioteca.unshift(novoLivro);
  salvarStorage();
  renderizarEstante();
  fecharModalCadastro();
}

// --- DETALHES, PROGRESSO E AVALIAÇÃO ---
function abrirDetalhes(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));

  if (!livro) return;

  const container = document.getElementById('detalhes-container');

  document.getElementById('modal-detalhes')?.classList.remove('hidden');

  if (!container) return;

  const paginas = Number(livro.paginas) || 0;
  const pagAtual = Number(livro.paginaAtual) || 0;

  const porcentagem = paginas > 0
    ? Math.min(100, Math.round((pagAtual / paginas) * 100))
    : 0;

  const experiencia = livro.experiencia || {
    emocionei: 0,
    presa: 0,
    pensei: 0
  };

  const tagsTexto = Array.isArray(livro.tags) ? livro.tags.join(', ') : '';

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-4 mb-4">
      <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}" class="w-28 h-40 object-cover rounded-xl shadow-md mx-auto sm:mx-0 flex-shrink-0" onerror="this.onerror=null; this.src='${CAPA_PADRAO}';">

      <div class="space-y-2 text-center sm:text-left flex-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase tracking-wider text-blush-500 bg-blush-50 px-2 py-0.5 rounded">${escaparHTML(livro.genero || 'Gênero não informado')}</span>

          <button type="button" onclick="toggleFavorito('${escaparHTML(livro.id)}')" class="text-xs font-semibold cursor-pointer border px-2.5 py-1 rounded-lg transition ${livro.favorito ? 'bg-blush-50 text-blush-600 border-blush-200' : 'bg-stone-50 text-stone-600 border-stone-200'}">
            ${livro.favorito ? 'Favoritado ♥' : '♡ Favoritar'}
          </button>
        </div>

        <h3 class="font-serif text-lg font-bold text-stone-800">${escaparHTML(livro.titulo)}</h3>

        <p class="text-xs text-cozy-muted">
          ${escaparHTML(livro.autor)} • ${paginas ? `${paginas} páginas` : 'Número de páginas não informado'}
        </p>

        ${livro.descricao ? `<p class="text-xs text-stone-600 text-left">${escaparHTML(livro.descricao.slice(0, 500))}</p>` : ''}

        <label class="block text-xs font-semibold text-stone-700 mb-1" for="detalhes-status">Status:</label>

        <select id="detalhes-status" onchange="atualizarStatus('${escaparHTML(livro.id)}', this.value)" class="bg-stone-50 border border-stone-200 rounded-lg p-1.5 text-xs w-full sm:w-auto font-medium focus:outline-none">
          <option value="quero_ler" ${livro.status === 'quero_ler' ? 'selected' : ''}>Quero Ler</option>
          <option value="lendo" ${livro.status === 'lendo' ? 'selected' : ''}>Lendo</option>
          <option value="lido" ${livro.status === 'lido' ? 'selected' : ''}>Lido</option>
          <option value="abandonado" ${livro.status === 'abandonado' ? 'selected' : ''}>Abandonado</option>
        </select>
      </div>
    </div>

    <div id="bloco-progresso" class="bg-blush-50/60 p-3.5 rounded-xl border border-blush-100 space-y-2 ${livro.status === 'lendo' ? '' : 'hidden'}">
      <div class="flex justify-between items-center text-xs font-semibold text-stone-800">
        <span>Progresso de leitura</span>
        <span id="label-porcentagem" class="text-blush-600 font-bold">${porcentagem}%</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs text-cozy-muted">Página</span>
        <input type="number" id="input-pagina-atual" value="${pagAtual}" min="0" ${paginas ? `max="${paginas}"` : ''} oninput="alterarPaginaAoVivo('${escaparHTML(livro.id)}', this.value)" class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-20 font-bold text-stone-800 text-center focus:outline-none focus:border-blush-400">
        <span class="text-xs text-cozy-muted">de ${paginas || '?'}</span>
      </div>
    </div>

    <div class="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3 mt-3">
      <h4 class="font-serif font-bold text-xs text-stone-800">Minha experiência</h4>

      <label class="block text-xs font-semibold text-stone-700">Nota geral</label>
      <select id="exp-nota" class="bg-white border border-stone-200 rounded-lg p-1 text-xs font-bold text-stone-800">
        <option value="0" ${Number(livro.nota) === 0 ? 'selected' : ''}>Sem nota</option>
        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(livro.nota) === n ? 'selected' : ''}>${n} / 5</option>`).join('')}
      </select>

      <label class="block text-xs font-semibold text-stone-700">Quanto me emocionei? (0–5)</label>
      <input id="exp-emocionei" type="number" min="0" max="5" value="${Number(experiencia.emocionei) || 0}" class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold text-stone-700">Quanto fiquei presa à história? (0–5)</label>
      <input id="exp-presa" type="number" min="0" max="5" value="${Number(experiencia.presa) || 0}" class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold text-stone-700">Quanto fiquei pensando nela depois? (0–5)</label>
      <input id="exp-pensei" type="number" min="0" max="5" value="${Number(experiencia.pensei) || 0}" class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold text-stone-700">Tags (separadas por vírgula)</label>
      <input id="exp-tags" value="${escaparHTML(tagsTexto)}" placeholder="romance, emocionante, slow burn" class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-full">

      <button type="button" onclick="salvarExperiencia('${escaparHTML(livro.id)}')" class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer">Salvar avaliação</button>
    </div>`;
}

function alterarPaginaAoVivo(id, valor) {
  const livro = biblioteca.find(l => String(l.id) === String(id));

  if (!livro) return;

  let pagina = Number(valor);

  if (!Number.isFinite(pagina) || pagina < 0) pagina = 0;

  if (Number(livro.paginas) > 0) {
    pagina = Math.min(pagina, Number(livro.paginas));
  }

  livro.paginaAtual = Math.floor(pagina);

  const pct = Number(livro.paginas) > 0
    ? Math.min(100, Math.round((pagina / Number(livro.paginas)) * 100))
    : 0;

  const label = document.getElementById('label-porcentagem');

  if (label) label.innerText = `${pct}%`;

  salvarStorage();
  renderizarEstante();
}

function fecharModalDetalhes() {
  document.getElementById('modal-detalhes')?.classList.add('hidden');
}

function toggleFavorito(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));

  if (!livro) return;

  livro.favorito = !livro.favorito;

  salvarStorage();
  renderizarEstante();
  abrirDetalhes(id);
}

function atualizarStatus(id, novoStatus) {
  const livro = biblioteca.find(l => String(l.id) === String(id));

  if (!livro) return;

  const statusAnterior = livro.status;
  livro.status = novoStatus;

  if (novoStatus === 'lendo' && !livro.dataInicio) {
    livro.dataInicio = new Date().toISOString();
  }

  if (novoStatus === 'lido') {
    if (Number(livro.paginas) > 0) {
      livro.paginaAtual = Number(livro.paginas);
    }

    livro.dataFim = new Date().toISOString();
  } else if (statusAnterior === 'lido') {
    livro.dataFim = null;
  }

  salvarStorage();
  renderizarEstante();
  abrirDetalhes(id);
}

function salvarExperiencia(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));

  if (!livro) return;

  const obterNota = campo => Math.max(
    0,
    Math.min(5, Number(document.getElementById(campo)?.value) || 0)
  );

  livro.nota = obterNota('exp-nota');

  livro.experiencia = {
    emocionei: obterNota('exp-emocionei'),
    presa: obterNota('exp-presa'),
    pensei: obterNota('exp-pensei')
  };

  const tags = document.getElementById('exp-tags')?.value || '';

  livro.tags = tags
    .split(',')
    .map(tag => normalizar(tag))
    .filter(Boolean);

  salvarStorage();
  renderizarEstante();
  fecharModalDetalhes();
}

function deletarLivro(e, id) {
  if (e) e.stopPropagation();

  if (!confirm('Deseja remover este livro da sua estante?')) return;

  biblioteca = biblioteca.filter(l => String(l.id) !== String(id));

  salvarStorage();
  renderizarEstante();
}

// --- ESCOLHER UM LIVRO ALEATORIAMENTE ---
function escolherPorMim() {
  const naoLidos = biblioteca.filter(l => l.status === 'quero_ler');

  const lista = naoLidos.length
    ? naoLidos
    : biblioteca.filter(l => l.status !== 'lido');

  if (!lista.length) {
    return alert('Sua estante não tem livros disponíveis. Adicione livros ou mude o status de algum título.');
  }

  const sorteado = lista[Math.floor(Math.random() * lista.length)];

  document.getElementById('modal-quiz')?.classList.remove('hidden');

  const container = document.getElementById('quiz-container');

  if (!container) return;

  container.innerHTML = `
    <div class="text-center space-y-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Sorteio literário</span>
      <h3 class="font-serif text-lg font-bold text-stone-800">Sugestão para sua próxima leitura</h3>

      <div class="bg-stone-50 p-3 rounded-xl border border-stone-200 flex flex-col items-center">
        <img src="${escaparHTML(sorteado.capa || CAPA_PADRAO)}" class="w-24 h-36 object-cover rounded-md shadow mb-2" onerror="this.onerror=null; this.src='${CAPA_PADRAO}';">
        <h4 class="font-serif font-bold text-stone-800 text-sm">${escaparHTML(sorteado.titulo)}</h4>
        <p class="text-xs text-cozy-muted">${escaparHTML(sorteado.autor)} • ${sorteado.paginas || '?'} págs.</p>
      </div>

      <button type="button" onclick="fecharQuiz()" class="w-full bg-blush-500 text-white font-semibold py-2 rounded-lg text-xs hover:bg-blush-600 transition cursor-pointer">Escolher este livro</button>
    </div>`;
}

// --- MATCH: CÁLCULO BASEADO EM DADOS, SEM PORCENTAGEM ALEATÓRIA ---
const TAGS_POR_VIBE = {
  leve: ['leve', 'divertido', 'confortavel', 'fofo', 'feel good', 'comedia', 'romance leve'],
  emocionante: ['emocionante', 'triste', 'drama', 'emocao', 'chorar', 'luto', 'familia', 'melancolico'],
  presa: ['envolvente', 'ritmo rapido', 'rapido', 'suspense', 'plot twist', 'viciante', 'mistério', 'misterio'],
  pensar: ['reflexivo', 'filosofico', 'complexo', 'existencial', 'introspectivo'],
  romance: ['romance', 'amor', 'relacionamento', 'slow burn', 'enemies to lovers', 'friends to lovers']
};

function pontuarVibe(livro, vibe) {
  const tags = (livro.tags || []).map(normalizar);
  const genero = normalizar(livro.genero);
  const tituloDescricao = normalizar(`${livro.titulo || ''} ${livro.descricao || ''}`);
  const pistas = TAGS_POR_VIBE[vibe] || [];

  if (!pistas.length) return null;

  const texto = [...tags, genero, tituloDescricao].join(' ');
  const encontrados = pistas.filter(pista => texto.includes(normalizar(pista)));

  // Não presume compatibilidade quando os metadados não têm informação suficiente.
  if (!texto.trim() || (!tags.length && !genero && !livro.descricao)) {
    return null;
  }

  return encontrados.length
    ? Math.min(1, encontrados.length / Math.min(2, pistas.length))
    : 0;
}

function pontuarGenero(livro, generoDesejado) {
  const desejado = normalizar(generoDesejado);
  const genero = normalizar(livro.genero);
  const tags = (livro.tags || []).map(normalizar);

  if (!genero && !tags.length) return null;
  if (!desejado || desejado === 'qualquer') return null;

  if (genero === desejado || genero.includes(desejado) || desejado.includes(genero)) {
    return 1;
  }

  if (tags.some(tag =>
    tag === desejado ||
    tag.includes(desejado) ||
    desejado.includes(tag)
  )) {
    return 1;
  }

  // Categorias amplas podem conter termos mais específicos.
  const grupos = {
    romance: ['romance', 'ficcao romantica', 'romantic'],
    drama: ['drama', 'ficcao', 'literatura'],
    ficcao: ['ficcao', 'fantasia', 'ficcao cientifica', 'distopia'],
    suspense: ['suspense', 'misterio', 'thriller', 'crime']
  };

  const familia = grupos[desejado] || [desejado];

  if (familia.some(t =>
    genero.includes(t) || tags.some(tag => tag.includes(t))
  )) {
    return 0.65;
  }

  return 0;
}

function pontuarTamanho(livro, tempo) {
  const paginas = Number(livro.paginas);

  if (!Number.isFinite(paginas) || paginas <= 0) return null;

  if (tempo === 'curto') {
    if (paginas <= 280) return 1;
    if (paginas <= 320) return 0.5;
    return 0;
  }

  if (tempo === 'medio') {
    if (paginas >= 300 && paginas <= 450) return 1;
    if (paginas >= 260 && paginas < 300) return 0.6;
    if (paginas > 450 && paginas <= 500) return 0.6;
    return 0;
  }

  return null;
}

function extrairCaracteristicasLivro(livro) {
  const tags = Array.isArray(livro.tags) ? livro.tags : [];
  const genero = normalizar(livro.genero || '');
  const descricao = normalizar(livro.descricao || '');
  const titulo = normalizar(livro.titulo || '');

  // Evita palavras muito genéricas que criariam semelhanças artificiais.
  const ignorar = new Set([
    'book',
    'books',
    'fiction',
    'ficcao',
    'literature',
    'literatura',
    'novel',
    'novels',
    'general',
    'geral',
    'unknown',
    'nao informado'
  ]);

  const tagsLimpa = tags
    .map(normalizar)
    .filter(tag => tag && tag.length > 2 && !ignorar.has(tag));

  const palavrasDescricao = descricao
    .split(/[^a-z0-9]+/)
    .filter(p => p.length >= 4 && !ignorar.has(p));

  return {
    genero,
    tags: [...new Set(tagsLimpa)],
    palavras: [...new Set([...tagsLimpa, ...palavrasDescricao])],
    titulo
  };
}

function similaridadeLivros(livroA, livroB) {
  const a = extrairCaracteristicasLivro(livroA);
  const b = extrairCaracteristicasLivro(livroB);

  let soma = 0;
  let peso = 0;

  if (a.genero && b.genero) {
    const ga = a.genero;
    const gb = b.genero;

    let afinidadeGenero = 0;

    if (ga === gb || ga.includes(gb) || gb.includes(ga)) {
      afinidadeGenero = 1;
    } else {
      const grupos = [
        ['romance', 'romantic', 'love', 'relacionamento'],
        ['fantasy', 'fantasia', 'ficcao cientifica', 'science fiction', 'distopia'],
        ['mystery', 'misterio', 'thriller', 'suspense', 'crime'],
        ['drama', 'literary fiction', 'ficcao literaria'],
        ['young adult', 'young adult fiction', 'adolescente']
      ];

      if (grupos.some(grupo =>
        grupo.some(t => ga.includes(t)) &&
        grupo.some(t => gb.includes(t))
      )) {
        afinidadeGenero = 0.6;
      }
    }

    soma += afinidadeGenero * 0.55;
    peso += 0.55;
  }

  const conjuntoA = new Set(a.palavras);
  const conjuntoB = new Set(b.palavras);

  if (conjuntoA.size && conjuntoB.size) {
    let comuns = 0;

    for (const tag of conjuntoA) {
      if (conjuntoB.has(tag)) comuns++;
    }

    const jaccard = comuns / Math.max(
      1,
      conjuntoA.size + conjuntoB.size - comuns
    );

    const cobertura = comuns / Math.max(
      1,
      Math.min(conjuntoA.size, conjuntoB.size)
    );

    const afinidadeTags = Math.max(jaccard, cobertura * 0.7);

    soma += afinidadeTags * 0.45;
    peso += 0.45;
  }

  return peso ? Math.max(0, Math.min(1, soma / peso)) : null;
}

function pontuarPerfil(livro, bibliotecaUsuario) {
  const avaliados = bibliotecaUsuario.filter(item =>
    item.status === 'lido' &&
    Number(item.nota) >= 1 &&
    Number(item.nota) <= 5
  );

  if (!avaliados.length) return null;

  const caracteristicasCandidato = extrairCaracteristicasLivro(livro);

  if (
    !caracteristicasCandidato.genero &&
    !caracteristicasCandidato.tags.length &&
    !caracteristicasCandidato.palavras.length
  ) {
    return null;
  }

  let somaAfinidade = 0;
  let pesoTotal = 0;

  for (const avaliado of avaliados) {
    const nota = Number(avaliado.nota);
    const similaridade = similaridadeLivros(livro, avaliado);

    if (similaridade === null) continue;

    // Notas altas indicam preferências; notas baixas reduzem a afinidade.
    const pesoNota = Math.abs(nota - 3);

    if (pesoNota === 0) continue;

    if (nota > 3) {
      const peso = (nota - 3) * 1.25;

      somaAfinidade += similaridade * peso;
      pesoTotal += peso;
    } else {
      const peso = (3 - nota) * 0.8;

      somaAfinidade -= similaridade * peso;
      pesoTotal += peso;
    }
  }

  // A média das notas de livros do mesmo gênero também influencia.
  const generoCandidato = caracteristicasCandidato.genero;

  if (generoCandidato) {
    const doMesmoGenero = avaliados.filter(item => {
      const g = normalizar(item.genero || '');

      return g && (
        g === generoCandidato ||
        g.includes(generoCandidato) ||
        generoCandidato.includes(g)
      );
    });

    if (doMesmoGenero.length) {
      const media = doMesmoGenero.reduce(
        (total, item) => total + Number(item.nota),
        0
      ) / doMesmoGenero.length;

      const afinidadeGenero = Math.max(
        0,
        Math.min(1, (media - 1) / 4)
      );

      const pesoGenero = 1.5;

      somaAfinidade += (afinidadeGenero - 0.5) * pesoGenero;
      pesoTotal += pesoGenero;
    }
  }

  if (!pesoTotal) return null;

  // A pontuação é um índice de compatibilidade, não uma probabilidade real.
  const saldo = somaAfinidade / pesoTotal;
  const pontuacao = 0.5 + saldo * 0.48;

  return Math.round(
    Math.max(0.05, Math.min(0.98, pontuacao)) * 100
  ) / 100;
}

function calcularMatch(livro, respostasQuiz, livrosUsuario = biblioteca) {
  const perfil = pontuarPerfil(livro, livrosUsuario);

  const criterios = [
    { nome: 'seu histórico de leitura', peso: 50, valor: perfil },
    { nome: 'seu momento', peso: 25, valor: pontuarVibe(livro, respostasQuiz.vibe) },
    { nome: 'gênero escolhido', peso: 15, valor: pontuarGenero(livro, respostasQuiz.genero) },
    { nome: 'tamanho do livro', peso: 10, valor: pontuarTamanho(livro, respostasQuiz.tempo) }
  ];

  const disponiveis = criterios.filter(c =>
    c.valor !== null && Number.isFinite(c.valor)
  );

  if (!disponiveis.length) {
    return {
      porcentagem: null,
      motivos: ['Ainda faltam informações para avaliar este livro.']
    };
  }

  const pesoTotal = disponiveis.reduce((soma, c) => soma + c.peso, 0);

  const pontos = disponiveis.reduce(
    (soma, c) => soma + c.valor * c.peso,
    0
  );

  const motivos = [];

  if (perfil !== null) {
    const avaliados = livrosUsuario.filter(
      item => item.status === 'lido' && Number(item.nota) > 0
    );

    const semelhantes = avaliados
      .map(item => ({
        livro: item,
        similaridade: similaridadeLivros(livro, item)
      }))
      .filter(item => item.similaridade !== null)
      .sort((a, b) => b.similaridade - a.similaridade)[0];

    if (
      semelhantes &&
      semelhantes.similaridade >= 0.15 &&
      Number(semelhantes.livro.nota) >= 4
    ) {
      motivos.push(
        `Tem características em comum com “${semelhantes.livro.titulo}”, que você avaliou com ${semelhantes.livro.nota}/5`
      );
    } else if (perfil >= 0.65) {
      motivos.push('Combina com tendências das suas avaliações anteriores');
    } else if (perfil < 0.4) {
      motivos.push('Tem menos características em comum com os livros que você avaliou melhor');
    }
  }

  for (const criterio of disponiveis) {
    if (criterio.nome === 'seu momento' && criterio.valor >= 0.65) {
      motivos.push('Pode combinar com o tipo de leitura que você procura agora');
    } else if (
      criterio.nome === 'gênero escolhido' &&
      criterio.valor >= 0.65
    ) {
      motivos.push(`Combina com o gênero ${respostasQuiz.genero}`);
    } else if (
      criterio.nome === 'tamanho do livro' &&
      criterio.valor >= 0.65
    ) {
      motivos.push('O número de páginas combina com o tamanho escolhido');
    }
  }

  return {
    porcentagem: Math.round((pontos / pesoTotal) * 100),
    motivos: [...new Set(motivos)]
  };
}

// --- QUIZ MATCH ---
function iniciarQuiz() {
  etapaAtual = 1;
  respostas = { vibe: '', tempo: '', genero: '' };

  document.getElementById('modal-quiz')?.classList.remove('hidden');

  renderizarEtapa();
}

function fecharQuiz() {
  document.getElementById('modal-quiz')?.classList.add('hidden');
}

function renderizarEtapa() {
  const container = document.getElementById('quiz-container');

  if (!container) return;

  if (etapaAtual === 1) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 1 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Que tipo de leitura você procura?</h3>

      <div class="space-y-2">
        <button type="button" onclick="selecionarOpcao('vibe','leve',2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Leve, sem muita carga emocional</span>
        </button>

        <button type="button" onclick="selecionarOpcao('vibe','emocionante',2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Emocionante, quero me envolver com a história</span>
        </button>

        <button type="button" onclick="selecionarOpcao('vibe','presa',2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Uma história que prenda minha atenção</span>
        </button>

        <button type="button" onclick="selecionarOpcao('vibe','pensar',2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Uma história que me faça refletir</span>
        </button>

        <button type="button" onclick="selecionarOpcao('vibe','romance',2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Uma história de amor ou relacionamentos</span>
        </button>
      </div>`;
  } else if (etapaAtual === 2) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 2 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Qual tamanho de livro você prefere?</h3>

      <div class="space-y-2">
        <button type="button" onclick="selecionarOpcao('tempo','curto',3)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">📖 Curto — até 280 páginas</span>
        </button>

        <button type="button" onclick="selecionarOpcao('tempo','medio',3)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">📚 Médio — cerca de 300 a 450 páginas</span>
        </button>

        <button type="button" onclick="selecionarOpcao('tempo','qualquer',3)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Sem preferência de tamanho</span>
        </button>
      </div>`;
  } else if (etapaAtual === 3) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 3 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Qual gênero você quer ler?</h3>

      <div class="grid grid-cols-2 gap-2">
        ${['Romance', 'Drama', 'Ficção', 'Suspense', 'Fantasia', 'Young Adult', 'Não ficção', 'Qualquer'].map(g => `
          <button type="button" onclick="finalizarQuiz('${g}')" class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs text-stone-700 hover:border-blush-400 hover:bg-blush-50/50 transition text-center cursor-pointer">${g}</button>
        `).join('')}
      </div>`;
  }
}

function selecionarOpcao(chave, valor, proximaEtapa) {
  respostas[chave] = valor;
  etapaAtual = proximaEtapa;

  renderizarEtapa();
}

// --- NORMALIZAÇÃO DOS RESULTADOS DO GOOGLE BOOKS ---
function normalizarResultadoGoogle(item) {
  const info = item.volumeInfo || {};

  let capa = info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    CAPA_PADRAO;

  if (capa.startsWith('http:')) {
    capa = capa.replace('http:', 'https:');
  }

  const categorias = Array.isArray(info.categories) ? info.categories : [];

  const tags = categorias
    .flatMap(c => c.split(/[\/,]/))
    .map(normalizar)
    .filter(Boolean);

  return {
    id: `google-${item.id || Math.random()}`,
    titulo: info.title || '',
    autor: info.authors?.join(', ') || 'Autor desconhecido',
    paginas: Number(info.pageCount) > 0 ? Number(info.pageCount) : null,
    genero: categorias[0]?.split('/')[0]?.trim() || '',
    capa,
    descricao: info.description || '',
    tags,
    novidade: true
  };
}

// --- BUSCA EXTERNA DE RECOMENDAÇÕES ---
async function buscarRecomendacoesExternas(genero, livrosUsuario = biblioteca) {
  const termos = {
    Romance: 'romance novel',
    Drama: 'drama fiction novel',
    Ficção: 'fiction novel',
    Suspense: 'mystery thriller novel',
    Fantasia: 'fantasy novel',
    'Young Adult': 'young adult fiction',
    'Não ficção': 'nonfiction books',
    Qualquer: 'popular fiction novel'
  };

  const consultaBase = termos[genero] || 'popular fiction novel';

  const avaliadosBem = livrosUsuario
    .filter(l => l.status === 'lido' && Number(l.nota) >= 4)
    .sort((a, b) => Number(b.nota) - Number(a.nota));

  const generosPreferidos = [
    ...new Set(
      avaliadosBem
        .map(l => String(l.genero || '').trim())
        .filter(Boolean)
    )
  ].slice(0, 2);

  const tagsPreferidas = [
    ...new Set(
      avaliadosBem
        .flatMap(l => Array.isArray(l.tags) ? l.tags : [])
        .map(t => String(t).trim())
        .filter(t => t.length > 2)
    )
  ].slice(0, 3);

  const pistasPerfil = [...generosPreferidos, ...tagsPreferidas].join(' ');
  const consulta = pistasPerfil
    ? `${consultaBase} ${pistasPerfil}`
    : consultaBase;

  const chaveCache = normalizar(`${genero}|${consulta}`);

  // Reutiliza os resultados da mesma pesquisa durante esta sessão.
  if (cacheRecomendacoes.has(chaveCache)) {
    return cacheRecomendacoes.get(chaveCache).map(livro => ({
      ...livro,
      tags: [...(livro.tags || [])]
    }));
  }

  let livros = [];

  // Se o Google Books estiver temporariamente bloqueado por erro 429,
  // pula a chamada e tenta a Open Library.
  if (Date.now() >= googleBooksBloqueadoAte) {
    try {
      const urlGoogle =
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(consulta)}&maxResults=20&orderBy=relevance`;

      const respostaGoogle = await fetch(urlGoogle);

      if (respostaGoogle.status === 429) {
        googleBooksBloqueadoAte = Date.now() + 5 * 60 * 1000;

        console.warn(
          'Google Books limitou as chamadas (429). Usando Open Library temporariamente.'
        );
      } else if (respostaGoogle.ok) {
        const dadosGoogle = await respostaGoogle.json();

        livros = (dadosGoogle.items || [])
          .map(normalizarResultadoGoogle)
          .filter(livro => livro.titulo);
      }
    } catch (erro) {
      console.warn('Google Books indisponível; tentando Open Library:', erro);
    }
  }

  // A Open Library complementa os resultados ou substitui o Google Books.
  if (livros.length < 10) {
    try {
      const urlOpenLibrary =
        `https://openlibrary.org/search.json?q=${encodeURIComponent(consulta)}&limit=30`;

      const respostaOpenLibrary = await fetch(urlOpenLibrary);

      if (respostaOpenLibrary.ok) {
        const dados = await respostaOpenLibrary.json();

        const complementares = (dados.docs || []).map(item => {
          const assuntos = Array.isArray(item.subject) ? item.subject : [];

          return {
            id: `openlibrary-${item.key || item.title}`,
            titulo: item.title || '',
            autor: item.author_name?.join(', ') || 'Autor desconhecido',
            paginas: Number(item.number_of_pages_median) > 0
              ? Number(item.number_of_pages_median)
              : null,
            genero: assuntos[0] || '',
            capa: item.cover_i
              ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
              : CAPA_PADRAO,
            descricao: assuntos.slice(0, 8).join(', '),
            tags: assuntos.map(normalizar),
            novidade: true
          };
        }).filter(livro => livro.titulo);

        livros = [...livros, ...complementares];
      }
    } catch (erro) {
      console.warn('Falha na Open Library:', erro);
    }
  }

  // Remove títulos duplicados entre as duas APIs.
  const vistos = new Set();

  const resultado = livros.filter(livro => {
    const titulo = normalizar(livro.titulo);

    if (!titulo || vistos.has(titulo)) return false;

    vistos.add(titulo);
    return true;
  });

  // Não guarda resultados vazios no cache.
  if (resultado.length) {
    cacheRecomendacoes.set(chaveCache, resultado);
  }

  return resultado;
}

// --- FINALIZAÇÃO DO MATCH ---
async function finalizarQuiz(genero) {
  respostas.genero = genero;

  const container = document.getElementById('quiz-container');

  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-10 space-y-3">
      <div class="w-6 h-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-cozy-muted font-medium">Buscando sugestões...</p>
    </div>`;

  try {
    const externos = await buscarRecomendacoesExternas(genero, biblioteca);

    // Sugere somente livros que ainda não estão na estante.
    const novos = externos.filter(
      livro => livro.titulo && !tituloJaExiste(livro.titulo)
    );

    const candidatos = novos.map(livro => {
      const calculo = calcularMatch(livro, respostas, biblioteca);

      return {
        ...livro,
        match: calculo.porcentagem ?? 50,
        motivos: calculo.porcentagem === null
          ? ['Os dados disponíveis sobre este livro são limitados.']
          : calculo.motivos,
        novidade: true
      };
    });

    candidatos.sort((a, b) => b.match - a.match);

    exibirResultado(candidatos.slice(0, 3));
  } catch (erro) {
    console.error('Erro ao gerar recomendações:', erro);

    exibirResultado([]);
  }
}

// --- ADICIONAR UMA RECOMENDAÇÃO À ESTANTE ---
function adicionarRecomendacaoPorIndice(index) {
  const livro = recomendacoesQuizAtuais[index];

  if (!livro) return;

  if (tituloJaExiste(livro.titulo)) {
    alert('Esse livro já está na sua estante.');
    return;
  }

  const novoLivro = {
    id: (Date.now() + Math.random()).toString(),
    titulo: livro.titulo,
    autor: livro.autor,
    paginas: Number(livro.paginas) > 0 ? Number(livro.paginas) : null,
    paginaAtual: 0,
    genero: livro.genero || '',
    capa: livro.capa || CAPA_PADRAO,
    descricao: livro.descricao || '',
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: Array.isArray(livro.tags) ? livro.tags : [],
    experiencia: {
      emocionei: 0,
      presa: 0,
      pensei: 0
    },
    dataInicio: null,
    dataFim: null
  };

  biblioteca.unshift(novoLivro);

  salvarStorage();
  renderizarEstante();

  alert('Livro adicionado à sua estante!');

  fecharQuiz();
}

// --- EXIBIR RESULTADOS ---
function exibirResultado(livros) {
  const container = document.getElementById('quiz-container');

  if (!container) return;

  recomendacoesQuizAtuais = livros || [];

  if (!recomendacoesQuizAtuais.length) {
    container.innerHTML = `
      <div class="text-center py-6 space-y-3">
        <p class="text-xs text-cozy-muted">
          Não encontrei sugestões suficientes desta vez. Tente novamente mais tarde ou confira sua conexão.
        </p>
        <button type="button" onclick="iniciarQuiz()" class="w-full bg-blush-500 text-white font-semibold py-2 rounded-lg text-xs hover:bg-blush-600 transition cursor-pointer">
          Tentar novamente
        </button>
        <button type="button" onclick="fecharQuiz()" class="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
          Fechar
        </button>
      </div>`;

    return;
  }

  container.innerHTML = `
    <div class="text-center mb-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">ReadMatch</span>
      <h3 class="font-serif text-base font-bold text-stone-800">Livros que combinam com você</h3>
      <p class="text-[11px] text-cozy-muted mt-1">
        A pontuação usa os dados disponíveis; quanto mais você avalia, mais personalizado fica.
      </p>
    </div>

    <div class="space-y-2.5 max-h-96 overflow-y-auto custom-scroll pr-1">
      ${recomendacoesQuizAtuais.map((livro, idx) => `
        <div class="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div class="flex gap-3 items-center">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}" class="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" onerror="this.onerror=null; this.src='${CAPA_PADRAO}';">

            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <h4 class="font-serif font-bold text-stone-800 text-xs">${escaparHTML(livro.titulo)}</h4>
                <span class="bg-blush-100 text-blush-600 font-bold text-[10px] px-2 py-0.5 rounded-full flex-shrink-0">${livro.match}% Match</span>
              </div>

              <p class="text-[11px] text-cozy-muted">${escaparHTML(livro.autor)}</p>

              <span class="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                Livro novo para sua estante
              </span>

              <p class="text-[10px] text-stone-500 mt-1">
                ${livro.paginas ? `${livro.paginas} páginas` : 'Páginas não informadas'} • ${escaparHTML(livro.genero || 'Gênero não informado')}
              </p>
            </div>
          </div>

          ${livro.motivos?.length ? `
            <div class="text-[10px] text-stone-600">
              <strong>Por que apareceu:</strong>
              <ul class="list-disc pl-4 mt-1">
                ${livro.motivos.slice(0, 3).map(m => `<li>${escaparHTML(m)}</li>`).join('')}
              </ul>
            </div>
          ` : '<p class="text-[10px] text-stone-500">Ainda há poucos dados para explicar esta sugestão.</p>'}

          ${livro.novidade ? `
            <button type="button" onclick="adicionarRecomendacaoPorIndice(${idx})" class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-1.5 rounded-lg text-[11px] transition cursor-pointer">
              + Adicionar à estante
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <button type="button" onclick="fecharQuiz()" class="w-full mt-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
      Fechar
    </button>`;
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  atualizarHeaderUsuario();
  filtrarEstante('todos');

  if (!usuarioAtual) {
    abrirModalLogin();
  }
});