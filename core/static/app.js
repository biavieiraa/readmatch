
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

let biblioteca = carregarBiblioteca();
let metaLeitura = Number(localStorage.getItem(CHAVE_META)) || 12;

function salvarStorage() {
  localStorage.setItem(getChaveStorage(), JSON.stringify(biblioteca));
}

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
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
  return biblioteca.some(
    livro => normalizar(livro.titulo) === normalizar(titulo)
  );
}

// ============================================================
// LOGIN
// ============================================================

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
  const nomeCampo = document.getElementById('login-nome')?.value.trim();

  if (!email || !senha) {
    alert('Preencha o e-mail e a senha.');
    return;
  }

  if (!email.includes('@')) {
    alert('Digite um e-mail válido.');
    return;
  }

  const usuarios = JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || [];
  const usuario = usuarios.find(u => u.email === email);

  if (!usuario) {
    const nome = nomeCampo || email.split('@')[0];
    usuarios.push({ nome, email, senha });
    localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
    usuarioAtual = { nome, email };
  } else {
    if (usuario.senha !== senha) {
      alert('Senha incorreta.');
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
  const indice = usuarios.findIndex(
    u => u.email === email.trim().toLowerCase()
  );

  if (indice === -1) {
    alert('Nenhum usuário encontrado com esse e-mail.');
    return;
  }

  const novaSenha = prompt('Digite sua nova senha:');
  if (!novaSenha || !novaSenha.trim()) return;

  usuarios[indice].senha = novaSenha.trim();
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
  const elemento = document.getElementById('info-usuario-header');
  if (!elemento) return;

  if (usuarioAtual) {
    elemento.innerHTML = `
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
    elemento.innerHTML = `
      <button type="button" onclick="abrirModalLogin()"
        class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm">
        Entrar / Cadastrar
      </button>`;
  }
}

// ============================================================
// META DE LEITURA
// ============================================================

function atualizarMeta() {
  const lidos = biblioteca.filter(l => l.status === 'lido').length;
  const porcentagem = metaLeitura > 0
    ? Math.min(Math.round((lidos / metaLeitura) * 100), 100)
    : 0;

  const progresso = document.getElementById('meta-progresso');
  const percentual = document.getElementById('meta-porcentagem');
  const barra = document.getElementById('meta-barra');
  const mensagem = document.getElementById('meta-mensagem');

  if (progresso) progresso.innerText = `${lidos} de ${metaLeitura} livros`;
  if (percentual) percentual.innerText = `${porcentagem}% concluído`;
  if (barra) barra.style.width = `${porcentagem}%`;

  if (mensagem) {
    mensagem.innerText = lidos >= metaLeitura
      ? 'Parabéns! Você alcançou sua meta do ano.'
      : `Faltam ${metaLeitura - lidos} livro(s) para atingir sua meta.`;
  }
}

function alterarMeta() {
  const valor = prompt('Qual é sua nova meta anual?', metaLeitura);
  if (valor === null || valor.trim() === '') return;

  const numero = Number(valor);

  if (Number.isFinite(numero) && numero > 0) {
    metaLeitura = Math.floor(numero);
    localStorage.setItem(CHAVE_META, String(metaLeitura));
    atualizarMeta();
  } else {
    alert('Digite um número maior que zero.');
  }
}

// ============================================================
// ESTANTE
// ============================================================

function filtrarEstante(status) {
  filtroAtual = status;

  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.className =
      'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer text-stone-600 hover:bg-stone-100';
  });

  const ativo = document.getElementById(`btn-filtro-${status}`);

  if (ativo) {
    ativo.className =
      'btn-filtro px-3 py-1 rounded-lg transition cursor-pointer bg-blush-500 text-white font-semibold';
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
        <p class="text-xs text-cozy-muted font-medium">
          Sua estante está vazia nesta categoria.
        </p>
        <button type="button" onclick="abrirModalCadastro()"
          class="text-xs text-blush-600 font-bold hover:underline cursor-pointer">
          Adicionar o primeiro livro
        </button>
      </div>`;
    return;
  }

  const statusHTML = {
    quero_ler: '<span class="bg-purple-50 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">Quero Ler</span>',
    lendo: '<span class="bg-pink-50 text-blush-600 text-[10px] px-2 py-0.5 rounded-full">Lendo</span>',
    lido: '<span class="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">Lido</span>',
    abandonado: '<span class="bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded-full">Abandonado</span>'
  };

  container.innerHTML = livros.map(livro => {
    const atual = Number(livro.paginaAtual) || 0;
    const total = Math.max(1, Number(livro.paginas) || 1);
    const percentual = Math.min(100, Math.round(atual / total * 100));
    const id = escaparHTML(livro.id);

    return `
      <div onclick="abrirDetalhes('${id}')"
        class="bg-white p-2.5 rounded-xl border border-blush-100 shadow-sm hover:shadow transition relative group cursor-pointer flex flex-col justify-between">
        <button type="button" onclick="deletarLivro(event, '${id}')"
          title="Excluir"
          class="absolute top-2 right-2 bg-stone-900/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition z-10">
          ✕
        </button>

        <div>
          <div class="aspect-[2/3] w-full bg-stone-100 rounded-lg overflow-hidden mb-2.5 relative">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
              alt="${escaparHTML(livro.titulo)}"
              class="w-full h-full object-cover"
              onerror="this.onerror=null;this.src='${CAPA_PADRAO}';">
            ${livro.favorito
              ? '<span class="absolute bottom-1.5 left-1.5 text-[10px] bg-white text-blush-600 px-1.5 py-0.5 rounded">Favorito ♥</span>'
              : ''}
          </div>

          <div class="mb-1 flex items-center justify-between">
            ${statusHTML[livro.status] || ''}
            ${Number(livro.nota) > 0
              ? `<span class="text-[11px] font-bold text-amber-600">${livro.nota}/5</span>`
              : ''}
          </div>

          <h4 class="font-serif font-bold text-xs text-stone-800 line-clamp-1">
            ${escaparHTML(livro.titulo)}
          </h4>
          <p class="text-[11px] text-cozy-muted truncate">
            ${escaparHTML(livro.autor)}
          </p>

          ${livro.status === 'lendo' ? `
            <div class="mt-2.5 pt-2 border-t border-stone-100 space-y-1">
              <div class="flex justify-between text-[10px] text-cozy-muted">
                <span>Pág. ${atual} / ${total}</span>
                <span class="font-bold text-blush-600">${percentual}%</span>
              </div>
              <div class="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blush-500 h-full rounded-full"
                  style="width:${percentual}%"></div>
              </div>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// BUSCA E CADASTRO DE LIVROS
// ============================================================

function abrirModalCadastro() {
  document.getElementById('modal-cadastro')?.classList.remove('hidden');
}

function fecharModalCadastro() {
  document.getElementById('modal-cadastro')?.classList.add('hidden');

  const container = document.getElementById('container-resultados');
  if (container) {
    container.innerHTML =
      '<p class="text-xs text-cozy-muted text-center py-8">Digite o nome de um livro para pesquisar.</p>';
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
    genero: categorias[0]?.split('/')[0]?.trim() || '',
    capa,
    descricao: info.description || '',
    tags: categorias.flatMap(c => c.split(/[\/,]/)).map(normalizar)
  };
}

async function buscarLivrosAPI(e) {
  if (e) e.preventDefault();

  const input = document.getElementById('input-busca-api');
  const query = input?.value.trim() || '';
  const container = document.getElementById('container-resultados');
  const botao = document.getElementById('btn-buscar-api');

  if (!query) {
    alert('Digite o nome de um livro ou autor.');
    return;
  }

  if (botao) {
    botao.innerText = 'Buscando...';
    botao.disabled = true;
  }

  if (container) {
    container.innerHTML =
      '<p class="text-xs text-cozy-muted text-center py-8">Pesquisando...</p>';
  }

  resultadosBuscaAPI = [];

  try {
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`
    );

    if (resposta.ok) {
      const dados = await resposta.json();
      resultadosBuscaAPI = (dados.items || []).map(normalizarLivroAPI);
    }
  } catch (erro) {
    console.warn('Google Books indisponível:', erro);
  }

  if (!resultadosBuscaAPI.length) {
    try {
      const resposta = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`
      );

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
      console.error('Open Library indisponível:', erro);
    }
  }

  if (container) {
    if (!resultadosBuscaAPI.length) {
      container.innerHTML = `
        <p class="text-xs text-stone-600 text-center py-8">
          Nenhum livro encontrado. Tente outro termo.
        </p>`;
    } else {
      container.innerHTML = resultadosBuscaAPI.map((livro, index) => `
        <div class="flex items-center gap-3 p-2 bg-stone-50 rounded-xl border border-stone-200">
          <img src="${escaparHTML(livro.capa)}"
            class="w-10 h-14 object-cover rounded"
            onerror="this.onerror=null;this.src='${CAPA_PADRAO}';">

          <div class="flex-1 min-w-0">
            <h5 class="font-serif font-bold text-xs truncate">
              ${escaparHTML(livro.titulo)}
            </h5>
            <p class="text-[11px] text-cozy-muted truncate">
              ${escaparHTML(livro.autor)}
            </p>
            <span class="text-[10px] text-stone-600">
              ${livro.paginas || '?'} páginas · ${escaparHTML(livro.genero || 'Gênero não informado')}
            </span>
          </div>

          <button type="button" onclick="selecionarLivroAPI(${index})"
            class="bg-blush-500 text-white text-xs px-3 py-1.5 rounded-lg">
            Adicionar
          </button>
        </div>`).join('');
    }
  }

  if (botao) {
    botao.innerText = 'Buscar';
    botao.disabled = false;
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

// ============================================================
// DETALHES, PROGRESSO E AVALIAÇÃO
// ============================================================

function abrirDetalhes(id) {
  const livro = biblioteca.find(l => String(l.id) === String(id));
  if (!livro) return;

  const container = document.getElementById('detalhes-container');
  document.getElementById('modal-detalhes')?.classList.remove('hidden');
  if (!container) return;

  const paginas = Number(livro.paginas) || 0;
  const atual = Number(livro.paginaAtual) || 0;
  const percentual = paginas > 0 ? Math.min(100, Math.round(atual / paginas * 100)) : 0;
  const experiencia = livro.experiencia || { emocionei: 0, presa: 0, pensei: 0 };
  const tags = Array.isArray(livro.tags) ? livro.tags.join(', ') : '';

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-4 mb-4">
      <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
        class="w-28 h-40 object-cover rounded-xl shadow-md mx-auto sm:mx-0"
        onerror="this.onerror=null;this.src='${CAPA_PADRAO}';">

      <div class="space-y-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold text-blush-500 bg-blush-50 px-2 py-0.5 rounded">
            ${escaparHTML(livro.genero || 'Gênero não informado')}
          </span>
          <button type="button" onclick="toggleFavorito('${escaparHTML(livro.id)}')"
            class="text-xs border px-2.5 py-1 rounded-lg">
            ${livro.favorito ? 'Favoritado ♥' : '♡ Favoritar'}
          </button>
        </div>

        <h3 class="font-serif text-lg font-bold text-stone-800">
          ${escaparHTML(livro.titulo)}
        </h3>
        <p class="text-xs text-cozy-muted">
          ${escaparHTML(livro.autor)} · ${paginas || '?'} páginas
        </p>

        ${livro.descricao
          ? `<p class="text-xs text-stone-600">${escaparHTML(livro.descricao.slice(0, 500))}</p>`
          : ''}

        <label class="block text-xs font-semibold">Status:</label>
        <select id="detalhes-status"
          onchange="atualizarStatus('${escaparHTML(livro.id)}',this.value)"
          class="bg-stone-50 border rounded-lg p-1.5 text-xs w-full">
          <option value="quero_ler" ${livro.status === 'quero_ler' ? 'selected' : ''}>Quero Ler</option>
          <option value="lendo" ${livro.status === 'lendo' ? 'selected' : ''}>Lendo</option>
          <option value="lido" ${livro.status === 'lido' ? 'selected' : ''}>Lido</option>
          <option value="abandonado" ${livro.status === 'abandonado' ? 'selected' : ''}>Abandonado</option>
        </select>
      </div>
    </div>

    <div class="bg-blush-50/60 p-3.5 rounded-xl border space-y-2 ${livro.status === 'lendo' ? '' : 'hidden'}">
      <div class="flex justify-between text-xs font-semibold">
        <span>Progresso de leitura</span>
        <span id="label-porcentagem">${percentual}%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs">Página</span>
        <input type="number" id="input-pagina-atual" value="${atual}" min="0"
          ${paginas ? `max="${paginas}"` : ''}
          oninput="alterarPaginaAoVivo('${escaparHTML(livro.id)}',this.value)"
          class="border rounded-lg p-1.5 text-xs w-20">
        <span class="text-xs">de ${paginas || '?'}</span>
      </div>
    </div>

    <div class="bg-stone-50 p-4 rounded-xl border space-y-3 mt-3">
      <h4 class="font-serif font-bold text-xs">Minha experiência</h4>

      <label class="block text-xs font-semibold">Nota geral</label>
      <select id="exp-nota" class="bg-white border rounded-lg p-1 text-xs">
        ${[0,1,2,3,4,5].map(n => `
          <option value="${n}" ${Number(livro.nota) === n ? 'selected' : ''}>
            ${n === 0 ? 'Sem nota' : `${n} / 5`}
          </option>`).join('')}
      </select>

      <label class="block text-xs font-semibold">Quanto me emocionei? (0–5)</label>
      <input id="exp-emocionei" type="number" min="0" max="5"
        value="${Number(experiencia.emocionei) || 0}" class="bg-white border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Quanto fiquei presa à história? (0–5)</label>
      <input id="exp-presa" type="number" min="0" max="5"
        value="${Number(experiencia.presa) || 0}" class="bg-white border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Quanto fiquei pensando nela depois? (0–5)</label>
      <input id="exp-pensei" type="number" min="0" max="5"
        value="${Number(experiencia.pensei) || 0}" class="bg-white border rounded-lg p-1.5 text-xs w-full">

      <label class="block text-xs font-semibold">Tags (separadas por vírgula)</label>
      <input id="exp-tags" value="${escaparHTML(tags)}"
        placeholder="romance, emocionante, slow burn"
        class="bg-white border rounded-lg p-1.5 text-xs w-full">

      <button type="button" onclick="salvarExperiencia('${escaparHTML(livro.id)}')"
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

  const percentual = Number(livro.paginas) > 0
    ? Math.min(100, Math.round(pagina / Number(livro.paginas) * 100))
    : 0;

  const label = document.getElementById('label-porcentagem');
  if (label) label.innerText = `${percentual}%`;

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

function atualizarStatus(id, status) {
  const livro = biblioteca.find(l => String(l.id) === String(id));
  if (!livro) return;

  const anterior = livro.status;
  livro.status = status;

  if (status === 'lendo' && !livro.dataInicio) {
    livro.dataInicio = new Date().toISOString();
  }

  if (status === 'lido') {
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

  const obterNota = campo =>
    Math.max(0, Math.min(5, Number(document.getElementById(campo)?.value) || 0));

  livro.nota = obterNota('exp-nota');
  livro.experiencia = {
    emocionei: obterNota('exp-emocionei'),
    presa: obterNota('exp-presa'),
    pensei: obterNota('exp-pensei')
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

// ============================================================
// SORTEIO
// ============================================================

function escolherPorMim() {
  const naoLidos = biblioteca.filter(l => l.status === 'quero_ler');
  const lista = naoLidos.length
    ? naoLidos
    : biblioteca.filter(l => l.status !== 'lido');

  if (!lista.length) {
    alert('Adicione livros à sua estante para sortear uma leitura.');
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
        <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
          class="w-24 h-36 object-cover rounded-md shadow mb-2"
          onerror="this.onerror=null;this.src='${CAPA_PADRAO}';">
        <h4 class="font-serif font-bold text-sm">${escaparHTML(livro.titulo)}</h4>
        <p class="text-xs text-cozy-muted">${escaparHTML(livro.autor)}</p>
      </div>
      <button type="button" onclick="fecharQuiz()"
        class="w-full bg-blush-500 text-white py-2 rounded-lg text-xs">
        Escolher este livro
      </button>
    </div>`;
}

// ============================================================
// MATCH — PERSONALIZAÇÃO PELO HISTÓRICO DE LEITURA
// ============================================================

const TAGS_POR_VIBE = {
  leve: ['leve', 'divertido', 'confortavel', 'fofo', 'feel good', 'comedia', 'romance leve'],
  emocionante: ['emocionante', 'triste', 'drama', 'emocao', 'chorar', 'luto', 'familia', 'melancolico'],
  presa: ['envolvente', 'ritmo rapido', 'rapido', 'suspense', 'plot twist', 'viciante', 'misterio'],
  pensar: ['reflexivo', 'filosofico', 'complexo', 'existencial', 'introspectivo'],
  romance: ['romance', 'amor', 'relacionamento', 'slow burn', 'enemies to lovers', 'friends to lovers']
};

function pontuarVibe(livro, vibe) {
  const tags = (livro.tags || []).map(normalizar);
  const texto = normalizar(
    `${livro.genero || ''} ${livro.titulo || ''} ${livro.descricao || ''} ${tags.join(' ')}`
  );
  const pistas = TAGS_POR_VIBE[vibe] || [];

  if (!texto.trim() || !pistas.length) return null;

  const encontrados = pistas.filter(p => texto.includes(normalizar(p)));
  return encontrados.length
    ? Math.min(1, encontrados.length / 2)
    : 0;
}

function pontuarGenero(livro, generoDesejado) {
  const desejado = normalizar(generoDesejado);
  if (!desejado || desejado === 'qualquer') return null;

  const genero = normalizar(livro.genero);
  const tags = (livro.tags || []).map(normalizar);

  if (!genero && !tags.length) return null;

  if (genero === desejado || genero.includes(desejado) || desejado.includes(genero)) {
    return 1;
  }

  if (tags.some(t => t === desejado || t.includes(desejado) || desejado.includes(t))) {
    return 1;
  }

  const grupos = {
    romance: ['romance', 'ficcao romantica', 'romantic'],
    drama: ['drama', 'literatura'],
    ficcao: ['ficcao', 'fantasia', 'ficcao cientifica', 'distopia'],
    suspense: ['suspense', 'misterio', 'thriller', 'crime']
  };

  const familia = grupos[desejado] || [desejado];

  if (familia.some(t => genero.includes(t) || tags.some(tag => tag.includes(t)))) {
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

// Extrai características que podem ser comparadas entre livros.
function extrairCaracteristicasLivro(livro) {
  const tags = Array.isArray(livro.tags) ? livro.tags : [];
  const genero = normalizar(livro.genero || '');
  const descricao = normalizar(livro.descricao || '');

  const ignorar = new Set([
    'book', 'books', 'fiction', 'ficcao', 'literature',
    'literatura', 'novel', 'novels', 'general', 'geral'
  ]);

  const tagsLimpa = tags
    .map(normalizar)
    .filter(t => t && t.length > 2 && !ignorar.has(t));

  const palavrasDescricao = descricao
    .split(/[^a-z0-9]+/)
    .filter(p => p.length >= 4 && !ignorar.has(p));

  return {
    genero,
    tags: [...new Set(tagsLimpa)],
    palavras: [...new Set([...tagsLimpa, ...palavrasDescricao])]
  };
}

function similaridadeLivros(livroA, livroB) {
  const a = extrairCaracteristicasLivro(livroA);
  const b = extrairCaracteristicasLivro(livroB);

  let soma = 0;
  let peso = 0;

  if (a.genero && b.genero) {
    let afinidade = 0;

    if (
      a.genero === b.genero ||
      a.genero.includes(b.genero) ||
      b.genero.includes(a.genero)
    ) {
      afinidade = 1;
    } else {
      const grupos = [
        ['romance', 'romantic', 'love'],
        ['fantasy', 'fantasia', 'science fiction', 'ficcao cientifica', 'distopia'],
        ['mystery', 'misterio', 'thriller', 'suspense', 'crime'],
        ['drama', 'literary fiction', 'ficcao literaria'],
        ['young adult', 'adolescente']
      ];

      if (grupos.some(g =>
        g.some(t => a.genero.includes(t)) &&
        g.some(t => b.genero.includes(t))
      )) {
        afinidade = 0.6;
      }
    }

    soma += afinidade * 0.55;
    peso += 0.55;
  }

  const tagsA = new Set(a.palavras);
  const tagsB = new Set(b.palavras);

  if (tagsA.size && tagsB.size) {
    let comuns = 0;
    for (const tag of tagsA) {
      if (tagsB.has(tag)) comuns++;
    }

    const jaccard = comuns / Math.max(1, tagsA.size + tagsB.size - comuns);
    const cobertura = comuns / Math.max(1, Math.min(tagsA.size, tagsB.size));

    soma += Math.max(jaccard, cobertura * 0.7) * 0.45;
    peso += 0.45;
  }

  return peso ? Math.max(0, Math.min(1, soma / peso)) : null;
}

// Usa as notas anteriores para estimar o perfil literário da pessoa.
function pontuarPerfil(livro, bibliotecaUsuario) {
  const avaliados = bibliotecaUsuario.filter(l =>
    l.status === 'lido' && Number(l.nota) >= 1 && Number(l.nota) <= 5
  );

  if (!avaliados.length) return null;

  const caracteristicas = extrairCaracteristicasLivro(livro);
  if (!caracteristicas.genero && !caracteristicas.tags.length && !caracteristicas.palavras.length) {
    return null;
  }

  let saldo = 0;
  let pesoTotal = 0;

  for (const avaliado of avaliados) {
    const nota = Number(avaliado.nota);
    const similaridade = similaridadeLivros(livro, avaliado);

    if (similaridade === null || nota === 3) continue;

    if (nota > 3) {
      const peso = (nota - 3) * 1.25;
      saldo += similaridade * peso;
      pesoTotal += peso;
    } else {
      const peso = (3 - nota) * 0.8;
      saldo -= similaridade * peso;
      pesoTotal += peso;
    }
  }

  // Se a pessoa costuma gostar de determinado gênero, isso também pesa.
  if (caracteristicas.genero) {
    const mesmoGenero = avaliados.filter(l => {
      const g = normalizar(l.genero || '');
      return g && (
        g === caracteristicas.genero ||
        g.includes(caracteristicas.genero) ||
        caracteristicas.genero.includes(g)
      );
    });

    if (mesmoGenero.length) {
      const media = mesmoGenero.reduce((s, l) => s + Number(l.nota), 0) / mesmoGenero.length;
      const afinidade = Math.max(0, Math.min(1, (media - 1) / 4));

      saldo += (afinidade - 0.5) * 1.5;
      pesoTotal += 1.5;
    }
  }

  if (!pesoTotal) return null;

  // É uma pontuação relativa de compatibilidade, não uma probabilidade científica.
  return Math.round(Math.max(0.05, Math.min(0.98, 0.5 + (saldo / pesoTotal) * 0.48)) * 100) / 100;
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

  const pesoTotal = disponiveis.reduce((s, c) => s + c.peso, 0);
  const pontos = disponiveis.reduce((s, c) => s + c.valor * c.peso, 0);
  const motivos = [];

  if (perfil !== null) {
    const avaliados = livrosUsuario.filter(l =>
      l.status === 'lido' && Number(l.nota) > 0
    );

    const semelhantes = avaliados
      .map(l => ({
        livro: l,
        similaridade: similaridadeLivros(livro, l)
      }))
      .filter(x => x.similaridade !== null)
      .sort((a, b) => b.similaridade - a.similaridade)[0];

    if (
      semelhantes &&
      semelhantes.similaridade >= 0.15 &&
      Number(semelhantes.livro.nota) >= 4
    ) {
      motivos.push(
        `Tem características em comum com "${semelhantes.livro.titulo}", que você avaliou com ${semelhantes.livro.nota}/5`
      );
    } else if (perfil >= 0.65) {
      motivos.push('Combina com tendências das suas avaliações anteriores');
    } else if (perfil < 0.4) {
      motivos.push('Tem menos características em comum com os livros que você avaliou melhor');
    }
  }

  for (const c of disponiveis) {
    if (c.nome === 'seu momento' && c.valor >= 0.65) {
      motivos.push('Pode combinar com o tipo de leitura que você procura agora');
    }

    if (c.nome === 'gênero escolhido' && c.valor >= 0.65) {
      motivos.push(`Combina com o gênero ${respostasQuiz.genero}`);
    }

    if (c.nome === 'tamanho do livro' && c.valor >= 0.65) {
      motivos.push('O número de páginas combina com o tamanho escolhido');
    }
  }

  return {
    porcentagem: Math.round(pontos / pesoTotal * 100),
    motivos: [...new Set(motivos)]
  };
}

// ============================================================
// PERGUNTAS DO MATCH
// ============================================================

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
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 1 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">
        Que tipo de leitura você procura?
      </h3>
      <div class="space-y-2">
        <button type="button" onclick="selecionarOpcao('vibe','leve',2)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Leve, sem muita carga emocional</span>
        </button>
        <button type="button" onclick="selecionarOpcao('vibe','emocionante',2)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Emocionante, quero me envolver com a história</span>
        </button>
        <button type="button" onclick="selecionarOpcao('vibe','presa',2)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Uma história que prenda minha atenção</span>
        </button>
        <button type="button" onclick="selecionarOpcao('vibe','pensar',2)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Uma história que me faça refletir</span>
        </button>
        <button type="button" onclick="selecionarOpcao('vibe','romance',2)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Uma história de amor ou relacionamentos</span>
        </button>
      </div>`;
  } else if (etapaAtual === 2) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 2 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">
        Qual tamanho de livro você prefere?
      </h3>
      <div class="space-y-2">
        <button type="button" onclick="selecionarOpcao('tempo','curto',3)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Curto — até 280 páginas</span>
        </button>
        <button type="button" onclick="selecionarOpcao('tempo','medio',3)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Médio — cerca de 300 a 450 páginas</span>
        </button>
        <button type="button" onclick="selecionarOpcao('tempo','qualquer',3)" class="w-full p-2.5 border rounded-xl text-left hover:border-blush-400">
          <span class="block font-semibold text-xs">Sem preferência de tamanho</span>
        </button>
      </div>`;
  } else if (etapaAtual === 3) {
    const generos = [
      'Romance', 'Drama', 'Ficção', 'Suspense',
      'Fantasia', 'Young Adult', 'Não ficção', 'Qualquer'
    ];

    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase">Passo 3 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">
        Qual gênero você quer ler?
      </h3>
      <div class="grid grid-cols-2 gap-2">
        ${generos.map(g => `
          <button type="button" onclick="finalizarQuiz('${g}')"
            class="p-2.5 border rounded-xl font-semibold text-xs hover:border-blush-400">
            ${g}
          </button>`).join('')}
      </div>`;
  }
}

function selecionarOpcao(chave, valor, proximaEtapa) {
  respostas[chave] = valor;
  etapaAtual = proximaEtapa;
  renderizarEtapa();
}

// ============================================================
// BUSCA EXTERNA DE LIVROS
// ============================================================

function normalizarResultadoGoogle(item) {
  const info = item.volumeInfo || {};
  let capa = info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    CAPA_PADRAO;

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
    tags: categorias.flatMap(c => c.split(/[\/,]/)).map(normalizar),
    novidade: true
  };
}

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

  // Usa gêneros e tags dos livros que a pessoa avaliou bem para
  // deixar a própria busca mais relevante para aquele perfil.
  const avaliadosBem = livrosUsuario
    .filter(l => l.status === 'lido' && Number(l.nota) >= 4)
    .sort((a, b) => Number(b.nota) - Number(a.nota));

  const generosPreferidos = [
    ...new Set(avaliadosBem.map(l => String(l.genero || '').trim()).filter(Boolean))
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

  let livros = [];

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(consulta)}&maxResults=40&orderBy=relevance`;
    const resposta = await fetch(url);

    if (resposta.ok) {
      const dados = await resposta.json();
      livros = (dados.items || [])
        .map(normalizarResultadoGoogle)
        .filter(l => l.titulo);
    }
  } catch (erro) {
    console.warn('Google Books indisponível:', erro);
  }

  if (livros.length < 10) {
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(consulta)}&limit=40`;
      const resposta = await fetch(url);

      if (resposta.ok) {
        const dados = await resposta.json();

        const complementares = (dados.docs || []).map(doc => {
          const assuntos = Array.isArray(doc.subject) ? doc.subject : [];

          return {
            id: `openlibrary-${doc.key || doc.title}`,
            titulo: doc.title || '',
            autor: doc.author_name?.join(', ') || 'Autor desconhecido',
            paginas: Number(doc.number_of_pages_median) > 0
              ? Number(doc.number_of_pages_median)
              : null,
            genero: assuntos[0] || '',
            capa: doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : CAPA_PADRAO,
            descricao: assuntos.slice(0, 8).join(', '),
            tags: assuntos.map(normalizar),
            novidade: true
          };
        }).filter(l => l.titulo);

        livros = [...livros, ...complementares];
      }
    } catch (erro) {
      console.warn('Open Library indisponível:', erro);
    }
  }

  // Remove títulos repetidos entre as APIs.
  const vistos = new Set();

  return livros.filter(livro => {
    const titulo = normalizar(livro.titulo);
    if (!titulo || vistos.has(titulo)) return false;
    vistos.add(titulo);
    return true;
  });
}

// ============================================================
// RESULTADOS DO MATCH
// ============================================================

async function finalizarQuiz(genero) {
  respostas.genero = genero;

  const container = document.getElementById('quiz-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-10 space-y-3">
      <div class="w-6 h-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-cozy-muted">Buscando livros para o seu perfil...</p>
    </div>`;

  try {
    const externos = await buscarRecomendacoesExternas(genero, biblioteca);

    // Exclui qualquer livro que já esteja na estante do usuário.
    const novos = externos.filter(l =>
      l.titulo && !tituloJaExiste(l.titulo)
    );

    const candidatos = novos.map(livro => {
      const resultado = calcularMatch(livro, respostas, biblioteca);

      return {
        ...livro,
        match: resultado.porcentagem ?? 50,
        motivos: resultado.motivos,
        novidade: true
      };
    });

    // Primeiro os livros mais compatíveis com as notas e preferências.
    candidatos.sort((a, b) => b.match - a.match);
    exibirResultado(candidatos.slice(0, 3));
  } catch (erro) {
    console.error('Erro ao gerar o Match:', erro);
    exibirResultado([]);
  }
}

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
    experiencia: { emocionei: 0, presa: 0, pensei: 0 },
    dataInicio: null,
    dataFim: null
  });

  salvarStorage();
  renderizarEstante();
  alert('Livro adicionado à sua estante!');
  fecharQuiz();
}

function exibirResultado(livros) {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  recomendacoesQuizAtuais = livros || [];

  if (!recomendacoesQuizAtuais.length) {
    container.innerHTML = `
      <div class="text-center py-6 space-y-3">
        <p class="text-xs text-cozy-muted">
          Não consegui buscar sugestões agora. Confira sua conexão e tente novamente.
        </p>
        <button type="button" onclick="iniciarQuiz()"
          class="w-full bg-blush-500 text-white py-2 rounded-lg text-xs">
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
      <h3 class="font-serif text-base font-bold text-stone-800">
        Sugestões para sua próxima leitura
      </h3>
      <p class="text-[11px] text-cozy-muted mt-1">
        A compatibilidade considera suas respostas e suas avaliações anteriores.
      </p>
    </div>

    <div class="space-y-2.5 max-h-96 overflow-y-auto custom-scroll pr-1">
      ${recomendacoesQuizAtuais.map((livro, index) => `
        <div class="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div class="flex gap-3 items-center">
            <img src="${escaparHTML(livro.capa || CAPA_PADRAO)}"
              class="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
              onerror="this.onerror=null;this.src='${CAPA_PADRAO}';">

            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <h4 class="font-serif font-bold text-stone-800 text-xs">
                  ${escaparHTML(livro.titulo)}
                </h4>
                <span class="bg-blush-100 text-blush-600 font-bold text-[10px] px-2 py-0.5 rounded-full">
                  ${livro.match}% Match
                </span>
              </div>

              <p class="text-[11px] text-cozy-muted">
                ${escaparHTML(livro.autor)}
              </p>
              <span class="text-[9px] text-amber-700 bg-amber-50 border px-1.5 py-0.5 rounded inline-block mt-1">
                Livro novo para sua estante
              </span>
              <p class="text-[10px] text-stone-500 mt-1">
                ${livro.paginas || '?'} páginas · ${escaparHTML(livro.genero || 'Gênero não informado')}
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

          <button type="button" onclick="adicionarRecomendacaoPorIndice(${index})"
            class="w-full bg-blush-500 hover:bg-blush-600 text-white py-1.5 rounded-lg text-[11px]">
            + Adicionar à estante
          </button>
        </div>`).join('')}
    </div>

    <button type="button" onclick="fecharQuiz()"
      class="w-full mt-3 bg-stone-100 text-stone-700 py-2 rounded-lg text-xs">
      Fechar
    </button>`;
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  atualizarHeaderUsuario();
  filtrarEstante('todos');

  if (!usuarioAtual) {
    abrirModalLogin();
  }
});
