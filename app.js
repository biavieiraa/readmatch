const livrosIniciais = [
  {
    id: "1",
    titulo: "Depois Daquele Verão",
    autor: "Carley Fortune",
    paginas: 320,
    genero: "Romance",
    tags: ["romance", "emocionante", "leve"],
    capa: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1648013174i/60673589.jpg",
    status: "lido",
    favorito: true,
    nota: 5,
    experiencia: { emocionei: 5, presa: 4, pensei: 3 }
  },
  {
    id: "2",
    titulo: "A Biblioteca da Meia-Noite",
    autor: "Matt Haig",
    paginas: 308,
    genero: "Ficção",
    tags: ["pensar", "emocionante", "diferente"],
    capa: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1602190253i/52578297.jpg",
    status: "quero_ler",
    favorito: false,
    nota: 0,
    experiencia: { emocionei: 0, presa: 0, pensei: 0 }
  }
];

let biblioteca = JSON.parse(localStorage.getItem('readmatch_livros')) || livrosIniciais;
let metaLeitura = Number(localStorage.getItem('readmatch_meta')) || 12;
let filtroAtual = 'todos';
let resultadosBuscaAPI = [];

function salvarStorage() {
  localStorage.setItem('readmatch_livros', JSON.stringify(biblioteca));
}

// --- META DE LEITURA ---
function atualizarMeta() {
  const lidos = biblioteca.filter(l => l.status === 'lido').length;
  const porcentagem = Math.min(Math.round((lidos / metaLeitura) * 100), 100);
  
  const elProgresso = document.getElementById('meta-progresso');
  const elPorcentagem = document.getElementById('meta-porcentagem');
  const elBarra = document.getElementById('meta-barra');
  const elMensagem = document.getElementById('meta-mensagem');

  if (elProgresso) elProgresso.innerText = `${lidos} / ${metaLeitura}`;
  if (elPorcentagem) elPorcentagem.innerText = `${porcentagem}%`;
  if (elBarra) elBarra.style.width = `${porcentagem}%`;

  if (elMensagem) {
    if (lidos >= metaLeitura) {
      elMensagem.innerText = "🎉 Parabéns! Você atingiu sua meta anual!";
    } else {
      const faltam = metaLeitura - lidos;
      elMensagem.innerText = `Faltam apenas ${faltam} livro${faltam > 1 ? 's' : ''} para a meta!`;
    }
  }
}

function alterarMeta() {
  const novaMeta = prompt("Quantos livros você quer ler este ano?", metaLeitura);
  if (novaMeta && !isNaN(novaMeta) && Number(novaMeta) > 0) {
    metaLeitura = Number(novaMeta);
    localStorage.setItem('readmatch_meta', metaLeitura);
    atualizarMeta();
  }
}

// --- ESTANTE ---
function filtrarEstante(status) {
  filtroAtual = status;
  
  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.className = 'btn-filtro font-semibold px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition cursor-pointer';
  });
  const btnAtivo = document.getElementById(`btn-filtro-${status}`);
  if (btnAtivo) btnAtivo.className = 'btn-filtro font-semibold px-3 py-1.5 rounded-lg bg-stone-900 text-white transition cursor-pointer';

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
    container.innerHTML = `<p class="col-span-full text-stone-400 text-sm py-8 text-center">Nenhum livro encontrado nesta categoria.</p>`;
    return;
  }

  const badgeStatus = {
    'quero_ler': '<span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Quero Ler</span>',
    'lendo': '<span class="bg-pink-50 text-[#E05A87] text-[10px] font-bold px-2 py-0.5 rounded-full">Lendo</span>',
    'lido': '<span class="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Lido</span>',
    'abandonado': '<span class="bg-stone-100 text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Abandonado</span>'
  };

  container.innerHTML = livrosExibidos.map(livro => `
    <div onclick="abrirDetalhes('${livro.id}')" class="bg-white p-3 rounded-xl border border-stone-200/80 shadow-sm hover:shadow-md transition relative group cursor-pointer">
      <button onclick="deletarLivro(event, '${livro.id}')" class="absolute top-2 right-2 bg-stone-900/70 hover:bg-stone-900 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition z-10">✕</button>
      
      <div class="aspect-[2/3] w-full bg-stone-100 rounded-lg overflow-hidden mb-3 relative">
        <img src="${livro.capa}" alt="${livro.titulo}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
        ${livro.favorito ? '<span class="absolute bottom-2 left-2 text-sm drop-shadow">❤️</span>' : ''}
      </div>

      <div class="mb-1 flex items-center justify-between">
        ${badgeStatus[livro.status] || ''}
        ${livro.nota > 0 ? `<span class="text-xs font-bold text-amber-500">⭐ ${livro.nota}</span>` : ''}
      </div>

      <h4 class="font-bold text-sm text-stone-900 truncate">${livro.titulo}</h4>
      <p class="text-xs text-stone-500 truncate">${livro.autor}</p>
    </div>
  `).join('');
}

// --- BUSCA COM FALLBACK (GOOGLE BOOKS + OPEN LIBRARY) ---
function abrirModalCadastro() {
  document.getElementById('modal-cadastro').classList.remove('hidden');
}

function fecharModalCadastro() {
  document.getElementById('modal-cadastro').classList.add('hidden');
  document.getElementById('container-resultados').innerHTML = `<p class="text-xs text-stone-400 text-center py-8">Pesquise acima para carregar os dados automaticamente.</p>`;
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
    // 1. Tenta via Google Books
    const resGB = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6`);
    const dataGB = await resGB.json();

    if (dataGB.items && dataGB.items.length > 0) {
      resultadosBuscaAPI = dataGB.items.map(item => {
        const info = item.volumeInfo || {};
        let capa = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || 'https://via.placeholder.com/150x225?text=Sem+Capa';
        capa = capa.replace('http:', 'https:');
        return {
          titulo: info.title || 'Sem título',
          autor: info.authors ? info.authors.join(', ') : 'Autor desconhecido',
          paginas: info.pageCount || 250,
          genero: info.categories ? info.categories[0].split('/')[0].trim() : 'Ficção',
          capa: capa
        };
      });
    } else {
      // 2. Se o Google falhar, tenta via Open Library
      const resOL = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`);
      const dataOL = await resOL.json();

      if (dataOL.docs && dataOL.docs.length > 0) {
        resultadosBuscaAPI = dataOL.docs.map(doc => ({
          titulo: doc.title || 'Sem título',
          autor: doc.author_name ? doc.author_name.slice(0, 2).join(', ') : 'Autor desconhecido',
          paginas: doc.number_of_pages_median || doc.number_of_pages || 250,
          genero: doc.subject ? doc.subject[0] : 'Ficção',
          capa: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : 'https://via.placeholder.com/150x225?text=Sem+Capa'
        }));
      }
    }

    if (resultadosBuscaAPI.length === 0) {
      container.innerHTML = `<p class="text-xs text-stone-400 text-center py-8">Nenhum livro encontrado para "${query}". Tente outro nome.</p>`;
      return;
    }

    container.innerHTML = resultadosBuscaAPI.map((item, index) => `
      <div class="flex items-center gap-3 p-2 bg-stone-50 rounded-xl border border-stone-200 hover:border-[#E05A87] transition">
        <img src="${item.capa}" class="w-12 h-16 object-cover rounded shadow-sm" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
        <div class="flex-1 min-w-0">
          <h5 class="font-bold text-sm text-stone-900 truncate">${item.titulo}</h5>
          <p class="text-xs text-stone-500 truncate">${item.autor}</p>
          <span class="text-[10px] bg-stone-200/60 px-2 py-0.5 rounded text-stone-600 mt-1 inline-block">${item.paginas} págs • ${item.genero}</span>
        </div>
        <button onclick="selecionarLivroAPI(${index})" class="bg-[#E05A87] hover:bg-[#C94672] text-white font-semibold text-xs px-3 py-2 rounded-lg transition flex-shrink-0 cursor-pointer">
          Adicionar
        </button>
      </div>
    `).join('');

  } catch (err) {
    console.error("Erro na busca:", err);
    container.innerHTML = `<p class="text-xs text-red-500 text-center py-8">Erro na conexão. Verifique se o Live Server do VS Code está ligado.</p>`;
  } finally {
    btn.innerText = "Buscar";
    btn.disabled = false;
  }
}

function selecionarLivroAPI(index) {
  const dados = resultadosBuscaAPI[index];
  if (!dados) return;

  const vibe = prompt(`Qual a vibe principal de "${dados.titulo}"?\n\n1. ☁️ Leve\n2. 🧠 Para pensar\n3. 🥹 Emocionante\n4. 🔥 Presa na história`, "1");

  const vibesMap = { "1": "leve", "2": "pensar", "3": "emocionante", "4": "presa" };
  const vibeEscolhida = vibesMap[vibe] || "leve";

  const novoLivro = {
    id: Date.now().toString(),
    ...dados,
    status: 'quero_ler',
    favorito: false,
    nota: 0,
    tags: [vibeEscolhida, dados.genero.toLowerCase()],
    experiencia: { emocionei: 0, presa: 0, pensei: 0 }
  };

  biblioteca.push(novoLivro);
  salvarStorage();
  renderizarEstante();
  fecharModalCadastro();
}

// --- DETALHES DO LIVRO ---
function abrirDetalhes(id) {
  const livro = biblioteca.find(l => l.id === id);
  if (!livro) return;

  const container = document.getElementById('detalhes-container');
  document.getElementById('modal-detalhes').classList.remove('hidden');

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-6 mb-6">
      <img src="${livro.capa}" class="w-32 h-48 object-cover rounded-xl shadow-md mx-auto sm:mx-0 flex-shrink-0" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
      <div class="space-y-2 text-center sm:text-left flex-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#E05A87]">${livro.genero}</span>
          <button onclick="toggleFavorito('${livro.id}')" class="text-xl cursor-pointer">
            ${livro.favorito ? '❤️' : '🤍'}
          </button>
        </div>
        <h3 class="font-serif text-2xl font-bold text-stone-900">${livro.titulo}</h3>
        <p class="text-sm text-stone-500">${livro.autor} • ${livro.paginas} páginas</p>
        
        <div class="pt-2">
          <label class="block text-xs font-semibold text-stone-600 mb-1">Status de Leitura:</label>
          <select onchange="atualizarStatus('${livro.id}', this.value)" class="border border-stone-300 rounded-lg p-2 text-xs w-full sm:w-auto font-medium">
            <option value="quero_ler" ${livro.status === 'quero_ler' ? 'selected' : ''}>📘 Quero Ler</option>
            <option value="lendo" ${livro.status === 'lendo' ? 'selected' : ''}>📖 Lendo Atualmente</option>
            <option value="lido" ${livro.status === 'lido' ? 'selected' : ''}>✅ Lido</option>
            <option value="abandonado" ${livro.status === 'abandonado' ? 'selected' : ''}>🚫 Abandonado</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Minha Experiencia -->
    <div class="bg-stone-50 p-5 rounded-2xl border border-stone-200/80 space-y-4">
      <h4 class="font-bold text-sm text-stone-900 flex items-center gap-2">
        <span>✨</span> Minha Experiência
      </h4>

      <div>
        <label class="block text-xs font-semibold text-stone-600 mb-1">Sua Nota Geral (1 a 5 ⭐):</label>
        <input type="number" min="1" max="5" value="${livro.nota || 5}" id="exp-nota" class="w-20 border border-stone-300 rounded-lg p-2 text-xs font-bold text-stone-800">
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] font-semibold text-stone-500 mb-1">🥹 Me emocionei</label>
          <select id="exp-emocionei" class="w-full border border-stone-300 rounded-lg p-2 text-xs">
            <option value="1" ${livro.experiencia?.emocionei == 1 ? 'selected' : ''}>Pouco</option>
            <option value="3" ${livro.experiencia?.emocionei == 3 ? 'selected' : ''}>Médio</option>
            <option value="5" ${livro.experiencia?.emocionei == 5 ? 'selected' : ''}>Muito!</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-stone-500 mb-1">⚡ Fiquei presa</label>
          <select id="exp-presa" class="w-full border border-stone-300 rounded-lg p-2 text-xs">
            <option value="1" ${livro.experiencia?.presa == 1 ? 'selected' : ''}>Pouco</option>
            <option value="3" ${livro.experiencia?.presa == 3 ? 'selected' : ''}>Médio</option>
            <option value="5" ${livro.experiencia?.presa == 5 ? 'selected' : ''}>Muito!</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-stone-500 mb-1">🧠 Me fez pensar</label>
          <select id="exp-pensei" class="w-full border border-stone-300 rounded-lg p-2 text-xs">
            <option value="1" ${livro.experiencia?.pensei == 1 ? 'selected' : ''}>Pouco</option>
            <option value="3" ${livro.experiencia?.pensei == 3 ? 'selected' : ''}>Médio</option>
            <option value="5" ${livro.experiencia?.pensei == 5 ? 'selected' : ''}>Muito!</option>
          </select>
        </div>
      </div>

      <button onclick="salvarExperiencia('${livro.id}')" class="w-full bg-[#E05A87] hover:bg-[#C94672] text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer">
        Salvar Avaliação
      </button>
    </div>
  `;
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
  const livro = biblioteca.find(l => l.id === id);
  if (livro) {
    livro.status = novoStatus;
    salvarStorage();
    renderizarEstante();
  }
}

function salvarExperiencia(id) {
  const livro = biblioteca.find(l => l.id === id);
  if (livro) {
    livro.nota = Number(document.getElementById('exp-nota').value);
    livro.experiencia = {
      emocionei: Number(document.getElementById('exp-emocionei').value),
      presa: Number(document.getElementById('exp-presa').value),
      pensei: Number(document.getElementById('exp-pensei').value)
    };
    livro.status = 'lido';
    salvarStorage();
    renderizarEstante();
    fecharModalDetalhes();
  }
}

function deletarLivro(e, id) {
  e.stopPropagation();
  if (confirm("Remover este livro da estante?")) {
    biblioteca = biblioteca.filter(l => l.id !== id);
    salvarStorage();
    renderizarEstante();
  }
}

function escolherPorMim() {
  const naoLidos = biblioteca.filter(l => l.status === 'quero_ler' || l.status === 'lendo');
  const lista = naoLidos.length > 0 ? naoLidos : biblioteca;

  if (lista.length === 0) return alert("Sua estante está vazia!");
  const sorteado = lista[Math.floor(Math.random() * lista.length)];
  
  document.getElementById('modal-quiz').classList.remove('hidden');
  document.getElementById('quiz-container').innerHTML = `
    <div class="text-center space-y-4">
      <span class="text-xs font-bold text-[#E05A87] uppercase tracking-wider">Escolha Aleatória 🎲</span>
      <h3 class="font-serif text-2xl font-bold text-stone-900">O destino escolheu para você:</h3>
      
      <div class="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col items-center">
        <img src="${sorteado.capa}" class="w-28 h-40 object-cover rounded-lg shadow mb-3" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
        <h4 class="font-bold text-stone-900 text-lg">${sorteado.titulo}</h4>
        <p class="text-xs text-stone-500">${sorteado.autor} • ${sorteado.paginas} páginas</p>
      </div>

      <button onclick="fecharQuiz()" class="w-full bg-[#E05A87] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#C94672] transition cursor-pointer">
        Vou ler esse! 📖
      </button>
    </div>
  `;
}

// --- QUIZ DE MATCH ---
let etapaAtual = 1;
let respostas = { vibe: '', tempo: '', genero: '' };

function iniciarQuiz() {
  if (biblioteca.length === 0) return alert("Cadastre alguns livros primeiro!");
  etapaAtual = 1;
  respostas = { vibe: '', tempo: '', genero: '' };
  document.getElementById('modal-quiz').classList.remove('hidden');
  renderizarEtapa();
}

function fecharQuiz() {
  document.getElementById('modal-quiz').classList.add('hidden');
}

function calcularMatch(livro) {
  let pontos = 0;
  if (livro.tags.includes(respostas.vibe)) pontos += 40;
  if (respostas.tempo === 'curto' && livro.paginas <= 280) pontos += 30;
  else if (respostas.tempo === 'medio' && livro.paginas > 280 && livro.paginas <= 360) pontos += 30;
  else if (respostas.tempo === 'longo' && livro.paginas > 360) pontos += 30;
  if (respostas.genero.toLowerCase() === livro.genero.toLowerCase()) pontos += 30;
  return Math.min(Math.max(pontos, 45), 98);
}

function renderizarEtapa() {
  const container = document.getElementById('quiz-container');

  if (etapaAtual === 1) {
    container.innerHTML = `
      <span class="text-xs font-bold text-[#E05A87] uppercase tracking-wider">Passo 1 de 3</span>
      <h3 class="font-serif text-2xl font-bold text-stone-900 mt-1 mb-6">O que você está procurando hoje?</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onclick="selecionarOpcao('vibe', 'leve', 2)" class="p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition cursor-pointer">
          <span class="block font-semibold text-stone-900">☁️ Quero algo leve</span>
        </button>
        <button onclick="selecionarOpcao('vibe', 'pensar', 2)" class="p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition cursor-pointer">
          <span class="block font-semibold text-stone-900">🧠 Algo pra me fazer pensar</span>
        </button>
        <button onclick="selecionarOpcao('vibe', 'emocionante', 2)" class="p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition cursor-pointer">
          <span class="block font-semibold text-stone-900">🥹 História emocionante</span>
        </button>
        <button onclick="selecionarOpcao('vibe', 'presa', 2)" class="p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition cursor-pointer">
          <span class="block font-semibold text-stone-900">🔥 Ficar presa na história</span>
        </button>
      </div>
    `;
  } else if (etapaAtual === 2) {
    container.innerHTML = `
      <span class="text-xs font-bold text-[#E05A87] uppercase tracking-wider">Passo 2 de 3</span>
      <h3 class="font-serif text-2xl font-bold text-stone-900 mt-1 mb-6">Quanto tempo quer gastar?</h3>
      <div class="space-y-3">
        <button onclick="selecionarOpcao('tempo', 'curto', 3)" class="w-full p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition flex justify-between items-center cursor-pointer">
          <div><span class="block font-semibold text-stone-900">📖 Quero algo curto</span><span class="text-xs text-stone-500">Até 280 págs</span></div>
        </button>
        <button onclick="selecionarOpcao('tempo', 'medio', 3)" class="w-full p-4 border border-stone-200 rounded-xl text-left hover:border-[#E05A87] hover:bg-pink-50/40 transition flex justify-between items-center cursor-pointer">
          <div><span class="block font-semibold text-stone-900">📚 Tamanho médio</span><span class="text-xs text-stone-500">280-360 págs</span></div>
        </button>
      </div>
    `;
  } else if (etapaAtual === 3) {
    container.innerHTML = `
      <span class="text-xs font-bold text-[#E05A87] uppercase tracking-wider">Passo 3 de 3</span>
      <h3 class="font-serif text-2xl font-bold text-stone-900 mt-1 mb-6">Qual gênero você prefere agora?</h3>
      <div class="grid grid-cols-2 gap-3">
        <button onclick="finalizarQuiz('Romance')" class="p-4 border border-stone-200 rounded-xl font-semibold text-stone-800 hover:border-[#E05A87] hover:bg-pink-50/40 transition text-center cursor-pointer">Romance</button>
        <button onclick="finalizarQuiz('Ficção')" class="p-4 border border-stone-200 rounded-xl font-semibold text-stone-800 hover:border-[#E05A87] hover:bg-pink-50/40 transition text-center cursor-pointer">Ficção</button>
        <button onclick="finalizarQuiz('Drama')" class="p-4 border border-stone-200 rounded-xl font-semibold text-stone-800 hover:border-[#E05A87] hover:bg-pink-50/40 transition text-center cursor-pointer">Drama</button>
        <button onclick="finalizarQuiz('Suspense')" class="p-4 border border-stone-200 rounded-xl font-semibold text-stone-800 hover:border-[#E05A87] hover:bg-pink-50/40 transition text-center cursor-pointer">Suspense</button>
      </div>
    `;
  }
}

function selecionarOpcao(chave, valor, proximaEtapa) {
  respostas[chave] = valor;
  etapaAtual = proximaEtapa;
  renderizarEtapa();
}

function finalizarQuiz(genero) {
  respostas.genero = genero;
  const recomendados = biblioteca.map(livro => ({
    ...livro,
    match: calcularMatch(livro)
  })).sort((a, b) => b.match - a.match);

  exibirResultado(recomendados.slice(0, 3));
}

function exibirResultado(livros) {
  const container = document.getElementById('quiz-container');
  container.innerHTML = `
    <div class="text-center mb-6">
      <span class="text-xs font-bold text-[#E05A87] uppercase tracking-wider">Resultado da Análise</span>
      <h3 class="font-serif text-2xl font-bold text-stone-900 mt-1">✨ Recomendados para você</h3>
    </div>

    <div class="space-y-4 max-h-[380px] overflow-y-auto pr-1">
      ${livros.map(livro => `
        <div class="flex gap-4 p-3 bg-stone-50 rounded-xl border border-stone-200/60 items-center">
          <img src="${livro.capa}" class="w-16 h-22 object-cover rounded-md flex-shrink-0" onerror="this.src='https://via.placeholder.com/150x225?text=Sem+Capa'">
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <h4 class="font-bold text-stone-900 truncate text-sm">${livro.titulo}</h4>
              <span class="bg-pink-100 text-[#E05A87] font-bold text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                ${livro.match}% Match
              </span>
            </div>
            <p class="text-xs text-stone-500">${livro.autor} •${livro.paginas} págs</p>
            <p class="text-xs text-stone-600 mt-2 bg-white p-2 rounded border border-stone-200/50 italic">
              "Combina com sua busca por um ${livro.genero.toLowerCase()}."
            </p>
          </div>
        </div>
      `).join('')}
    </div>

    <button onclick="fecharQuiz()" class="w-full mt-6 bg-stone-900 text-white font-semibold py-3 rounded-xl text-sm hover:bg-stone-800 transition cursor-pointer">
      Fechar
    </button>
  `;
}

renderizarEstante();