
/* ==========================================================
   READMATCH — JavaScript completo
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

  const usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
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

  return {
    titulo: info.title || 'Sem título',
    autor: info.authors?.join(', ') || 'Autor desconhecido',
    paginas: Number(info.pageCount) > 0 ? Number(info.pageCount) : null,
    genero: info.categories?.[0]?.split('/')[0]?.trim() || '',
    capa,
    descricao: info.description || '',
    tags: []
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

        resultadosBuscaAPI = (dados.docs || []).map(doc => ({
          titulo: doc.title || 'Sem título',
          autor: doc.author_name?.join(', ') || 'Autor desconhecido',
          paginas: Number(doc.number_of_pages_median) || null,
          genero: doc.subject?.[0] || '',
          capa: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : CAPA_PADRAO,
          descricao: '',
          tags: (doc.subject || []).slice(0, 8).map(normalizar)
        }));
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

  biblioteca.unshift({
    id: (Date.now() + Math.random()).toString(),
    ...dados,
    paginaAtual: 0,
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    dataInicio: null,
    dataFim: null
  });

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
   CÁLCULO DE COMPATIBILIDADE DO MATCH
   ========================================================== */

const TAGS_POR_VIBE = {
  leve: ['leve', 'divertido', 'confortavel', 'fofo', 'feel good', 'comedia', 'romance leve'],
  emocionante: ['emocionante', 'triste', 'drama', 'emocao', 'chorar', 'luto', 'familia', 'melancolico'],
  presa: ['envolvente', 'ritmo rapido', 'rapido', 'suspense', 'plot twist', 'viciante', 'misterio'],
  pensar: ['reflexivo', 'filosofico', 'complexo', 'existencial', 'introspectivo'],
  romance: ['romance', 'amor', 'relacionamento', 'slow burn', 'enemies to lovers', 'friends to lovers']
};

function pontuarVibe(livro, vibe) {
  const pistas = TAGS_POR_VIBE[vibe] || [];
  if (!pistas.length) return null;

  const texto = normalizar([
    livro.genero || '',
    livro.titulo || '',
    livro.descricao || '',
    ...(livro.tags || [])
  ].join(' '));

  if (!texto.trim()) return null;

  const encontrados = pistas.filter(p => texto.includes(normalizar(p)));
  return encontrados.length ? Math.min(1, encontrados.length / 2) : 0;
}

function pontuarGenero(livro, desejado) {
  const genero = normalizar(livro.genero);
  const pedido = normalizar(desejado);
  const tags = (livro.tags || []).map(normalizar);

  if (!pedido || pedido === 'qualquer') return null;
  if (!genero && !tags.length) return null;
  if (genero.includes(pedido) || pedido.includes(genero)) return 1;
  if (tags.some(t => t.includes(pedido) || pedido.includes(t))) return 1;

  const grupos = {
    romance: ['romance', 'romantic', 'love'],
    drama: ['drama', 'fiction', 'ficcao', 'literature'],
    ficcao: ['fiction', 'ficcao', 'fantasy', 'fantasia', 'distopia'],
    suspense: ['mystery', 'misterio', 'thriller', 'suspense', 'crime'],
    fantasia: ['fantasy', 'fantasia', 'magia'],
    'young adult': ['young adult', 'adolescent', 'juvenile'],
    'nao ficcao': ['nonfiction', 'non-fiction', 'biography', 'autobiography']
  };

  const familia = grupos[pedido] || [pedido];
  return familia.some(t => genero.includes(t) || tags.some(tag => tag.includes(t)))
    ? 0.65
    : 0;
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
  const ignorar = new Set([
    'book', 'books', 'fiction', 'ficcao', 'literature', 'literatura',
    'novel', 'novels', 'general', 'geral', 'unknown'
  ]);

  const tags = (livro.tags || [])
    .map(normalizar)
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
    const afinidade = a.genero === b.genero ||
      a.genero.includes(b.genero) || b.genero.includes(a.genero) ? 1 : 0;

    soma += afinidade * 0.55;
    peso += 0.55;
  }

  const conjuntoA = new Set(a.palavras);
  const conjuntoB = new Set(b.palavras);

  if (conjuntoA.size && conjuntoB.size) {
    const comuns = [...conjuntoA].filter(t => conjuntoB.has(t)).length;
    const jaccard = comuns / Math.max(1, conjuntoA.size + conjuntoB.size - comuns);
    soma += jaccard * 0.45;
    peso += 0.45;
  }

  return peso ? Math.max(0, Math.min(1, soma / peso)) : null;
}

function pontuarPerfil(livro, livrosUsuario) {
  const avaliados = livrosUsuario.filter(l =>
    l.status === 'lido' && Number(l.nota) >= 1 && Number(l.nota) <= 5
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

  return Math.max(0.05, Math.min(0.98, 0.5 + (soma / pesoTotal) * 0.48));
}

function calcularMatch(livro, respostasQuiz, livrosUsuario = biblioteca) {
  const perfil = pontuarPerfil(livro, livrosUsuario);

  const criterios = [
    { nome: 'seu histórico de leitura', peso: 50, valor: perfil },
    { nome: 'seu momento', peso: 25, valor: pontuarVibe(livro, respostasQuiz.vibe) },
    { nome: 'gênero escolhido', peso: 15, valor: pontuarGenero(livro, respostasQuiz.genero) },
    { nome: 'tamanho do livro', peso: 10, valor: pontuarTamanho(livro, respostasQuiz.tempo) }
  ].filter(c => c.valor !== null && Number.isFinite(c.valor));

  if (!criterios.length) {
    return { porcentagem: null, motivos: ['Ainda faltam informações para avaliar este livro.'] };
  }

  const pesoTotal = criterios.reduce((s, c) => s + c.peso, 0);
  const pontos = criterios.reduce((s, c) => s + c.valor * c.peso, 0);
  const motivos = [];

  if (perfil !== null) motivos.push('A pontuação considera suas avaliações anteriores.');

  if (respostasQuiz.genero && respostasQuiz.genero !== 'Qualquer') {
    motivos.push(`Sugestão para o gênero ${respostasQuiz.genero}.`);
  }

  if (respostasQuiz.tempo === 'curto' && Number(livro.paginas) > 0 && Number(livro.paginas) <= 280) {
    motivos.push('O número de páginas combina com o tamanho escolhido.');
  }

  if (respostasQuiz.tempo === 'medio' && Number(livro.paginas) >= 300 && Number(livro.paginas) <= 450) {
    motivos.push('O número de páginas combina com o tamanho escolhido.');
  }

  if (!motivos.length) motivos.push('Sugestão baseada nas respostas do quiz.');

  return {
    porcentagem: Math.round(pontos / pesoTotal * 100),
    motivos: [...new Set(motivos)]
  };
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
    const generos = ['Romance', 'Drama', 'Ficção', 'Suspense', 'Fantasia', 'Young Adult', 'Não ficção', 'Qualquer'];

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
    genero: categorias[0]?.split('/')[0]?.trim() || '',
    capa,
    descricao: info.description || '',
    tags: categorias.flatMap(c => c.split(/[\/,]/)).map(normalizar).filter(Boolean),
    novidade: true
  };
}

async function buscarRecomendacoesExternas(genero, livrosUsuario = biblioteca) {
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

  const consultaBase = termos[genero] || 'popular fiction novel';
  const avaliadosBem = livrosUsuario.filter(l => l.status === 'lido' && Number(l.nota) >= 4);

  const pistas = [
    ...new Set(avaliadosBem.map(l => String(l.genero || '').trim()).filter(Boolean))
  ].slice(0, 2).join(' ');

  const consulta = `${consultaBase} ${pistas}`.trim();
  const chaveCache = normalizar(`${genero}|${consulta}`);

  if (cacheRecomendacoes.has(chaveCache)) {
    return cacheRecomendacoes.get(chaveCache).map(l => ({ ...l, tags: [...(l.tags || [])] }));
  }

  let livros = [];

  // Primeira tentativa: Google Books, exceto quando está temporariamente limitado.
  if (Date.now() >= googleBooksBloqueadoAte) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(consulta)}&maxResults=20&orderBy=relevance`;
      const resposta = await limitarTempo(fetch(url));

      if (resposta.status === 429) {
        googleBooksBloqueadoAte = Date.now() + 5 * 60 * 1000;
        console.warn('Google Books retornou 429. Tentando Open Library.');
      } else if (resposta.ok) {
        const dados = await resposta.json();
        livros = (dados.items || []).map(normalizarResultadoGoogle).filter(l => l.titulo);
      }
    } catch (erro) {
      console.warn('Google Books indisponível:', erro);
    }
  }

  // Segunda tentativa: Open Library.
  if (livros.length < 10) {
    const consultasOpenLibrary = [
      consulta,
      consultaBase,
      genero === 'Qualquer' ? 'popular books' : genero
    ];

    for (const termo of [...new Set(consultasOpenLibrary)]) {
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(termo)}&limit=30`;
        const resposta = await limitarTempo(fetch(url));
        if (!resposta.ok) continue;

        const dados = await resposta.json();

        const complementares = (dados.docs || []).map(item => {
          const assuntos = Array.isArray(item.subject) ? item.subject : [];

          return {
            id: `openlibrary-${item.key || item.title}`,
            titulo: item.title || '',
            autor: item.author_name?.join(', ') || 'Autor desconhecido',
            paginas: Number(item.number_of_pages_median) > 0 ? Number(item.number_of_pages_median) : null,
            genero: assuntos[0] || genero,
            capa: item.cover_i
              ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
              : CAPA_PADRAO,
            descricao: assuntos.slice(0, 8).join(', '),
            tags: assuntos.map(normalizar),
            novidade: true
          };
        }).filter(l => l.titulo);

        livros = [...livros, ...complementares];

        if (livros.length >= 15) break;
      } catch (erro) {
        console.warn('Open Library indisponível para esta consulta:', erro);
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
   SUGESTÕES DE RESERVA — NÃO DEPENDEM DA INTERNET
   ========================================================== */

const LIVROS_RESERVA = {
  Romance: [
    { titulo: 'Amores Verdadeiros', autor: 'Taylor Jenkins Reid', genero: 'Romance' },
    { titulo: 'Depois Daquele Verão', autor: 'Carley Fortune', genero: 'Romance' },
    { titulo: 'Um Dia', autor: 'David Nicholls', genero: 'Romance' },
    { titulo: 'Pessoas Normais', autor: 'Sally Rooney', genero: 'Romance' },
    { titulo: 'A Hipótese do Amor', autor: 'Ali Hazelwood', genero: 'Romance' }
  ],
  Drama: [
    { titulo: 'Os Sete Maridos de Evelyn Hugo', autor: 'Taylor Jenkins Reid', genero: 'Drama' },
    { titulo: 'Malibu Renasce', autor: 'Taylor Jenkins Reid', genero: 'Drama' },
    { titulo: 'Daisy Jones and The Six', autor: 'Taylor Jenkins Reid', genero: 'Drama' },
    { titulo: 'Pequenos Incêndios por Toda Parte', autor: 'Celeste Ng', genero: 'Drama' }
  ],
  Ficção: [
    { titulo: 'A Biblioteca da Meia-Noite', autor: 'Matt Haig', genero: 'Ficção' },
    { titulo: 'O Conto da Aia', autor: 'Margaret Atwood', genero: 'Ficção' },
    { titulo: 'A Vida Invisível de Addie LaRue', autor: 'V. E. Schwab', genero: 'Ficção' }
  ],
  Suspense: [
    { titulo: 'Verity', autor: 'Colleen Hoover', genero: 'Suspense' },
    { titulo: 'A Paciente Silenciosa', autor: 'Alex Michaelides', genero: 'Suspense' },
    { titulo: 'Garota Exemplar', autor: 'Gillian Flynn', genero: 'Suspense' },
    { titulo: 'A Empregada', autor: 'Freida McFadden', genero: 'Suspense' }
  ],
  Fantasia: [
    { titulo: 'Harry Potter e a Pedra Filosofal', autor: 'J. K. Rowling', genero: 'Fantasia' },
    { titulo: 'O Nome do Vento', autor: 'Patrick Rothfuss', genero: 'Fantasia' },
    { titulo: 'A Vida Invisível de Addie LaRue', autor: 'V. E. Schwab', genero: 'Fantasia' }
  ],
  'Young Adult': [
    { titulo: 'Jogos Vorazes', autor: 'Suzanne Collins', genero: 'Young Adult' },
    { titulo: 'Extraordinário', autor: 'R. J. Palacio', genero: 'Young Adult' },
    { titulo: 'É Assim que Acaba', autor: 'Colleen Hoover', genero: 'Young Adult' }
  ],
  'Não ficção': [
    { titulo: 'Hábitos Atômicos', autor: 'James Clear', genero: 'Não ficção' },
    { titulo: 'O Poder do Hábito', autor: 'Charles Duhigg', genero: 'Não ficção' },
    { titulo: 'Essencialismo', autor: 'Greg McKeown', genero: 'Não ficção' }
  ],
  Qualquer: [
    { titulo: 'Os Sete Maridos de Evelyn Hugo', autor: 'Taylor Jenkins Reid', genero: 'Drama' },
    { titulo: 'A Biblioteca da Meia-Noite', autor: 'Matt Haig', genero: 'Ficção' },
    { titulo: 'A Paciente Silenciosa', autor: 'Alex Michaelides', genero: 'Suspense' },
    { titulo: 'Amores Verdadeiros', autor: 'Taylor Jenkins Reid', genero: 'Romance' }
  ]
};

function criarLivroReserva(item, indice) {
  return {
    id: `reserva-${normalizar(item.titulo).replace(/\s+/g, '-')}-${indice}`,
    titulo: item.titulo,
    autor: item.autor,
    paginas: null,
    paginaAtual: 0,
    genero: item.genero,
    capa: CAPA_PADRAO,
    descricao: '',
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: [normalizar(item.genero)],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    novidade: true,
    dataInicio: null,
    dataFim: null
  };
}

/* ==========================================================
   FINALIZAR QUIZ — CORREÇÃO DO ERRO DE SUGESTÕES
   ========================================================== */

async function finalizarQuiz(genero) {
  respostas.genero = genero;

  const container = document.getElementById('quiz-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-10 space-y-3">
      <div class="w-6 h-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-cozy-muted">Buscando sugestões para você...</p>
    </div>`;

  try {
    let externos = [];

    try {
      externos = await buscarRecomendacoesExternas(genero, biblioteca);
    } catch (erro) {
      console.warn('Não foi possível buscar livros nas APIs:', erro);
    }

    const novos = (externos || []).filter(livro =>
      livro.titulo && !tituloJaExiste(livro.titulo)
    );

    const candidatos = novos.map(livro => {
      const calculo = calcularMatch(livro, respostas, biblioteca);

      return {
        ...livro,
        match: calculo.porcentagem ?? 50,
        motivos: calculo.motivos || [],
        novidade: true
      };
    });

    // Se as APIs falharem ou retornarem poucos livros, completa com sugestões locais.
    const reservas = LIVROS_RESERVA[genero] || LIVROS_RESERVA.Qualquer;

    for (let i = 0; i < reservas.length && candidatos.length < 3; i++) {
      const reserva = reservas[i];

      if (tituloJaExiste(reserva.titulo)) continue;

      if (candidatos.some(l =>
        normalizar(l.titulo) === normalizar(reserva.titulo)
      )) continue;

      const livro = criarLivroReserva(reserva, i);
      const calculo = calcularMatch(livro, respostas, biblioteca);

      candidatos.push({
        ...livro,
        match: calculo.porcentagem ?? 50,
        motivos: calculo.motivos || ['Sugestão de reserva baseada no gênero escolhido.'],
        novidade: true
      });
    }

    // Se o usuário já tiver quase todos os títulos de reserva,
    // mostra sugestões disponíveis mesmo que já estejam na estante.
    if (candidatos.length === 0) {
      for (let i = 0; i < reservas.length && candidatos.length < 3; i++) {
        const reserva = reservas[i];
        const livro = criarLivroReserva(reserva, i);
        const calculo = calcularMatch(livro, respostas, biblioteca);

        candidatos.push({
          ...livro,
          match: calculo.porcentagem ?? 50,
          motivos: ['Sugestão de reserva para o gênero selecionado.'],
          novidade: !tituloJaExiste(livro.titulo),
          jaNaEstante: tituloJaExiste(livro.titulo)
        });
      }
    }

    candidatos.sort((a, b) => b.match - a.match);
    exibirResultado(candidatos.slice(0, 3));

  } catch (erro) {
    console.error('Erro ao gerar recomendações:', erro);

    // Última alternativa: o quiz ainda mostra sugestões sem consultar a internet.
    const reservas = LIVROS_RESERVA[genero] || LIVROS_RESERVA.Qualquer;
    const alternativas = reservas.slice(0, 3).map((item, i) => ({
      ...criarLivroReserva(item, i),
      match: 50,
      motivos: ['Sugestão de reserva baseada no gênero escolhido.'],
      novidade: !tituloJaExiste(item.titulo),
      jaNaEstante: tituloJaExiste(item.titulo)
    }));

    exibirResultado(alternativas);
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

  biblioteca.unshift({
    id: (Date.now() + Math.random()).toString(),
    titulo: livro.titulo,
    autor: livro.autor || 'Autor desconhecido',
    paginas: Number(livro.paginas) > 0 ? Number(livro.paginas) : null,
    paginaAtual: 0,
    genero: livro.genero || '',
    capa: livro.capa || CAPA_PADRAO,
    descricao: livro.descricao || '',
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: Array.isArray(livro.tags) ? livro.tags : [],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    dataInicio: null,
    dataFim: null
  });

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
        <p class="text-xs text-cozy-muted">Não consegui montar as sugestões. Tente novamente.</p>
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

  container.innerHTML = `
    <div class="text-center mb-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase">ReadMatch</span>
      <h3 class="font-serif text-base font-bold text-stone-800">Livros que combinam com você</h3>
      <p class="text-[11px] text-cozy-muted mt-1">
        A pontuação usa suas respostas e os dados disponíveis sobre cada livro.
      </p>
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
                ${livro.jaNaEstante ? 'Já está na sua estante' : 'Sugestão de leitura'}
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
            </div>` : ''}

          ${livro.novidade && !livro.jaNaEstante ? `
            <button type="button" onclick="adicionarRecomendacaoPorIndice(${idx})"
              class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-1.5 rounded-lg text-[11px]">
              + Adicionar à estante
            </button>` : ''}
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
