
/* ==========================================================
   READMATCH — JavaScript completo
   Recomendações com filtros corrigidos
   ========================================================== */

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
let biblioteca = carregarBiblioteca();
let metaLeitura = Number(localStorage.getItem(CHAVE_META)) || 12;

const cacheRecomendacoes = new Map();
let googleBooksBloqueadoAte = 0;

/* ==========================================================
   ARMAZENAMENTO E UTILITÁRIOS
   ========================================================== */

function getChaveStorage() {
  return usuarioAtual
    ? `readmatch_livros_${usuarioAtual.email}`
    : 'readmatch_livros_visitante';
}

function carregarBiblioteca() {
  try {
    return JSON.parse(localStorage.getItem(getChaveStorage())) || [];
  } catch (erro) {
    console.error('Erro ao carregar biblioteca:', erro);
    return [];
  }
}

function salvarStorage() {
  localStorage.setItem(getChaveStorage(), JSON.stringify(biblioteca));
}

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tituloJaExiste(titulo) {
  return biblioteca.some(l =>
    normalizar(l.titulo) === normalizar(titulo)
  );
}

function limitarTempo(promise, ms = 9000) {
  return Promise.race([
    promise,
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error('Tempo limite excedido')), ms)
    )
  ]);
}

function normalizarLista(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map(normalizar)
    .filter(Boolean);
}

function criarRegistroLivro(dados) {
  return {
    id: (Date.now() + Math.random()).toString(),
    titulo: dados.titulo || 'Sem título',
    autor: dados.autor || 'Autor desconhecido',
    paginas: Number(dados.paginas) > 0 ? Number(dados.paginas) : null,
    paginaAtual: 0,
    genero: dados.genero || '',
    capa: dados.capa || CAPA_PADRAO,
    descricao: dados.descricao || '',
    tags: Array.isArray(dados.tags) ? dados.tags : [],
    vibe: Array.isArray(dados.vibe) ? dados.vibe : [],
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    dataInicio: null,
    dataFim: null
  };
}

/* ==========================================================
   LOGIN E CADASTRO
   ========================================================== */

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
  const nomeDigitado = document.getElementById('login-nome')?.value.trim();

  if (!email || !senha) {
    alert('Por favor, preencha e-mail e senha.');
    return;
  }

  if (!email.includes('@')) {
    alert('Digite um e-mail válido.');
    return;
  }

  let usuarios = [];

  try {
    usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
  } catch {
    usuarios = [];
  }

  const usuario = usuarios.find(u => u.email === email);

  if (!usuario) {
    const nome = nomeDigitado || email.split('@')[0];
    usuarios.push({ nome, email, senha });
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
    usuarioAtual = { nome, email };
  } else {
    if (usuario.senha !== senha) {
      alert('Senha incorreta!');
      return;
    }

    usuarioAtual = { nome: usuario.nome, email: usuario.email };
  }

  localStorage.setItem(CHAVE_USUARIO_ATUAL, JSON.stringify(usuarioAtual));
  biblioteca = carregarBiblioteca();

  atualizarHeaderUsuario();
  renderizarEstante();
  fecharModalLogin();
}

function esqueciSenha() {
  const emailInicial = document.getElementById('login-email')?.value.trim().toLowerCase();
  const email = prompt('Digite o e-mail cadastrado:', emailInicial || '');

  if (!email) return;

  let usuarios = [];

  try {
    usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
  } catch {
    usuarios = [];
  }

  const usuario = usuarios.find(u => u.email === email.trim().toLowerCase());

  if (!usuario) {
    alert('Nenhum usuário cadastrado com este e-mail.');
    return;
  }

  const novaSenha = prompt('Digite sua nova senha:');

  if (!novaSenha || !novaSenha.trim()) return;

  usuario.senha = novaSenha.trim();
  localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
  alert('Senha alterada neste navegador.');
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
  const el = document.getElementById('info-usuario-header');
  if (!el) return;

  if (usuarioAtual) {
    el.innerHTML = `
      <div class="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl">
        <span class="text-xs font-semibold text-stone-700">
          Olá, <b>${escaparHTML(usuarioAtual.nome)}</b>
        </span>
        <button type="button" onclick="fazerLogout()"
          class="text-[10px] text-red-500 font-bold hover:underline cursor-pointer">
          Sair
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <button type="button" onclick="abrirModalLogin()"
        class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer">
        Entrar / Cadastrar
      </button>`;
  }
}

/* ==========================================================
   META DE LEITURA
   ========================================================== */

function atualizarMeta() {
  const lidos = biblioteca.filter(l => l.status === 'lido').length;
  const pct = metaLeitura > 0
    ? Math.min(100, Math.round(lidos / metaLeitura * 100))
    : 0;

  const progresso = document.getElementById('meta-progresso');
  const porcentagem = document.getElementById('meta-porcentagem');
  const barra = document.getElementById('meta-barra');
  const mensagem = document.getElementById('meta-mensagem');

  if (progresso) progresso.innerText = `${lidos} de ${metaLeitura} livros`;
  if (porcentagem) porcentagem.innerText = `${pct}% concluído`;
  if (barra) barra.style.width = `${pct}%`;

  if (mensagem) {
    mensagem.innerText = lidos >= metaLeitura
      ? 'Parabéns! Você alcançou sua meta do ano.'
      : `Faltam ${metaLeitura - lidos} livro${metaLeitura - lidos === 1 ? '' : 's'} para atingir seu objetivo.`;
  }
}

function alterarMeta() {
  const entrada = prompt('Qual é sua nova meta de leitura?', metaLeitura);
  if (entrada === null || !entrada.trim()) return;

  const valor = Number(entrada);

  if (!Number.isFinite(valor) || valor <= 0) {
    alert('Digite um número maior que zero.');
    return;
  }

  metaLeitura = Math.floor(valor);
  localStorage.setItem(CHAVE_META, String(metaLeitura));
  atualizarMeta();
}

/* ==========================================================
   ESTANTE E FILTROS
   ========================================================== */

function filtrarEstante(status) {
  filtroAtual = status;

  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.className = 'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer text-stone-600 hover:bg-stone-100';
  });

  const ativo = document.getElementById(`btn-filtro-${status}`);

  if (ativo) {
    ativo.className = 'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer bg-blush-500 text-white font-semibold';
  }

  renderizarEstante();
}

function renderizarEstante() {
  const container = document.getElementById('grid-livros');
  const contador = document.getElementById('contador-livros');

  if (!container) return;

  if (contador) contador.innerText = biblioteca.length;
  atualizarMeta();

  let livros = biblioteca;

  if (filtroAtual === 'favoritos') {
    livros = biblioteca.filter(l => l.favorito);
  } else if (filtroAtual !== 'todos') {
    livros = biblioteca.filter(l => l.status === filtroAtual);
  }

  if (!livros.length) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center space-y-2">
        <span class="text-3xl">📚</span>
        <p class="text-xs text-cozy-muted">Sua estante está vazia nesta categoria.</p>
        <button type="button" onclick="abrirModalCadastro()"
          class="text-xs text-blush-600 font-bold hover:underline cursor-pointer">
          Adicionar o primeiro livro
        </button>
      </div>`;
    return;
  }

  const statusLabels = {
    quero_ler: 'Quero Ler',
    lendo: 'Lendo',
    lido: 'Lido',
    abandonado: 'Abandonado'
  };

  container.innerHTML = livros.map(livro => {
    const atual = Number(livro.paginaAtual) || 0;
    const total = Number(livro.paginas) || 0;
    const pct = total > 0 ? Math.min(100, Math.round(atual / total * 100)) : 0;
    const id = escaparHTML(livro.id);

    return `
      <div onclick="abrirDetalhes('${id}')"
        class="bg-white p-2.5 rounded-xl border border-blush-100 shadow-sm hover:shadow relative group cursor-pointer flex flex-col justify-between">
        <button type="button" onclick="deletarLivro(event,'${id}')"
          class="absolute top-2 right-2 bg-stone-900/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 z-10">
          ✕
        </button>
        <div>
          <div class="aspect-[2/3] w-full bg-stone-100 rounded-lg overflow-hidden mb-2.5 relative">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
              alt="${escaparHTML(livro.titulo)}"
              class="w-full h-full object-cover"
              onerror="this.onerror=null;this.src='${CAPA_PADRAO}'">
            ${livro.favorito ? '<span class="absolute bottom-1 left-1 bg-white text-blush-600 px-1.5 py-0.5 rounded text-[10px]">♥ Favorito</span>' : ''}
          </div>
          <div class="flex items-center justify-between text-[10px]">
            <span>${escaparHTML(statusLabels[livro.status] || '')}</span>
            ${Number(livro.nota) > 0 ? `<span class="text-amber-600 font-bold">${livro.nota}/5</span>` : ''}
          </div>
          <h4 class="font-serif font-bold text-xs text-stone-800 line-clamp-1 mt-1">${escaparHTML(livro.titulo)}</h4>
          <p class="text-[11px] text-cozy-muted truncate">${escaparHTML(livro.autor)}</p>
          ${livro.status === 'lendo' ? `
            <div class="mt-2 border-t pt-2">
              <div class="flex justify-between text-[10px]">
                <span>Pág. ${atual} / ${total || '?'}</span><span>${pct}%</span>
              </div>
              <div class="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blush-500 h-full" style="width:${pct}%"></div>
              </div>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ==========================================================
   BUSCA E CADASTRO DE LIVROS
   ========================================================== */

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

  if (capa.startsWith('http:')) capa = capa.replace('http:', 'https:');

  const categorias = Array.isArray(info.categories) ? info.categories : [];

  return {
    titulo: info.title || 'Sem título',
    autor: info.authors?.join(', ') || 'Autor desconhecido',
    paginas: Number(info.pageCount) > 0 ? Number(info.pageCount) : null,
    genero: detectarGenero(categorias),
    capa,
    descricao: info.description || '',
    tags: categorias.flatMap(c => c.split(/[\/,]/)).map(normalizar).filter(Boolean)
  };
}

async function buscarLivrosAPI(e) {
  if (e) e.preventDefault();

  const input = document.getElementById('input-busca-api');
  const query = input?.value.trim() || '';
  const container = document.getElementById('container-resultados');
  const btn = document.getElementById('btn-buscar-api');

  if (!query) {
    alert('Digite o nome de um livro ou autor para buscar.');
    return;
  }

  if (btn) {
    btn.innerText = 'Buscando...';
    btn.disabled = true;
  }

  if (container) {
    container.innerHTML = '<p class="text-xs text-cozy-muted text-center py-8">Pesquisando nas bibliotecas...</p>';
  }

  resultadosBuscaAPI = [];

  try {
    if (Date.now() >= googleBooksBloqueadoAte) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`;
      const resposta = await limitarTempo(fetch(url));

      if (resposta.status === 429) {
        googleBooksBloqueadoAte = Date.now() + 5 * 60 * 1000;
      } else if (resposta.ok) {
        const dados = await resposta.json();
        resultadosBuscaAPI = (dados.items || []).map(normalizarLivroAPI);
      }
    }
  } catch (erro) {
    console.warn('Google Books indisponível:', erro);
  }

  if (!resultadosBuscaAPI.length) {
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`;
      const resposta = await limitarTempo(fetch(url));

      if (resposta.ok) {
        const dados = await resposta.json();

        resultadosBuscaAPI = (dados.docs || []).map(doc => {
          const assuntos = Array.isArray(doc.subject) ? doc.subject : [];

          return {
            titulo: doc.title || 'Sem título',
            autor: doc.author_name?.join(', ') || 'Autor desconhecido',
            paginas: Number(doc.number_of_pages_median) || null,
            genero: detectarGenero(assuntos),
            capa: doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : CAPA_PADRAO,
            descricao: '',
            tags: assuntos.slice(0, 12).map(normalizar)
          };
        });
      }
    } catch (erro) {
      console.warn('Open Library indisponível:', erro);
    }
  }

  if (container) {
    if (!resultadosBuscaAPI.length) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-xs text-stone-600 font-bold">Não foi possível encontrar livros.</p>
          <p class="text-[11px] text-stone-400">Tente novamente ou pesquise outro título.</p>
        </div>`;
    } else {
      container.innerHTML = resultadosBuscaAPI.map((livro, i) => `
        <div class="flex items-center gap-3 p-2 bg-stone-50 rounded-xl border">
          <img src="${escaparHTML(livro.capa)}" class="w-10 h-14 object-cover rounded"
            onerror="this.onerror=null;this.src='${CAPA_PADRAO}'">
          <div class="flex-1 min-w-0">
            <h5 class="font-serif font-bold text-xs truncate">${escaparHTML(livro.titulo)}</h5>
            <p class="text-[11px] text-cozy-muted truncate">${escaparHTML(livro.autor)}</p>
            <span class="text-[10px]">${livro.paginas || '?'} páginas • ${escaparHTML(livro.genero || 'Gênero não informado')}</span>
          </div>
          <button type="button" onclick="selecionarLivroAPI(${i})"
            class="bg-blush-500 text-white text-xs px-3 py-1.5 rounded-lg">
            Adicionar
          </button>
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

  biblioteca.unshift(criarRegistroLivro(dados));
  salvarStorage();
  renderizarEstante();
  fecharModalCadastro();
}

/* ==========================================================
   DETALHES, PROGRESSO E AVALIAÇÃO
   ========================================================== */

function abrirDetalhes(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));
  if (!livro) return;

  document.getElementById('modal-detalhes')?.classList.remove('hidden');
  const container = document.getElementById('detalhes-container');
  if (!container) return;

  const paginas = Number(livro.paginas) || 0;
  const atual = Number(livro.paginaAtual) || 0;
  const pct = paginas ? Math.min(100, Math.round(atual / paginas * 100)) : 0;
  const exp = livro.experiencia || { emocionei: 0, presa: 0, pensei: 0 };
  const tags = Array.isArray(livro.tags) ? livro.tags.join(', ') : '';
  const idSeguro = escaparHTML(livro.id);

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-4 mb-4">
      <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
        class="w-28 h-40 object-cover rounded-xl mx-auto sm:mx-0"
        onerror="this.onerror=null;this.src='${CAPA_PADRAO}'">
      <div class="space-y-2 text-center sm:text-left flex-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase text-blush-500">${escaparHTML(livro.genero || 'Gênero não informado')}</span>
          <button type="button" onclick="toggleFavorito('${idSeguro}')"
            class="text-xs border px-2.5 py-1 rounded-lg">
            ${livro.favorito ? 'Favoritado ♥' : '♡ Favoritar'}
          </button>
        </div>
        <h3 class="font-serif text-lg font-bold">${escaparHTML(livro.titulo)}</h3>
        <p class="text-xs text-cozy-muted">${escaparHTML(livro.autor)} • ${paginas || '?'} páginas</p>
        ${livro.descricao ? `<p class="text-xs text-stone-600 text-left">${escaparHTML(livro.descricao.slice(0, 500))}</p>` : ''}
        <label class="block text-xs font-semibold" for="detalhes-status">Status:</label>
        <select id="detalhes-status" onchange="atualizarStatus('${idSeguro}',this.value)"
          class="bg-stone-50 border rounded-lg p-1.5 text-xs w-full">
          <option value="quero_ler" ${livro.status === 'quero_ler' ? 'selected' : ''}>Quero Ler</option>
          <option value="lendo" ${livro.status === 'lendo' ? 'selected' : ''}>Lendo</option>
          <option value="lido" ${livro.status === 'lido' ? 'selected' : ''}>Lido</option>
          <option value="abandonado" ${livro.status === 'abandonado' ? 'selected' : ''}>Abandonado</option>
        </select>
      </div>
    </div>

    <div id="bloco-progresso" class="bg-blush-50 p-3.5 rounded-xl space-y-2 ${livro.status === 'lendo' ? '' : 'hidden'}">
      <div class="flex justify-between text-xs font-semibold">
        <span>Progresso de leitura</span><span id="label-porcentagem">${pct}%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs">Página</span>
        <input type="number" id="input-pagina-atual" value="${atual}" min="0"
          ${paginas ? `max="${paginas}"` : ''}
          oninput="alterarPaginaAoVivo('${idSeguro}',this.value)"
          class="border rounded-lg p-1.5 text-xs w-20 text-center">
        <span class="text-xs">de ${paginas || '?'}</span>
      </div>
    </div>

    <div class="bg-stone-50 p-4 rounded-xl border space-y-3 mt-3">
      <h4 class="font-serif font-bold text-xs">Minha experiência</h4>
      <label class="block text-xs font-semibold">Nota geral</label>
      <select id="exp-nota" class="bg-white border rounded-lg p-1 text-xs">
        ${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(livro.nota) === n ? 'selected' : ''}>${n === 0 ? 'Sem nota' : `${n}/5`}</option>`).join('')}
      </select>

      <label class="block text-xs font-semibold">Quanto me emocionei? (0–5)</label>
      <input id="exp-emocionei" type="number" min="0" max="5" value="${Number(exp.emocionei) || 0}" class="border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Quanto fiquei presa à história? (0–5)</label>
      <input id="exp-presa" type="number" min="0" max="5" value="${Number(exp.presa) || 0}" class="border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Quanto fiquei pensando nela depois? (0–5)</label>
      <input id="exp-pensei" type="number" min="0" max="5" value="${Number(exp.pensei) || 0}" class="border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Tags separadas por vírgula</label>
      <input id="exp-tags" value="${escaparHTML(tags)}" placeholder="romance, emocionante, slow burn" class="border rounded-lg p-1.5 text-xs w-full">

      <button type="button" onclick="salvarExperiencia('${idSeguro}')"
        class="w-full bg-blush-500 text-white py-2 rounded-lg text-xs">
        Salvar avaliação
      </button>
    </div>`;
}

function alterarPaginaAoVivo(id, valor) {
  const livro = biblioteca.find(l => String(l.id) === String(id));
  if (!livro) return;

  let pagina = Number(valor);
  if (!Number.isFinite(pagina) || pagina < 0) pagina = 0;
  if (Number(livro.paginas) > 0) pagina = Math.min(pagina, Number(livro.paginas));

  livro.paginaAtual = Math.floor(pagina);

  const pct = Number(livro.paginas)
    ? Math.min(100, Math.round(pagina / Number(livro.paginas) * 100))
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

  const anterior = livro.status;
  livro.status = novoStatus;

  if (novoStatus === 'lendo' && !livro.dataInicio) {
    livro.dataInicio = new Date().toISOString();
  }

  if (novoStatus === 'lido') {
    if (Number(livro.paginas) > 0) livro.paginaAtual = Number(livro.paginas);
    livro.dataFim = new Date().toISOString();
  } else if (anterior === 'lido') {
    livro.dataFim = null;
  }

  salvarStorage();
  renderizarEstante();
  abrirDetalhes(id);
}

function salvarExperiencia(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));
  if (!livro) return;

  const nota = campo => Math.max(
    0,
    Math.min(5, Number(document.getElementById(campo)?.value) || 0)
  );

  livro.nota = nota('exp-nota');
  livro.experiencia = {
    emocionei: nota('exp-emocionei'),
    presa: nota('exp-presa'),
    pensei: nota('exp-pensei')
  };

  livro.tags = (document.getElementById('exp-tags')?.value || '')
    .split(',')
    .map(normalizar)
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

/* ==========================================================
   SORTEIO DE LIVRO
   ========================================================== */

function escolherPorMim() {
  const naoLidos = biblioteca.filter(l => l.status === 'quero_ler');
  const lista = naoLidos.length
    ? naoLidos
    : biblioteca.filter(l => l.status !== 'lido');

  if (!lista.length) {
    alert('Sua estante não tem livros disponíveis. Adicione um livro ou mude o status de algum título.');
    return;
  }

  const livro = lista[Math.floor(Math.random() * lista.length)];
  document.getElementById('modal-quiz')?.classList.remove('hidden');

  const container = document.getElementById('quiz-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center space-y-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase">Sorteio literário</span>
      <h3 class="font-serif text-lg font-bold">Sugestão para sua próxima leitura</h3>
      <div class="bg-stone-50 p-3 rounded-xl border flex flex-col items-center">
        <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}" class="w-24 h-36 object-cover rounded-md mb-2"
          onerror="this.onerror=null;this.src='${CAPA_PADRAO}'">
        <h4 class="font-serif font-bold text-sm">${escaparHTML(livro.titulo)}</h4>
        <p class="text-xs text-cozy-muted">${escaparHTML(livro.autor)} • ${livro.paginas || '?'} páginas</p>
      </div>
      <button type="button" onclick="fecharQuiz()" class="w-full bg-blush-500 text-white py-2 rounded-lg text-xs">
        Escolher este livro
      </button>
    </div>`;
}

/* ==========================================================
   LÓGICA DE COMPATIBILIDADE
   ========================================================== */

function pontuarVibe(livro, vibe) {
  if (!vibe) return null;

  const vibeEscolhida = normalizar(vibe);

  // Os livros locais possuem vibes cadastradas explicitamente.
  const vibesCadastradas = normalizarLista(livro.vibe);
  if (vibesCadastradas.includes(vibeEscolhida)) return 1;

  const titulo = normalizar(livro.titulo);
  const descricao = normalizar(livro.descricao);
  const tags = normalizarLista(livro.tags);
  const genero = normalizar(livro.genero);
  const texto = `${titulo} ${descricao} ${tags.join(' ')}`;

  const pistas = {
    leve: [
      'leve', 'divertido', 'fofo', 'comedia romantica',
      'romance leve', 'bem humorado', 'feel good',
      'heartwarming', 'humor', 'lighthearted'
    ],
    emocionante: [
      'emocionante', 'emocao', 'chorar', 'luto',
      'familia', 'melancolico', 'heartbreak', 'grief',
      'drama', 'perda', 'superacao', 'moving'
    ],
    presa: [
      'envolvente', 'ritmo rapido', 'suspense', 'plot twist',
      'viciante', 'misterio', 'page turner', 'thriller',
      'intriga', 'investigacao', 'segredo', 'perigo'
    ],
    pensar: [
      'reflexivo', 'filosofico', 'complexo', 'existencial',
      'introspectivo', 'reflexao', 'thought provoking',
      'escolhas', 'arrependimentos'
    ],
    romance: [
      'historia de amor', 'relacionamento amoroso',
      'relacao amorosa', 'love story', 'romantic relationship',
      'falls in love', 'fall in love', 'love interest',
      'enemies to lovers', 'friends to lovers', 'slow burn',
      'second chance romance', 'first love', 'romantic',
      'namoro', 'apaixon', 'casal', 'paixao', 'relacionamento'
    ]
  };

  const termos = pistas[vibeEscolhida] || [];
  if (!termos.length) return null;

  const descricaoTemPista = termos.some(t => descricao.includes(t));
  const tagsTemPista = termos.some(t => tags.some(tag => tag.includes(t)));
  const tituloTemPista = termos.some(t => titulo.includes(t));

  if (descricaoTemPista) return 1;
  if (tagsTemPista) return 0.9;
  if (tituloTemPista) return 0.65;

  /*
    Para romance, gênero e assunto podem servir como indício
    complementar quando a API não fornece uma descrição.
    Ficção genérica, sozinha, nunca confirma romance.
  */
  if (vibeEscolhida === 'romance') {
    const termosRomanticos = [
      'romance', 'romantic fiction', 'love stories',
      'historia de amor', 'relacionamento amoroso'
    ];

    const assuntoRomantico = [genero, ...tags].some(item =>
      termosRomanticos.some(t => item === t || item.includes(t))
    );

    if (assuntoRomantico) return 0.7;
  }

  return 0;
}

function pontuarGenero(livro, desejado) {
  const pedido = normalizar(desejado);

  if (!pedido || pedido === 'qualquer') return null;

  const genero = normalizar(livro.genero);
  const tags = normalizarLista(livro.tags);
  const assuntos = [genero, ...tags].filter(Boolean);

  if (!assuntos.length) return 0;

  const grupos = {
    romance: [
      'romance', 'romantic fiction', 'romantic novels',
      'love stories', 'historias de amor'
    ],
    drama: [
      'drama', 'domestic fiction', 'family saga',
      'literary drama'
    ],
    ficcao: [
      'fiction', 'ficcao', 'literary fiction',
      'contemporary fiction', 'speculative fiction'
    ],
    suspense: [
      'mystery', 'misterio', 'thriller', 'suspense',
      'crime', 'detective', 'policial'
    ],
    fantasia: [
      'fantasy', 'fantasia', 'magic', 'magia',
      'high fantasy', 'urban fantasy'
    ],
    'young adult': [
      'young adult', 'ya fiction', 'adolescent',
      'juvenile fiction', 'teen fiction'
    ],
    'nao ficcao': [
      'nonfiction', 'non-fiction', 'biography',
      'autobiography', 'self-help', 'history'
    ]
  };

  const familia = grupos[pedido] || [pedido];

  // Correspondência exata é mais confiável.
  if (assuntos.some(t => t === pedido)) return 1;
  if (assuntos.some(t => familia.some(f => t === f))) return 1;

  // Aceita categorias mais detalhadas, como "Fiction / Romance".
  if (assuntos.some(t => familia.some(f =>
    t.includes(f) && f.length >= 5
  ))) return 0.85;

  // Não confundir ficção em geral com romance.
  return 0;
}

function pontuarTamanho(livro, tempo) {
  if (!tempo || tempo === 'qualquer') return null;

  const paginas = Number(livro.paginas);
  if (!Number.isFinite(paginas) || paginas <= 0) return 0;

  if (tempo === 'curto') {
    return paginas <= 280 ? 1 : 0;
  }

  if (tempo === 'medio') {
    return paginas >= 300 && paginas <= 450 ? 1 : 0;
  }

  return null;
}

function extrairCaracteristicasLivro(livro) {
  const ignorar = new Set([
    'book', 'books', 'fiction', 'ficcao', 'literature',
    'literatura', 'novel', 'novels', 'general', 'geral',
    'unknown', 'romance'
  ]);

  const tags = normalizarLista(livro.tags)
    .filter(t => t.length > 2 && !ignorar.has(t));

  const descricao = normalizar(livro.descricao || '');
  const palavras = descricao.split(/[^a-z0-9]+/)
    .filter(p => p.length >= 4 && !ignorar.has(p));

  return {
    genero: normalizar(livro.genero),
    tags: [...new Set(tags)],
    palavras: [...new Set([...tags, ...palavras])]
  };
}

function similaridadeLivros(livroA, livroB) {
  const a = extrairCaracteristicasLivro(livroA);
  const b = extrairCaracteristicasLivro(livroB);
  let soma = 0;
  let peso = 0;

  if (a.genero && b.genero) {
    soma += (a.genero === b.genero ? 1 : 0) * 0.35;
    peso += 0.35;
  }

  const conjuntoA = new Set(a.palavras);
  const conjuntoB = new Set(b.palavras);

  if (conjuntoA.size && conjuntoB.size) {
    const comuns = [...conjuntoA].filter(t => conjuntoB.has(t)).length;
    const jaccard = comuns / Math.max(
      1,
      conjuntoA.size + conjuntoB.size - comuns
    );

    soma += jaccard * 0.65;
    peso += 0.65;
  }

  return peso ? Math.max(0, Math.min(1, soma / peso)) : null;
}

function pontuarPerfil(livro, livrosUsuario) {
  const avaliados = livrosUsuario.filter(l =>
    l.status === 'lido' &&
    Number(l.nota) >= 1 &&
    Number(l.nota) <= 5
  );

  if (!avaliados.length) return null;

  let soma = 0;
  let pesoTotal = 0;

  for (const avaliado of avaliados) {
    const similaridade = similaridadeLivros(livro, avaliado);
    if (similaridade === null) continue;

    const nota = Number(avaliado.nota);
    const peso = Math.abs(nota - 3);

    if (!peso) continue;

    soma += (nota > 3 ? similaridade : -similaridade) * peso;
    pesoTotal += peso;
  }

  if (!pesoTotal) return null;

  return Math.max(0, Math.min(1, 0.5 + (soma / pesoTotal) * 0.5));
}

function calcularMatch(livro, respostasQuiz, livrosUsuario = biblioteca) {
  const vibe = pontuarVibe(livro, respostasQuiz.vibe);
  const genero = pontuarGenero(livro, respostasQuiz.genero);
  const tamanho = pontuarTamanho(livro, respostasQuiz.tempo);
  const perfil = pontuarPerfil(livro, livrosUsuario);

  const criterios = [
    { nome: 'vibe', peso: 45, valor: vibe },
    { nome: 'gênero', peso: 35, valor: genero },
    { nome: 'tamanho', peso: 15, valor: tamanho },
    { nome: 'perfil', peso: 5, valor: perfil }
  ].filter(c => c.valor !== null && Number.isFinite(c.valor));

  if (!criterios.length) {
    return {
      porcentagem: 0,
      motivos: ['Não há informações suficientes para avaliar este livro.']
    };
  }

  const pesoTotal = criterios.reduce((s, c) => s + c.peso, 0);
  const pontos = criterios.reduce((s, c) => s + c.valor * c.peso, 0);
  const motivos = [];

  if (vibe >= 0.7) {
    motivos.push('Há características que combinam com a vibe escolhida.');
  }

  if (genero >= 0.75) {
    motivos.push(`O gênero ou os assuntos correspondem a ${respostasQuiz.genero}.`);
  }

  if (
    respostasQuiz.tempo === 'curto' &&
    Number(livro.paginas) > 0 &&
    Number(livro.paginas) <= 280
  ) {
    motivos.push(`Tem aproximadamente ${livro.paginas} páginas, dentro do limite escolhido.`);
  }

  if (
    respostasQuiz.tempo === 'medio' &&
    Number(livro.paginas) >= 300 &&
    Number(livro.paginas) <= 450
  ) {
    motivos.push('A quantidade de páginas está na faixa de tamanho médio escolhida.');
  }

  if (perfil !== null && perfil >= 0.7) {
    motivos.push('Também apresenta semelhanças com livros bem avaliados por você.');
  }

  return {
    porcentagem: Math.round(pontos / pesoTotal * 100),
    motivos: motivos.length
      ? motivos
      : ['O livro corresponde aos critérios identificados nos dados disponíveis.']
  };
}

function livroAtendeRespostas(livro, respostasQuiz) {
  const vibe = pontuarVibe(livro, respostasQuiz.vibe);
  const genero = pontuarGenero(livro, respostasQuiz.genero);

  if (respostasQuiz.vibe && (vibe === null || vibe < 0.5)) {
    return false;
  }

  if (
    respostasQuiz.genero &&
    normalizar(respostasQuiz.genero) !== 'qualquer' &&
    (genero === null || genero < 0.75)
  ) {
    return false;
  }

  if (respostasQuiz.tempo === 'curto') {
    const paginas = Number(livro.paginas);
    if (!paginas || paginas > 280) return false;
  }

  if (respostasQuiz.tempo === 'medio') {
    const paginas = Number(livro.paginas);
    if (!paginas || paginas < 300 || paginas > 450) return false;
  }

  return true;
}

/* ==========================================================
   QUIZ MATCH
   ========================================================== */

function iniciarQuiz() {
  etapaAtual = 1;
  respostas = { vibe: '', tempo: '', genero: '' };
  document.getElementById('modal-quiz')?.classList.remove('hidden');
  renderizarEtapa();
}

function fecharQuiz() {
  document.getElementById('modal-quiz')?.classList.add('hidden');
}

function selecionarOpcao(chave, valor, proximaEtapa) {
  respostas[chave] = valor;
  etapaAtual = proximaEtapa;
  renderizarEtapa();
}

function renderizarEtapa() {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  if (etapaAtual === 1) {
    const opcoes = [
      ['leve', 'Leve, sem muita carga emocional'],
      ['emocionante', 'Emocionante, quero me envolver com a história'],
      ['presa', 'Uma história que prenda minha atenção'],
      ['pensar', 'Uma história que me faça refletir'],
      ['romance', 'Uma história de amor ou relacionamentos']
    ];

    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 1 de 3</span>
      <h3 class="font-serif text-base font-bold mt-1 mb-3">Que tipo de leitura você procura?</h3>
      <div class="space-y-2">
        ${opcoes.map(([valor, texto]) => `
          <button type="button" onclick="selecionarOpcao('vibe','${valor}',2)"
            class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400">
            <span class="font-semibold text-xs">${texto}</span>
          </button>`).join('')}
      </div>`;
  } else if (etapaAtual === 2) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 2 de 3</span>
      <h3 class="font-serif text-base font-bold mt-1 mb-3">Qual tamanho de livro você prefere?</h3>
      <div class="space-y-2">
        <button type="button" onclick="selecionarOpcao('tempo','curto',3)" class="w-full p-2.5 border rounded-xl text-left text-xs">📖 Curto — até 280 páginas</button>
        <button type="button" onclick="selecionarOpcao('tempo','medio',3)" class="w-full p-2.5 border rounded-xl text-left text-xs">📚 Médio — cerca de 300 a 450 páginas</button>
        <button type="button" onclick="selecionarOpcao('tempo','qualquer',3)" class="w-full p-2.5 border rounded-xl text-left text-xs">Sem preferência de tamanho</button>
      </div>`;
  } else {
    const generos = [
      'Romance', 'Drama', 'Ficção', 'Suspense',
      'Fantasia', 'Young Adult', 'Não ficção', 'Qualquer'
    ];

    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 3 de 3</span>
      <h3 class="font-serif text-base font-bold mt-1 mb-3">Qual gênero você quer ler?</h3>
      <div class="grid grid-cols-2 gap-2">
        ${generos.map(g => `
          <button type="button" onclick="finalizarQuiz('${g}')"
            class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs hover:border-blush-400">
            ${g}
          </button>`).join('')}
      </div>`;
  }
}

/* ==========================================================
   BUSCA EXTERNA DE RECOMENDAÇÕES
   ========================================================== */

function normalizarResultadoGoogle(item) {
  const info = item.volumeInfo || {};
  let capa = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || CAPA_PADRAO;

  if (capa.startsWith('http:')) capa = capa.replace('http:', 'https:');

  const categorias = Array.isArray(info.categories) ? info.categories : [];

  return {
    id: `google-${item.id || Math.random()}`,
    titulo: info.title || '',
    autor: info.authors?.join(', ') || 'Autor desconhecido',
    paginas: Number(info.pageCount) > 0 ? Number(info.pageCount) : null,
    genero: detectarGenero(categorias),
    capa,
    descricao: info.description || '',
    tags: categorias.flatMap(c => c.split(/[\/,]/)).map(normalizar).filter(Boolean),
    novidade: true
  };
}

function detectarGenero(assuntos) {
  const lista = (Array.isArray(assuntos) ? assuntos : [assuntos])
    .map(normalizar)
    .filter(Boolean);

  const regras = [
    ['nao ficcao', ['nonfiction', 'non-fiction', 'self-help', 'biography', 'autobiography']],
    ['young adult', ['young adult', 'ya fiction', 'juvenile fiction', 'teen fiction']],
    ['suspense', ['mystery', 'thriller', 'crime fiction', 'detective', 'suspense']],
    ['fantasia', ['fantasy', 'fantasia', 'high fantasy', 'urban fantasy']],
    ['romance', ['romance', 'romantic fiction', 'love stories']],
    ['drama', ['drama', 'family saga', 'domestic fiction']],
    ['ficcao', ['fiction', 'ficcao', 'literary fiction', 'contemporary fiction']]
  ];

  for (const [genero, termos] of regras) {
    if (lista.some(item => termos.some(t => item === t || item.includes(t)))) {
      return genero;
    }
  }

  return '';
}

async function buscarRecomendacoesExternas(genero) {
  const termos = {
    Romance: 'subject:romance',
    Drama: 'drama fiction novel',
    Ficção: 'fiction novel',
    Suspense: 'mystery thriller',
    Fantasia: 'fantasy novel',
    'Young Adult': 'young adult fiction',
    'Não ficção': 'nonfiction books',
    Qualquer: 'popular fiction novel'
  };

  const consultas = {
    Romance: ['romance love story', 'romantic fiction'],
    Drama: ['drama fiction', 'family drama novel'],
    Ficção: ['fiction novel'],
    Suspense: ['mystery thriller', 'detective novel'],
    Fantasia: ['fantasy novel'],
    'Young Adult': ['young adult fiction', 'young adult romance'],
    'Não ficção': ['nonfiction books'],
    Qualquer: ['popular fiction books']
  };

  const consultaBase = termos[genero] || termos.Qualquer;
  const chaveCache = normalizar(`${genero}|${consultaBase}`);

  if (cacheRecomendacoes.has(chaveCache)) {
    return cacheRecomendacoes.get(chaveCache).map(l => ({
      ...l,
      tags: [...(l.tags || [])]
    }));
  }

  let livros = [];

  if (Date.now() >= googleBooksBloqueadoAte) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(consultaBase)}&maxResults=40&orderBy=relevance`;
      const resposta = await limitarTempo(fetch(url));

      if (resposta.status === 429) {
        googleBooksBloqueadoAte = Date.now() + 5 * 60 * 1000;
      } else if (resposta.ok) {
        const dados = await resposta.json();
        livros = (dados.items || [])
          .map(normalizarResultadoGoogle)
          .filter(l => l.titulo);
      }
    } catch (erro) {
      console.warn('Google Books indisponível:', erro);
    }
  }

  if (livros.length < 20) {
    for (const termo of (consultas[genero] || consultas.Qualquer)) {
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(termo)}&limit=40`;
        const resposta = await limitarTempo(fetch(url));
        if (!resposta.ok) continue;

        const dados = await resposta.json();

        const complementares = (dados.docs || []).map(item => {
          const assuntos = Array.isArray(item.subject) ? item.subject : [];

          return {
            id: `openlibrary-${item.key || item.title}`,
            titulo: item.title || '',
            autor: item.author_name?.join(', ') || 'Autor desconhecido',
            paginas: Number(item.number_of_pages_median) > 0
              ? Number(item.number_of_pages_median)
              : null,
            genero: detectarGenero(assuntos),
            capa: item.cover_i
              ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
              : CAPA_PADRAO,
            descricao: '',
            tags: assuntos.map(normalizar),
            novidade: true
          };
        }).filter(l => l.titulo);

        livros = [...livros, ...complementares];
        if (livros.length >= 70) break;
      } catch (erro) {
        console.warn('Open Library indisponível:', erro);
      }
    }
  }

  const vistos = new Set();

  const resultado = livros.filter(livro => {
    const titulo = normalizar(livro.titulo);
    if (!titulo || vistos.has(titulo)) return false;
    vistos.add(titulo);
    return true;
  });

  if (resultado.length) cacheRecomendacoes.set(chaveCache, resultado);

  return resultado;
}

/* ==========================================================
   CATÁLOGO LOCAL DE RESERVA
   As páginas são aproximadas e podem variar por edição.
   ========================================================== */

const LIVROS_RESERVA = {
  Romance: [
    {
      titulo: 'A Probabilidade Estatística do Amor à Primeira Vista',
      autor: 'Jennifer E. Smith',
      genero: 'Romance',
      paginas: 224,
      vibe: ['romance', 'leve'],
      descricao: 'Dois jovens se conhecem durante uma viagem e desenvolvem uma conexão inesperada.',
      tags: ['romance', 'love story', 'first love', 'viagem', 'relacionamento']
    },
    {
      titulo: 'Pessoas Normais',
      autor: 'Sally Rooney',
      genero: 'Romance',
      paginas: 273,
      vibe: ['romance', 'emocionante', 'pensar'],
      descricao: 'A relação complexa entre Marianne e Connell acompanha os dois ao longo dos anos, explorando amor, intimidade e dificuldades de comunicação.',
      tags: ['romance', 'relacionamento amoroso', 'love story', 'drama', 'introspectivo']
    },
    {
      titulo: 'A Cinco Passos de Você',
      autor: 'Rachael Lippincott',
      genero: 'Romance',
      paginas: 288,
      vibe: ['romance', 'emocionante'],
      descricao: 'Dois jovens se apaixonam enquanto enfrentam limitações que tornam a proximidade entre eles difícil e arriscada.',
      tags: ['romance', 'love story', 'first love', 'drama', 'relacionamento']
    },
    {
      titulo: 'Amores Verdadeiros',
      autor: 'Taylor Jenkins Reid',
      genero: 'Romance',
      paginas: 352,
      vibe: ['romance', 'emocionante'],
      descricao: 'Uma mulher precisa compreender seus sentimentos quando alguém de seu passado retorna e coloca em questão a vida amorosa que construiu.',
      tags: ['romance', 'love story', 'relacionamentos', 'drama']
    },
    {
      titulo: 'Depois Daquele Verão',
      autor: 'Carley Fortune',
      genero: 'Romance',
      paginas: 368,
      vibe: ['romance', 'emocionante'],
      descricao: 'Uma mulher retorna a um lugar cheio de lembranças e reencontra alguém com quem tem uma história afetiva complicada.',
      tags: ['romance', 'second chance romance', 'love story', 'reencontro']
    }
  ],

  Drama: [
    {
      titulo: 'Pessoas Normais',
      autor: 'Sally Rooney',
      genero: 'Drama',
      paginas: 273,
      vibe: ['romance', 'emocionante', 'pensar'],
      descricao: 'A relação complexa entre Marianne e Connell explora amor, intimidade e as mudanças que acontecem ao longo dos anos.',
      tags: ['drama', 'relacionamento amoroso', 'romance']
    },
    {
      titulo: 'Os Sete Maridos de Evelyn Hugo',
      autor: 'Taylor Jenkins Reid',
      genero: 'Drama',
      paginas: 360,
      vibe: ['emocionante', 'pensar'],
      descricao: 'Uma estrela de cinema revela os acontecimentos, relacionamentos e segredos que marcaram sua vida.',
      tags: ['drama', 'relacionamentos', 'segredos', 'ficção literária']
    },
    {
      titulo: 'Malibu Renasce',
      autor: 'Taylor Jenkins Reid',
      genero: 'Drama',
      paginas: 368,
      vibe: ['emocionante', 'pensar'],
      descricao: 'Uma família enfrenta conflitos e segredos durante um dia decisivo, explorando relações familiares e consequências do passado.',
      tags: ['drama', 'família', 'relacionamentos']
    }
  ],

  Ficção: [
    {
      titulo: 'A Biblioteca da Meia-Noite',
      autor: 'Matt Haig',
      genero: 'Ficção',
      paginas: 308,
      vibe: ['pensar', 'emocionante'],
      descricao: 'Uma mulher explora versões alternativas de sua vida e reflete sobre escolhas, arrependimentos e possibilidades.',
      tags: ['ficção', 'reflexivo', 'existencial']
    },
    {
      titulo: 'O Conto da Aia',
      autor: 'Margaret Atwood',
      genero: 'Ficção',
      paginas: 311,
      vibe: ['pensar', 'presa'],
      descricao: 'Em uma sociedade autoritária, uma mulher narra sua experiência de controle, opressão e resistência.',
      tags: ['ficção', 'distopia', 'reflexivo']
    }
  ],

  Suspense: [
    {
      titulo: 'A Paciente Silenciosa',
      autor: 'Alex Michaelides',
      genero: 'Suspense',
      paginas: 350,
      vibe: ['presa', 'pensar'],
      descricao: 'Um psicoterapeuta tenta descobrir por que uma pintora parou de falar depois de um acontecimento violento.',
      tags: ['suspense', 'mistério', 'thriller', 'plot twist']
    },
    {
      titulo: 'Garota Exemplar',
      autor: 'Gillian Flynn',
      genero: 'Suspense',
      paginas: 432,
      vibe: ['presa', 'pensar'],
      descricao: 'O desaparecimento de uma mulher expõe segredos e versões conflitantes dentro de um casamento.',
      tags: ['suspense', 'mistério', 'thriller', 'relacionamento']
    }
  ],

  Fantasia: [
    {
      titulo: 'Harry Potter e a Pedra Filosofal',
      autor: 'J. K. Rowling',
      genero: 'Fantasia',
      paginas: 264,
      vibe: ['leve', 'presa'],
      descricao: 'Um menino descobre que pertence ao mundo da magia e começa uma nova vida em uma escola extraordinária.',
      tags: ['fantasia', 'magia', 'aventura']
    },
    {
      titulo: 'A Vida Invisível de Addie LaRue',
      autor: 'V. E. Schwab',
      genero: 'Fantasia',
      paginas: 448,
      vibe: ['romance', 'pensar'],
      descricao: 'Uma mulher que não pode ser lembrada por ninguém atravessa séculos em busca de liberdade, conexão e amor.',
      tags: ['fantasia', 'romance', 'love story', 'existencial']
    }
  ],

  'Young Adult': [
    {
      titulo: 'Jogos Vorazes',
      autor: 'Suzanne Collins',
      genero: 'Young Adult',
      paginas: 374,
      vibe: ['presa', 'emocionante'],
      descricao: 'Uma jovem participa de uma competição mortal em uma sociedade desigual e precisa lutar para sobreviver.',
      tags: ['young adult', 'distopia', 'aventura', 'suspense']
    },
    {
      titulo: 'Extraordinário',
      autor: 'R. J. Palacio',
      genero: 'Young Adult',
      paginas: 320,
      vibe: ['emocionante', 'pensar'],
      descricao: 'Um menino começa a frequentar uma escola regular e enfrenta desafios relacionados à amizade, empatia e aceitação.',
      tags: ['young adult', 'família', 'amizade', 'emocionante']
    }
  ],

  'Não ficção': [
    {
      titulo: 'Hábitos Atômicos',
      autor: 'James Clear',
      genero: 'Não ficção',
      paginas: 320,
      vibe: ['pensar', 'leve'],
      descricao: 'Um guia prático sobre como pequenas mudanças de comportamento podem ajudar a construir hábitos consistentes.',
      tags: ['não ficção', 'desenvolvimento pessoal', 'hábitos']
    },
    {
      titulo: 'Essencialismo',
      autor: 'Greg McKeown',
      genero: 'Não ficção',
      paginas: 272,
      vibe: ['pensar'],
      descricao: 'O livro apresenta maneiras de priorizar o que é importante e reduzir compromissos que não contribuem para seus objetivos.',
      tags: ['não ficção', 'produtividade', 'reflexivo']
    }
  ],

  Qualquer: [
    {
      titulo: 'A Probabilidade Estatística do Amor à Primeira Vista',
      autor: 'Jennifer E. Smith',
      genero: 'Romance',
      paginas: 224,
      vibe: ['romance', 'leve'],
      descricao: 'Dois jovens se conhecem durante uma viagem e desenvolvem uma conexão inesperada.',
      tags: ['romance', 'love story', 'first love']
    },
    {
      titulo: 'A Biblioteca da Meia-Noite',
      autor: 'Matt Haig',
      genero: 'Ficção',
      paginas: 308,
      vibe: ['pensar', 'emocionante'],
      descricao: 'Uma mulher explora versões alternativas de sua vida e reflete sobre escolhas, arrependimentos e possibilidades.',
      tags: ['ficção', 'reflexivo', 'existencial']
    }
  ]
};

function criarLivroReserva(item, indice) {
  return {
    id: `reserva-${normalizar(item.titulo).replace(/\s+/g, '-')}-${indice}`,
    titulo: item.titulo,
    autor: item.autor,
    paginas: item.paginas || null,
    paginaAtual: 0,
    genero: item.genero,
    capa: CAPA_PADRAO,
    descricao: item.descricao || '',
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: [...(item.tags || [])],
    vibe: [...(item.vibe || [])],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    novidade: true,
    dataInicio: null,
    dataFim: null
  };
}

/* ==========================================================
   FINALIZAR QUIZ
   ========================================================== */

async function finalizarQuiz(genero) {
  respostas.genero = genero;

  const container = document.getElementById('quiz-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-10 space-y-3">
      <div class="w-6 h-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-cozy-muted">Procurando livros que realmente combinem com você...</p>
    </div>`;

  try {
    let externos = [];

    try {
      externos = await buscarRecomendacoesExternas(genero);
    } catch (erro) {
      console.warn('Não foi possível buscar livros nas APIs:', erro);
    }

    const candidatos = [];
    const titulosIncluidos = new Set();

    // Primeiro, livros retornados pelas APIs.
    for (const livro of externos || []) {
      if (!livro.titulo || tituloJaExiste(livro.titulo)) continue;

      const chave = normalizar(livro.titulo);
      if (titulosIncluidos.has(chave)) continue;
      if (!livroAtendeRespostas(livro, respostas)) continue;

      const calculo = calcularMatch(livro, respostas, biblioteca);

      candidatos.push({
        ...livro,
        match: calculo.porcentagem,
        motivos: calculo.motivos,
        novidade: true
      });

      titulosIncluidos.add(chave);
    }

    // Depois, o catálogo local. Nunca ignora as escolhas do quiz.
    const reservas = [
      ...(LIVROS_RESERVA[genero] || []),
      ...(genero === 'Qualquer' ? [] : LIVROS_RESERVA.Qualquer)
    ];

    for (let i = 0; i < reservas.length && candidatos.length < 3; i++) {
      const reserva = reservas[i];
      const chave = normalizar(reserva.titulo);

      if (tituloJaExiste(reserva.titulo)) continue;
      if (titulosIncluidos.has(chave)) continue;

      const livro = criarLivroReserva(reserva, i);

      if (!livroAtendeRespostas(livro, respostas)) continue;

      const calculo = calcularMatch(livro, respostas, biblioteca);

      candidatos.push({
        ...livro,
        match: calculo.porcentagem,
        motivos: calculo.motivos,
        novidade: true
      });

      titulosIncluidos.add(chave);
    }

    candidatos.sort((a, b) => b.match - a.match);

    exibirResultado(candidatos.slice(0, 3));
  } catch (erro) {
    console.error('Erro ao gerar recomendações:', erro);
    exibirResultado([]);
  }
}

/* ==========================================================
   ADICIONAR RECOMENDAÇÃO À ESTANTE
   ========================================================== */

function adicionarRecomendacaoPorIndice(index) {
  const livro = recomendacoesQuizAtuais[index];
  if (!livro) return;

  if (tituloJaExiste(livro.titulo)) {
    alert('Esse livro já está na sua estante.');
    return;
  }

  biblioteca.unshift(criarRegistroLivro(livro));
  salvarStorage();
  renderizarEstante();

  alert('Livro adicionado à sua estante!');
  fecharQuiz();
}

/* ==========================================================
   EXIBIR RESULTADOS
   ========================================================== */

function exibirResultado(livros) {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  recomendacoesQuizAtuais = livros || [];

  if (!recomendacoesQuizAtuais.length) {
    container.innerHTML = `
      <div class="text-center py-6 space-y-3">
        <p class="text-2xl">🔎</p>
        <h3 class="font-serif font-bold text-sm">Não encontrei livros suficientes com esses critérios.</h3>
        <p class="text-xs text-cozy-muted">
          As fontes consultadas não forneceram dados suficientes para confirmar todas as suas escolhas.
          Você pode tentar sem preferência de tamanho ou escolher outro gênero.
        </p>
        <button type="button" onclick="iniciarQuiz()"
          class="w-full bg-blush-500 text-white font-semibold py-2 rounded-lg text-xs">
          Tentar novamente
        </button>
        <button type="button" onclick="fecharQuiz()"
          class="w-full bg-stone-100 text-stone-700 py-2 rounded-lg text-xs">
          Fechar
        </button>
      </div>`;
    return;
  }

  const mensagemQuantidade = recomendacoesQuizAtuais.length < 3
    ? `Encontrei ${recomendacoesQuizAtuais.length} opção${recomendacoesQuizAtuais.length === 1 ? '' : 'ões'} compatível${recomendacoesQuizAtuais.length === 1 ? '' : 'is'} com suas escolhas.`
    : 'As sugestões foram selecionadas com base nos critérios do quiz.';

  container.innerHTML = `
    <div class="text-center mb-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase">ReadMatch</span>
      <h3 class="font-serif text-base font-bold text-stone-800">Livros que combinam com sua escolha</h3>
      <p class="text-[11px] text-cozy-muted mt-1">${mensagemQuantidade}</p>
    </div>

    <div class="space-y-2.5 max-h-96 overflow-y-auto custom-scroll pr-1">
      ${recomendacoesQuizAtuais.map((livro, idx) => `
        <div class="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div class="flex gap-3 items-center">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
              class="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
              onerror="this.onerror=null;this.src='${CAPA_PADRAO}'">
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <h4 class="font-serif font-bold text-stone-800 text-xs">${escaparHTML(livro.titulo)}</h4>
                <span class="bg-blush-100 text-blush-600 font-bold text-[10px] px-2 py-0.5 rounded-full flex-shrink-0">
                  ${livro.match}% Match
                </span>
              </div>
              <p class="text-[11px] text-cozy-muted">${escaparHTML(livro.autor)}</p>
              <span class="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded inline-block mt-1">
                Sugestão de leitura
              </span>
              <p class="text-[10px] text-stone-500 mt-1">
                ${livro.paginas ? `${livro.paginas} páginas (aprox.)` : 'Páginas não informadas'} • ${escaparHTML(livro.genero || 'Gênero não informado')}
              </p>
            </div>
          </div>

          ${livro.motivos?.length ? `
            <div class="text-[10px] text-stone-600">
              <strong>Por que apareceu:</strong>
              <ul class="list-disc pl-4 mt-1">
                ${livro.motivos.slice(0, 3).map(m => `<li>${escaparHTML(m)}</li>`).join('')}
              </ul>
            </div>` : ''}

          <button type="button" onclick="adicionarRecomendacaoPorIndice(${idx})"
            class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-1.5 rounded-lg text-[11px]">
            + Adicionar à estante
          </button>
        </div>`).join('')}
    </div>

    <button type="button" onclick="fecharQuiz()"
      class="w-full mt-3 bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 rounded-lg text-xs">
      Fechar
    </button>`;
}

/* ==========================================================
   INICIALIZAÇÃO
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  atualizarHeaderUsuario();
  filtrarEstante('todos');

  if (!usuarioAtual) {
    abrirModalLogin();
  }
});
