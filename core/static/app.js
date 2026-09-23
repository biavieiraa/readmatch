// --- SISTEMA DE AUTENTICAÇÃO E USUÁRIOS ---
let usuarioAtual = JSON.parse(localStorage.getItem('readmatch_usuario_atual')) || null;

function getChaveStorage() {
  return usuarioAtual ? `readmatch_livros_${usuarioAtual.email}` : 'readmatch_livros_visitante';
}

function carregarBiblioteca() {
  const chave = getChaveStorage();
  return JSON.parse(localStorage.getItem(chave)) || [
    {
      id: "1",
      titulo: "A Hipótese do Amor",
      autor: "Ali Hazelwood",
      paginas: 336,
      paginaAtual: 336,
      genero: "Romance",
      tags: ["leve", "romance"],
      capa: "https://m.media-amazon.com/images/I/81+2u4U183L._AC_UF1000,1000_QL80_.jpg",
      status: "lido",
      favorito: true,
      nota: 5,
      experiencia: { emocionei: 4, presa: 5, pensei: 3 }
    },
    {
      id: "2",
      titulo: "Os Sete Maridos de Evelyn Hugo",
      autor: "Taylor Jenkins Reid",
      paginas: 360,
      paginaAtual: 180,
      genero: "Drama",
      tags: ["emocionante", "drama"],
      capa: "https://m.media-amazon.com/images/I/81xUe7v+GSL._AC_UF1000,1000_QL80_.jpg",
      status: "lendo",
      favorito: true,
      nota: 0,
      experiencia: { emocionei: 0, presa: 0, pensei: 0 }
    }
  ];
}

let biblioteca = carregarBiblioteca();
let metaLeitura = Number(localStorage.getItem('readmatch_meta')) || 12;
let filtroAtual = 'todos';
let resultadosBuscaAPI = [];

function salvarStorage() {
  localStorage.setItem(getChaveStorage(), JSON.stringify(biblioteca));
}

// --- FUNÇÕES DE LOGIN, CADASTRO E RECUPERAÇÃO ---
function abrirModalLogin() {
  const modal = document.getElementById('modal-login');
  if (modal) modal.classList.remove('hidden');
}

function fecharModalLogin() {
  const modal = document.getElementById('modal-login');
  if (modal) modal.classList.add('hidden');
}

function autenticarUsuario(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value.trim();
  const nome = document.getElementById('login-nome')?.value.trim() || email.split('@')[0];

  if (!email || !senha) {
    alert("Por favor, preencha e-mail e senha.");
    return;
  }

  const usuarios = JSON.parse(localStorage.getItem('readmatch_usuarios_cadastrados')) || [];
  let user = usuarios.find(u => u.email === email);

  if (!user) {
    user = { nome, email, senha };
    usuarios.push(user);
    localStorage.setItem('readmatch_usuarios_cadastrados', JSON.stringify(usuarios));
  } else if (user.senha !== senha) {
    alert("Senha incorreta!");
    return;
  }

  usuarioAtual = { nome: user.nome, email: user.email };
  localStorage.setItem('readmatch_usuario_atual', JSON.stringify(usuarioAtual));
  
  biblioteca = carregarBiblioteca();
  atualizarHeaderUsuario();
  renderizarEstante();
  fecharModalLogin();
}

function esqueciSenha() {
  const emailInput = document.getElementById('login-email')?.value.trim().toLowerCase();
  const email = prompt("Digite o e-mail cadastrado para redefinir a senha:", emailInput || "");
  
  if (!email) return;

  const usuarios = JSON.parse(localStorage.getItem('readmatch_usuarios_cadastrados')) || [];
  const index = usuarios.findIndex(u => u.email === email.trim().toLowerCase());

  if (index !== -1) {
    const novaSenha = prompt(`Usuário "${usuarios[index].nome}" encontrado!\nDigite sua nova senha:`);
    if (novaSenha && novaSenha.trim() !== "") {
      usuarios[index].senha = novaSenha.trim();
      localStorage.setItem('readmatch_usuarios_cadastrados', JSON.stringify(usuarios));
      alert("Senha alterada com sucesso! Agora você já pode entrar com a nova senha.");
    }
  } else {
    alert("Nenhum usuário cadastrado com este e-mail.");
  }
}

function fazerLogout() {
  localStorage.removeItem('readmatch_usuario_atual');
  usuarioAtual = null;
  biblioteca = carregarBiblioteca();
  atualizarHeaderUsuario();
  renderizarEstante();
}

function atualizarHeaderUsuario() {
  const elUser = document.getElementById('info-usuario-header');
  if (elUser) {
    if (usuarioAtual) {
      elUser.innerHTML = `
        <div class="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl">
          <span class="text-xs font-semibold text-stone-700">Olá, <b>${usuarioAtual.nome}</b></span>
          <button onclick="fazerLogout()" class="text-[10px] text-red-500 font-bold hover:underline cursor-pointer">Sair</button>
        </div>
      `;
    } else {
      elUser.innerHTML = `
        <button onclick="abrirModalLogin()" class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm">
          Entrar / Cadastrar
        </button>
      `;
    }
  }
}

// --- ESTANTE E META ---
function atualizarMeta() {
  const lidos = biblioteca.filter(l => l.status === 'lido').length;
  const porcentagem = Math.min(Math.round((lidos / metaLeitura) * 100), 100);
  
  const elProgresso = document.getElementById('meta-progresso');
  const elPorcentagem = document.getElementById('meta-porcentagem');
  const elBarra = document.getElementById('meta-barra');
  const elMensagem = document.getElementById('meta-mensagem');

  if (elProgresso) elProgresso.innerText = `${lidos} de ${metaLeitura} livros`;
  if (elPorcentagem) elPorcentagem.innerText = `${porcentagem}% concluído`;
  if (elBarra) elBarra.style.width = `${porcentagem}%`;

  if (elMensagem) {
    if (lidos >= metaLeitura) {
      elMensagem.innerText = "Parabéns! Você alcançou sua meta do ano.";
    } else {
      const faltam = metaLeitura - lidos;
      elMensagem.innerText = `Faltam ${faltam} livro${faltam > 1 ? 's' : ''} para atingir seu objetivo.`;
    }
  }
}

function alterarMeta() {
  const novaMeta = prompt("Qual é a sua nova meta de leitura para este ano?", metaLeitura);
  if (novaMeta && !isNaN(novaMeta) && Number(novaMeta) > 0) {
    metaLeitura = Number(novaMeta);
    localStorage.setItem('readmatch_meta', metaLeitura);
    atualizarMeta();
  }
}

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
      <div class="col-span-full py-10 text-center">
        <p class="text-xs text-cozy-muted font-medium">Nenhum livro encontrado nesta categoria.</p>
      </div>
    `;
    return;
  }

  const badgeStatus = {
    'quero_ler': '<span class="bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Quero Ler</span>',
    'lendo': '<span class="bg-pink-50 text-blush-600 border border-blush-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Lendo</span>',
    'lido': '<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Lido</span>',
    'abandonado': '<span class="bg-stone-100 text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Abandonado</span>'
  };

  container.innerHTML = livrosExibidos.map(livro => {
    const pagAtual = livro.paginaAtual || 0;
    const totalPag = livro.paginas || 1;
    const porcentagem = Math.min(100, Math.round((pagAtual / totalPag) * 100));

    return `
      <div onclick="abrirDetalhes('${livro.id}')" class="bg-white p-2.5 rounded-xl border border-blush-100 shadow-sm hover:shadow transition relative group cursor-pointer flex flex-col justify-between">
        <button onclick="deletarLivro(event, '${livro.id}')" title="Excluir" class="absolute top-2 right-2 bg-stone-900/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition z-10 flex items-center justify-center">✕</button>
        <div>
          <div class="aspect-[2/3] w-full bg-stone-100 rounded-lg overflow-hidden mb-2.5 relative">
            <img src="${livro.capa}" alt="${livro.titulo}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
            ${livro.favorito ? '<span class="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-white/90 text-blush-600 px-1.5 py-0.5 rounded border border-blush-100 shadow-sm">Favorito</span>' : ''}
          </div>
          <div class="mb-1 flex items-center justify-between">
            ${badgeStatus[livro.status] || ''}
            ${livro.nota > 0 ? `<span class="text-[11px] font-bold text-amber-600">${livro.nota}/5</span>` : ''}
          </div>
          <h4 class="font-serif font-bold text-xs text-stone-800 line-clamp-1 mt-1">${livro.titulo}</h4>
          <p class="text-[11px] text-cozy-muted truncate">${livro.autor}</p>
          ${livro.status === 'lendo' ? `
            <div class="mt-2.5 pt-2 border-t border-stone-100 space-y-1">
              <div class="flex justify-between text-[10px] font-medium text-cozy-muted">
                <span>Pág. ${pagAtual} /${totalPag}</span>
                <span class="font-bold text-blush-600">${porcentagem}%</span>
              </div>
              <div class="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blush-500 h-full rounded-full transition-all" style="width: ${porcentagem}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// --- BUSCA MANUALE ADIÇÃO DE LIVROS ---
function abrirModalCadastro() {
  document.getElementById('modal-cadastro').classList.remove('hidden');
}

function fecharModalCadastro() {
  document.getElementById('modal-cadastro').classList.add('hidden');
  document.getElementById('container-resultados').innerHTML = `<p class="text-xs text-cozy-muted text-center py-8">Digite o nome de um livro acima para pesquisar.</p>`;
  document.getElementById('input-busca-api').value = '';
}

async function buscarLivrosAPI(e) {
  e.preventDefault();
  const query = document.getElementById('input-busca-api').value.trim();
  const container = document.getElementById('container-resultados');
  const btn = document.getElementById('btn-buscar-api');

  if (!query) return;

  btn.innerText = "Buscando...";
  btn.disabled = true;
  resultadosBuscaAPI = [];

  try {
    const resGB = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
    const dataGB = await resGB.json();

    if (dataGB.items && dataGB.items.length > 0) {
      resultadosBuscaAPI = dataGB.items.map(item => {
        const info = item.volumeInfo || {};
        let capa = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || 'https://via.placeholder.com/150x225?text=Sem+Capa';
        return {
          titulo: info.title || 'Sem título',
          autor: info.authors ? info.authors.join(', ') : 'Autor desconhecido',
          paginas: info.pageCount || 280,
          genero: info.categories ? info.categories[0].split('/')[0].trim() : 'Ficção',
          capa: capa.replace('http:', 'https:')
        };
      });
    }

    if (resultadosBuscaAPI.length === 0) {
      container.innerHTML = `<p class="text-xs text-stone-400 text-center py-8">Nenhum resultado encontrado para "${query}".</p>`;
      return;
    }

    container.innerHTML = resultadosBuscaAPI.map((item, index) => `
      <div class="flex items-center gap-3 p-2 bg-stone-50 hover:bg-blush-50/50 rounded-xl border border-stone-200 transition">
        <img src="${item.capa}" class="w-10 h-14 object-cover rounded shadow-sm" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
        <div class="flex-1 min-w-0">
          <h5 class="font-serif font-bold text-xs text-stone-800 truncate">${item.titulo}</h5>
          <p class="text-[11px] text-cozy-muted truncate">${item.autor}</p>
          <span class="text-[10px] bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-600 mt-1 inline-block">${item.paginas} págs • ${item.genero}</span>
        </div>
        <button onclick="selecionarLivroAPI(${index})" class="bg-blush-500 hover:bg-blush-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer">
          Adicionar
        </button>
      </div>
    `).join('');

  } catch (err) {
    console.error("Erro na busca:", err);
    container.innerHTML = `<p class="text-xs text-red-500 text-center py-8">Erro na conexão. Tente novamente.</p>`;
  } finally {
    btn.innerText = "Buscar";
    btn.disabled = false;
  }
}

function selecionarLivroAPI(index) {
  const dados = resultadosBuscaAPI[index];
  if (!dados) return;

  const novoLivro = {
    id: Date.now().toString(),
    ...dados,
    paginaAtual: 0,
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: ['leve', dados.genero.toLowerCase()],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 }
  };

  biblioteca.unshift(novoLivro);
  salvarStorage();
  renderizarEstante();
  fecharModalCadastro();
}

// --- DETALHES E EDIÇÃO DE LIVROS ---
function abrirDetalhes(id) {
  const livro = biblioteca.find(l => l.id === id);
  if (!livro) return;

  const container = document.getElementById('detalhes-container');
  document.getElementById('modal-detalhes').classList.remove('hidden');

  const pagAtual = livro.paginaAtual || 0;
  const porcentagem = Math.min(100, Math.round((pagAtual / livro.paginas) * 100));

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-4 mb-4">
      <img src="${livro.capa}" class="w-28 h-40 object-cover rounded-xl shadow-md mx-auto sm:mx-0 flex-shrink-0" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
      <div class="space-y-2 text-center sm:text-left flex-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider text-blush-500 bg-blush-50 px-2 py-0.5 rounded">${livro.genero}</span>
          <button onclick="toggleFavorito('${livro.id}')" class="text-xs font-semibold cursor-pointer border px-2.5 py-1 rounded-lg transition ${livro.favorito ? 'bg-blush-50 text-blush-600 border-blush-200' : 'bg-stone-50 text-stone-600 border-stone-200'}">
            ${livro.favorito ? 'Favoritado' : 'Favoritar'}
          </button>
        </div>
        <h3 class="font-serif text-lg font-bold text-stone-800">${livro.titulo}</h3>
        <p class="text-xs text-cozy-muted">${livro.autor} • ${livro.paginas} páginas</p>
        
        <div class="pt-2">
          <label class="block text-xs font-semibold text-stone-700 mb-1">Status:</label>
          <select onchange="atualizarStatus('${livro.id}', this.value)" class="bg-stone-50 border border-stone-200 rounded-lg p-1.5 text-xs w-full sm:w-auto font-medium focus:outline-none">
            <option value="quero_ler" ${livro.status === 'quero_ler' ? 'selected' : ''}>Quero Ler</option>
            <option value="lendo" ${livro.status === 'lendo' ? 'selected' : ''}>Lendo</option>
            <option value="lido" ${livro.status === 'lido' ? 'selected' : ''}>Lido</option>
            <option value="abandonado" ${livro.status === 'abandonado' ? 'selected' : ''}>Abandonado</option>
          </select>
        </div>
      </div>
    </div>

    <div id="bloco-progresso" class="bg-blush-50/60 p-3.5 rounded-xl border border-blush-100 space-y-2 ${livro.status === 'lendo' ? '' : 'hidden'}">
      <div class="flex justify-between items-center text-xs font-semibold text-stone-800">
        <span>Progresso de Leitura</span>
        <span id="label-porcentagem" class="text-blush-600 font-bold">${porcentagem}%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-cozy-muted">Página</span>
        <input type="number" id="input-pagina-atual" value="${pagAtual}" min="0" max="${livro.paginas}"
               oninput="alterarPaginaAoVivo('${livro.id}', this.value)"
               class="bg-white border border-stone-200 rounded-lg p-1.5 text-xs w-20 font-bold text-stone-800 text-center focus:outline-none focus:border-blush-400">
        <span class="text-xs text-cozy-muted">de ${livro.paginas}</span>
      </div>
    </div>

    <div class="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
      <h4 class="font-serif font-bold text-xs text-stone-800">Avaliação do Leitor</h4>
      <div class="flex items-center gap-3">
        <label class="text-xs font-semibold text-stone-700">Nota:</label>
        <select id="exp-nota" class="bg-white border border-stone-200 rounded-lg p-1 text-xs font-bold text-stone-800">
          <option value="5" ${livro.nota == 5 ? 'selected' : ''}>5 / 5</option>
          <option value="4" ${livro.nota == 4 ? 'selected' : ''}>4 / 5</option>
          <option value="3" ${livro.nota == 3 ? 'selected' : ''}>3 / 5</option>
          <option value="2" ${livro.nota == 2 ? 'selected' : ''}>2 / 5</option>
          <option value="1" ${livro.nota == 1 ? 'selected' : ''}>1 / 5</option>
          <option value="0" ${livro.nota == 0 ? 'selected' : ''}>Sem nota</option>
        </select>
      </div>
      <button onclick="salvarExperiencia('${livro.id}')" class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
        Salvar
      </button>
    </div>
  `;
}

function alterarPaginaAoVivo(id, valor) {
  const livro = biblioteca.find(l => l.id === id);
  if (!livro) return;

  let pag = Number(valor);
  if (pag > livro.paginas) pag = livro.paginas;
  if (pag < 0) pag = 0;

  livro.paginaAtual = pag;
  const pct = Math.min(100, Math.round((pag / livro.paginas) * 100));

  const labelPorcentagem = document.getElementById('label-porcentagem');
  if (labelPorcentagem) labelPorcentagem.innerText = `${pct}%`;

  salvarStorage();
  renderizarEstante();
}

function fecharModalDetalhes() {
  document.getElementById('modal-detalhes').classList.add('hidden');
}

function toggleFavorito(id) {
  const livro = biblioteca.find(l => l.id === id);
  if (livro) {
    livro.favorito = !livro.favorito;
    salvarStorage();
    renderizarEstante();
    abrirDetalhes(id);
  }
}

function atualizarStatus(id, novoStatus) {
  const l = biblioteca.find(item => item.id === id);
  if (l) {
    l.status = novoStatus;
    if (novoStatus === 'lido') {
      l.paginaAtual = l.paginas;
    }
    salvarStorage();
    renderizarEstante();
    abrirDetalhes(id);
  }
}

function salvarExperiencia(id) {
  const livro = biblioteca.find(l => l.id === id);
  if (livro) {
    livro.nota = Number(document.getElementById('exp-nota').value);
    salvarStorage();
    renderizarEstante();
    fecharModalDetalhes();
  }
}

function deletarLivro(e, id) {
  e.stopPropagation();
  if (confirm("Deseja remover este livro da sua estante?")) {
    biblioteca = biblioteca.filter(l => l.id !== id);
    salvarStorage();
    renderizarEstante();
  }
}

function escolherPorMim() {
  const naoLidos = biblioteca.filter(l => l.status !== 'lido');
  const lista = naoLidos.length > 0 ? naoLidos : biblioteca;

  if (lista.length === 0) return alert("Sua estante está vazia!");
  const sorteado = lista[Math.floor(Math.random() * lista.length)];
  
  document.getElementById('modal-quiz').classList.remove('hidden');
  document.getElementById('quiz-container').innerHTML = `
    <div class="text-center space-y-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Sorteio Literário</span>
      <h3 class="font-serif text-lg font-bold text-stone-800">Livro sugerido:</h3>
      
      <div class="bg-stone-50 p-3 rounded-xl border border-stone-200 flex flex-col items-center">
        <img src="${sorteado.capa}" class="w-24 h-36 object-cover rounded-md shadow mb-2" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
        <h4 class="font-serif font-bold text-stone-800 text-sm">${sorteado.titulo}</h4>
        <p class="text-xs text-cozy-muted">${sorteado.autor} • ${sorteado.paginas} págs</p>
      </div>

      <button onclick="fecharQuiz()" class="w-full bg-blush-500 text-white font-semibold py-2 rounded-lg text-xs hover:bg-blush-600 transition cursor-pointer">
        Ok, vou ler este!
      </button>
    </div>
  `;
}

// --- QUIZ & ALGORITMO ROBUSTO DE RECOMENDAÇÃO ---
let etapaAtual = 1;
let respostas = { vibe: '', tempo: '', genero: '' };

function iniciarQuiz() {
  etapaAtual = 1;
  respostas = { vibe: '', tempo: '', genero: '' };
  document.getElementById('modal-quiz').classList.remove('hidden');
  renderizarEtapa();
}

function fecharQuiz() {
  document.getElementById('modal-quiz').classList.add('hidden');
}

function renderizarEtapa() {
  const container = document.getElementById('quiz-container');

  if (etapaAtual === 1) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 1 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Qual estilo você procura hoje?</h3>
      <div class="space-y-2">
        <button onclick="selecionarOpcao('vibe', 'leve', 2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Leve e tranquilo</span>
        </button>
        <button onclick="selecionarOpcao('vibe', 'emocionante', 2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Emocionante</span>
        </button>
        <button onclick="selecionarOpcao('vibe', 'presa', 2)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Envolvente e rápido</span>
        </button>
      </div>
    `;
  } else if (etapaAtual === 2) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 2 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Tamanho desejado:</h3>
      <div class="space-y-2">
        <button onclick="selecionarOpcao('tempo', 'curto', 3)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Leitura curta (Até 280 págs)</span>
        </button>
        <button onclick="selecionarOpcao('tempo', 'medio', 3)" class="w-full p-2.5 border border-stone-200 rounded-xl text-left hover:border-blush-400 hover:bg-blush-50/50 transition cursor-pointer">
          <span class="block font-semibold text-xs text-stone-800">Leitura média (+300 págs)</span>
        </button>
      </div>
    `;
  } else if (etapaAtual === 3) {
    container.innerHTML = `
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Passo 3 de 3</span>
      <h3 class="font-serif text-base font-bold text-stone-800 mt-1 mb-3">Gênero de preferência:</h3>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="finalizarQuiz('Romance')" class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs text-stone-700 hover:border-blush-400 hover:bg-blush-50/50 transition text-center cursor-pointer">Romance</button>
        <button onclick="finalizarQuiz('Drama')" class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs text-stone-700 hover:border-blush-400 hover:bg-blush-50/50 transition text-center cursor-pointer">Drama</button>
        <button onclick="finalizarQuiz('Ficção')" class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs text-stone-700 hover:border-blush-400 hover:bg-blush-50/50 transition text-center cursor-pointer">Ficção</button>
        <button onclick="finalizarQuiz('Suspense')" class="p-2.5 border border-stone-200 rounded-xl font-semibold text-xs text-stone-700 hover:border-blush-400 hover:bg-blush-50/50 transition text-center cursor-pointer">Suspense</button>
      </div>
    `;
  }
}

function selecionarOpcao(chave, valor, proximaEtapa) {
  respostas[chave] = valor;
  etapaAtual = proximaEtapa;
  renderizarEtapa();
}

async function finalizarQuiz(genero) {
  respostas.genero = genero;
  const container = document.getElementById('quiz-container');

  container.innerHTML = `
    <div class="text-center py-10 space-y-3">
      <div class="w-6 h-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-cozy-muted font-medium">Buscando as melhores recomendações...</p>
    </div>
  `;

  let recomendados = [];

  // 1. Tenta buscar na estante do usuário
  const pendentesEstante = biblioteca.filter(l => l.status !== 'lido');
  if (pendentesEstante.length > 0) {
    recomendados = pendentesEstante.map(livro => {
      let match = 50;
      if (livro.genero.toLowerCase() === genero.toLowerCase()) match += 40;
      if (livro.tags && livro.tags.includes(respostas.vibe)) match += 9;
      return { ...livro, match: Math.min(match, 99), novidade: false };
    })
    .filter(livro => livro.match >= 80)
    .sort((a, b) => b.match - a.match);
  }

  // 2. Se a estante não tiver opções suficientes, faz busca com MÚLTIPLOS fallbacks na API
  if (recomendados.length < 2) {
    try {
      // Lista de termos para buscar na API até achar livros
      const termosBusca = [
        `livro ${genero.toLowerCase()}`,
        `${genero.toLowerCase()} ${respostas.vibe}`,
        genero
      ];

      for (const termo of termosBusca) {
        if (recomendados.filter(r => r.novidade).length >= 2) break;

        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&maxResults=10`);
        const data = await res.json();

        if (data.items && data.items.length > 0) {
          const novos = data.items
            .filter(item => {
              const info = item.volumeInfo || {};
              const titulo = info.title || '';
              return titulo.length > 0 && !biblioteca.some(b => b.titulo.toLowerCase() === titulo.toLowerCase());
            })
            .map(item => {
              const info = item.volumeInfo || {};
              let capa = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || 'https://via.placeholder.com/150x225?text=Sem+Capa';
              return {
                id: Date.now().toString() + Math.random(),
                titulo: info.title || 'Sem título',
                autor: info.authors ? info.authors.join(', ') : 'Autor desconhecido',
                paginas: info.pageCount || (respostas.tempo === 'curto' ? 220 : 380),
                genero: genero,
                capa: capa.replace('http:', 'https:'),
                match: Math.floor(Math.random() * 8) + 91,
                novidade: true
              };
            });

          recomendados = [...recomendados, ...novos];
        }
      }
    } catch (err) {
      console.error("Erro na busca de recomendações:", err);
    }
  }

  exibirResultado(recomendados.slice(0, 2));
}

function adicionarRecomendacaoNova(titulo, autor, paginas, genero, capa) {
  const novoLivro = {
    id: Date.now().toString(),
    titulo,
    autor,
    paginas: Number(paginas) || 280,
    paginaAtual: 0,
    genero,
    capa,
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: ['leve', genero.toLowerCase()],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 }
  };

  biblioteca.unshift(novoLivro);
  salvarStorage();
  renderizarEstante();
  fecharQuiz();
}

function exibirResultado(livros) {
  const container = document.getElementById('quiz-container');

  if (livros.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 space-y-3">
        <p class="text-xs text-cozy-muted">Não foi possível carregar livros no momento. Tente novamente em instantes.</p>
        <button onclick="fecharQuiz()" class="w-full bg-blush-500 text-white font-semibold py-2 rounded-lg text-xs hover:bg-blush-600 transition cursor-pointer">Fechar</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="text-center mb-3">
      <span class="text-[10px] font-bold text-blush-500 uppercase tracking-wider">Resultado Match</span>
      <h3 class="font-serif text-base font-bold text-stone-800">Livros Sugeridos para Você</h3>
    </div>

    <div class="space-y-2.5 max-h-72 overflow-y-auto custom-scroll pr-1">
      ${livros.map(livro => `
        <div class="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
          <div class="flex gap-3 items-center">
            <img src="${livro.capa}" class="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <h4 class="font-serif font-bold text-stone-800 truncate text-xs">${livro.titulo}</h4>
                <span class="bg-blush-100 text-blush-600 font-bold text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                  ${livro.match}% Match
                </span>
              </div>
              <p class="text-[11px] text-cozy-muted truncate">${livro.autor}</p>
              <span class="text-[9px] ${livro.novidade ? 'text-amber-700 bg-amber-50 border border-amber-100' : 'text-purple-700 bg-purple-50 border border-purple-100'} px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                ${livro.novidade ? 'Sugestão Externa' : 'Já na sua Estante'}
              </span>
            </div>
          </div>

          ${livro.novidade ? `
            <button onclick="adicionarRecomendacaoNova('${livro.titulo.replace(/'/g, "\\'")}', '${livro.autor.replace(/'/g, "\\'")}', ${livro.paginas}, '${livro.genero}', '${livro.capa}')" class="w-full bg-blush-500 hover:bg-blush-600 text-white font-semibold py-1.5 rounded-lg text-[11px] transition cursor-pointer">
              + Adicionar à Estante (Quero Ler)
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <button onclick="fecharQuiz()" class="w-full mt-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
      Fechar
    </button>
  `;
}

// Inicialização
atualizarHeaderUsuario();
filtrarEstante('todos');