const API = 'https://curator-activist-unheard.ngrok-free.dev/api';
//const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const sesion = JSON.parse(localStorage.getItem('sesion') || 'null');

if (!token) window.location.href = 'login.html';

let ultimosEspecimenes = [];

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` };
}

// ------------------------------------------------------------
// FEEDBACK AUDITIVO Y HÁPTICO (BEEP + VIBRACIÓN)
// ------------------------------------------------------------
let audioCtx = null;

// Despierta el contexto de audio tras la interacción del usuario (requerido por iOS Safari)
function inicializarAudioContext() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (err) {
    console.warn('No se pudo inicializar AudioContext:', err);
  }
}

// Emite el "beep" de confirmación tipo escáner profesional
function reproducirBeepExito() {
  try {
    // 1. Vibración háptica (120ms en Android / navegadores compatibles)
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    // 2. Síntesis de sonido mediante oscilador
    inicializarAudioContext();
    if (!audioCtx) return;

    const oscilador = audioCtx.createOscillator();
    const nodoGanancia = audioCtx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(1800, audioCtx.currentTime); // Tono agudo y limpio (1.8 kHz)

    nodoGanancia.gain.setValueAtTime(0.18, audioCtx.currentTime); // Volumen adecuado sin saturar
    nodoGanancia.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12); // Atenuación rápida

    oscilador.connect(nodoGanancia);
    nodoGanancia.connect(audioCtx.destination);

    oscilador.start(audioCtx.currentTime);
    oscilador.stop(audioCtx.currentTime + 0.12); // Duración: 120 ms
  } catch (e) {
    console.warn('Fallo al reproducir feedback sonoro:', e);
  }
}

async function buscar() {
  const q = document.getElementById('searchQ').value.trim();
  const tipo = document.getElementById('filterTipo').value;
  const numero_registro = document.getElementById('filterRegistro').value.trim();

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tipo) params.set('tipo', tipo);
  if (numero_registro) params.set('numero_registro', numero_registro);

  try {
    const res = await fetch(`${API}/especimenes?${params.toString()}`, { headers: authHeaders() });

    if (res.status === 401) { 
      window.location.href = 'login.html'; 
      return; 
    }

    const data = await res.json();
    ultimosEspecimenes = data;
    renderGrid(data);
  } catch (err) {
    console.error('Error al realizar búsqueda:', err);
  }
}

function renderGrid(items) {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;
  grid.innerHTML = '';

  if (!items || items.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'specimen-card';
    card.innerHTML = `
      <div class="reg-stamp">${item.numero_registro}</div>
      <div class="tipo-tag">${item.tipo}</div>
      <h3>${item.nombre_cientifico || item.especie || 'Sin identificar'}</h3>
      <div class="comun">${item.nombre_comun || '-'}</div>
      <div class="familia">Fam. ${item.familia || 'N/D'}</div>
    `;
    card.addEventListener('click', () => verDetalle(item.id));
    grid.appendChild(card);
  }
}

// ------------------------------------------------------------
// LIGHTBOX ESTANDARIZADO (HORIZONTAL / VERTICAL FIJO + TACHE + ESC)
// ------------------------------------------------------------
function abrirImagenGrande(srcRuta) {
  const overlay = document.createElement('div');
  overlay.className = 'image-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999999;
  `;

  const imgTemp = new Image();
  imgTemp.src = srcRuta;

  imgTemp.onload = () => {
    const esVertical = imgTemp.naturalHeight > imgTemp.naturalWidth;
    const ancho = esVertical ? '460px' : '720px';
    const alto = esVertical ? '620px' : '480px';

    overlay.innerHTML = `
      <div style="
        position: relative;
        width: min(${ancho}, 92vw);
        height: min(${alto}, 82vh);
        background: #111;
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        border: 2px solid #2e834b;
        overflow: hidden;
      ">
        <button type="button" id="btnCerrarFoto" style="
          position: absolute;
          top: 10px;
          right: 10px;
          width: 36px;
          height: 36px;
          background: #ffffff;
          color: #153e23;
          border: 2px solid #153e23;
          border-radius: 50%;
          font-size: 22px;
          font-weight: bold;
          line-height: 1;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.6);
          z-index: 100;
        ">&times;</button>

        <img src="${srcRuta}" alt="Ejemplar ampliado" style="
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        ">
      </div>
    `;

    const cerrar = () => {
      document.removeEventListener('keydown', teclaEscHandler);
      overlay.remove();
    };

    const teclaEscHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stopPropagation();
        cerrar();
      }
    };

    overlay.querySelector('#btnCerrarFoto').addEventListener('click', (e) => {
      e.stopPropagation();
      cerrar();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar();
    });

    document.addEventListener('keydown', teclaEscHandler);
    document.body.appendChild(overlay);
  };
}

// ------------------------------------------------------------
// CONSTRUCCIÓN DE LA FICHA TÉCNICA
// ------------------------------------------------------------
function construirHtmlFicha(e, esImpresion = false) {
  const isAngio = (e.tipo || '').toLowerCase().includes('angio');
  const d = e.detalle || {};

  const imgsPorCampo = {};
  (e.imagenes || []).forEach((img) => {
    const campo = img.campo || 'general';
    if (!imgsPorCampo[campo]) imgsPorCampo[campo] = [];
    imgsPorCampo[campo].push(img);
  });

  function filaFotos(campo) {
    const imgs = imgsPorCampo[campo];
    if (!imgs || imgs.length === 0) return '';
    const miniaturas = imgs.map(img => {
      const urlCompleta = `${API.replace('/api', '')}/uploads/${img.ruta_archivo}`;
      return `<img src="${urlCompleta}" alt="Foto de ${campo}" style="cursor: pointer;" title="Clic para ampliar">`;
    }).join('');
    return `<tr><td></td><td><div class="img-gallery">${miniaturas}</div></td></tr>`;
  }

  const filasComunes = `
    <tr><td class="label">Familia</td><td>${e.familia || '-'}</td></tr>
    <tr><td class="label">Distribución</td><td>${e.distribucion || '-'}</td></tr>
    ${filaFotos('distribucion')}
    ${!isAngio ? `<tr><td class="label">Altitud</td><td>${d.altitud || '-'}</td></tr>` : ''}
    <tr><td class="label">Fotografía general</td><td>${imgsPorCampo.general ? '' : '-'}</td></tr>
    ${filaFotos('general')}
  `;

  const filasEspecificas = isAngio ? `
    <tr><td class="label">Hojas</td><td>${d.hojas || '-'}</td></tr>
    ${filaFotos('hojas')}
    <tr><td class="label">Filotaxia</td><td>${d.filotaxia || '-'}</td></tr>
    <tr><td class="label">Flor</td><td>${d.flor || '-'}</td></tr>
    ${filaFotos('flor')}
    <tr><td class="label">Fruto</td><td>${d.fruto || '-'}</td></tr>
    ${filaFotos('fruto')}
    <tr><td class="label">Sexualidad</td><td>${d.sexualidad || '-'}</td></tr>
    ${filaFotos('sexualidad')}
  ` : `
    <tr><td class="label">Subgénero</td><td>${d.subgenero || '-'}</td></tr>
    <tr><td class="label">Sección</td><td>${d.seccion || '-'}</td></tr>
    <tr><td class="label">Cono</td><td>${d.cono || '-'} (long. ${d.longitud_cono || '-'}, color ${d.color_cono || '-'})</td></tr>
    ${filaFotos('cono')}
    <tr><td class="label">Umbo</td><td>${d.umbo || '-'}</td></tr>
    <tr><td class="label">Tipo de semilla</td><td>${d.tipo_semilla || '-'}</td></tr>
    ${filaFotos('semilla')}
    <tr><td class="label">Acículas</td><td>${d.forma_aciculas || '-'} · No. ${d.numero_aciculas || '-'} · long. ${d.longitud_aciculas || '-'}</td></tr>
    ${filaFotos('aciculas')}
    <tr><td class="label">Vaina / Bráctea</td><td>${d.vaina || '-'} / ${d.bractea_foliar || '-'}</td></tr>
  `;

  const filasExtra = (e.campos_personalizados || []).map(c => `
    <tr><td class="label">${c.nombre_campo}</td><td>${c.valor || '-'}</td></tr>
  `).join('');

  return `
    ${!esImpresion ? `
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 6px;">
        <button type="button" class="btn btn-secondary" onclick="imprimirFichaActual()" style="padding: 4px 10px; font-size: 12px; cursor: pointer;">🖨️ Imprimir Cédula</button>
        <button class="close-btn" id="closeDetail" style="position: static; font-size: 22px; cursor: pointer;">&times;</button>
      </div>
    ` : ''}
    <span class="badge">${e.tipo}</span>
    <h2>${e.nombre_cientifico || e.especie}</h2>
    <div class="comun">${e.nombre_comun || ''} · N.º de registro: ${e.numero_registro}</div>
    <table class="spec-table">${filasComunes}</table>
    <div class="section-title">Características específicas</div>
    <table class="spec-table">${filasEspecificas}</table>
    ${filasExtra ? `<div class="section-title">Otros campos</div><table class="spec-table">${filasExtra}</table>` : ''}
    ${e.otras_caracteristicas ? `<div class="section-title">Notas</div><p style="font-size:12px; line-height:1.4;">${e.otras_caracteristicas}</p>` : ''}
  `;
}

// ------------------------------------------------------------
// DETALLE DEL EJEMPLAR (CON CIERRE POR BOTÓN Y TECLA ESC)
// ------------------------------------------------------------
let escCerrarFichaHandler = null;

async function verDetalle(id) {
  try {
    const res = await fetch(`${API}/especimenes/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const e = await res.json();

    const detailSheet = document.getElementById('detailSheet');
    const detailOverlay = document.getElementById('detailOverlay');

    detailSheet.innerHTML = construirHtmlFicha(e, false);

    setTimeout(() => {
      detailSheet.querySelectorAll('.img-gallery img').forEach(imgEl => {
        imgEl.addEventListener('click', () => abrirImagenGrande(imgEl.src));
      });
    }, 50);

    detailOverlay.style.display = 'flex';

    const cerrarDetalleModal = () => {
      detailOverlay.style.display = 'none';
      if (escCerrarFichaHandler) {
        document.removeEventListener('keydown', escCerrarFichaHandler);
        escCerrarFichaHandler = null;
      }
    };

    document.getElementById('closeDetail').addEventListener('click', cerrarDetalleModal);

    if (escCerrarFichaHandler) document.removeEventListener('keydown', escCerrarFichaHandler);
    escCerrarFichaHandler = (ev) => {
      if (document.querySelector('.image-modal-overlay')) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        cerrarDetalleModal();
      }
    };
    document.addEventListener('keydown', escCerrarFichaHandler);
  } catch (err) {
    console.error('Error al abrir detalle:', err);
  }
}

document.getElementById('searchBtn').addEventListener('click', buscar);
document.getElementById('searchQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
document.getElementById('filterRegistro').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
document.getElementById('filterTipo').addEventListener('change', buscar);

// ------------------------------------------------------------
// LÓGICA DE IMPRESIÓN Y PDF
// ------------------------------------------------------------
async function imprimirFichaActual() {
  let printContainer = document.getElementById('print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    document.body.appendChild(printContainer);
  }

  const contenidoModal = document.getElementById('detailSheet').cloneNode(true);
  const botonCerrar = contenidoModal.querySelector('#closeDetail');
  if (botonCerrar) botonCerrar.parentElement.remove();

  printContainer.innerHTML = `<div class="print-page-item">${contenidoModal.innerHTML}</div>`;

  const imagenes = printContainer.querySelectorAll('img');
  await Promise.all(Array.from(imagenes).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }));

  window.print();
  printContainer.innerHTML = '';
}

const printPdfBtn = document.getElementById('printPdfBtn');
if (printPdfBtn) {
  printPdfBtn.addEventListener('click', async () => {
    const modalAbierto = document.getElementById('detailOverlay').style.display === 'flex';
    if (modalAbierto) {
      imprimirFichaActual();
      return;
    }

    if (!ultimosEspecimenes || ultimosEspecimenes.length === 0) {
      alert('No hay ejemplares en la lista para imprimir.');
      return;
    }

    let printContainer = document.getElementById('print-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      document.body.appendChild(printContainer);
    }

    printPdfBtn.textContent = '⏳ Cargando fotos...';
    printPdfBtn.disabled = true;

    const detallesCompletos = await Promise.all(
      ultimosEspecimenes.map(async (item) => {
        try {
          const r = await fetch(`${API}/especimenes/${item.id}`, { headers: authHeaders() });
          return r.ok ? await r.json() : item;
        } catch (err) {
          return item;
        }
      })
    );

    printContainer.innerHTML = detallesCompletos.map(esp => `
      <div class="print-page-item">
        ${construirHtmlFicha(esp, true)}
      </div>
    `).join('');

    const imagenes = printContainer.querySelectorAll('img');
    await Promise.all(Array.from(imagenes).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => { img.onload = res; img.onerror = res; });
    }));

    printPdfBtn.textContent = '🖨️ Imprimir PDF';
    printPdfBtn.disabled = false;

    setTimeout(() => {
      window.print();
      printContainer.innerHTML = '';
    }, 300);
  });
}

// ------------------------------------------------------------
// EXPORTACIÓN COMPLETA A EXCEL EN DOS HOJAS
// ------------------------------------------------------------
const exportExcelBtn = document.getElementById('exportExcelBtn');
if (exportExcelBtn) {
  exportExcelBtn.addEventListener('click', async () => {
    exportExcelBtn.textContent = '⏳ Descargando...';
    exportExcelBtn.disabled = true;

    try {
      const res = await fetch(`${API}/especimenes/exportar/excel`, {
        headers: authHeaders()
      });

      if (!res.ok) {
        throw new Error(`Error en el servidor: ${res.status}`);
      }

      const blob = await res.blob();
      const urlDescarga = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = urlDescarga;
      enlace.download = 'Herbario_DICIFO_Catalogo.xlsx';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(urlDescarga);
    } catch (err) {
      console.error('Fallo al exportar Excel:', err);
      alert('Ocurrió un error al descargar el catálogo en Excel.');
    } finally {
      exportExcelBtn.textContent = 'Exportar Excel';
      exportExcelBtn.disabled = false;
    }
  });
}

// ------------------------------------------------------------
// ESCÁNER ESTABLE CON GUÍA TRASLÚCIDA + SONIDO DE CONFIRMACIÓN
// ------------------------------------------------------------
let html5QrScanner = null;
let escaneandoActivo = false;

const btnScanCode = document.getElementById('btnScanCode');
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');

if (btnScanCode) {
  btnScanCode.addEventListener('click', async () => {
    inicializarAudioContext();

    scannerModal.style.display = 'flex';
    escaneandoActivo = true;

    const qrContainer = document.getElementById('qr-reader-container');
    if (qrContainer) {
      qrContainer.style.minHeight = '250px';
    }

    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode('qr-reader-container', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
    }

    const config = {
      fps: 20,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const width = Math.floor(viewfinderWidth * 0.90);
        const height = Math.floor(Math.min(viewfinderHeight * 0.45, 150));
        return { width, height };
      },
      aspectRatio: 1.0,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_128
      ]
    };

    try {
      await html5QrScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!escaneandoActivo) return;

          reproducirBeepExito();
          procesarLecturaExitosa(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error('Error al inicializar cámara:', err);
      alert('No se pudo acceder a la cámara. Revisa los permisos.');
      detenerScannerCamara();
    }
  });
}

// Procesamiento de clave y apertura de cédula
async function procesarLecturaExitosa(rawText) {
  escaneandoActivo = false;

  const codigoLimpio = rawText.replace(/[^a-zA-Z0-9_-]/g, '').trim();

  await detenerScannerCamara();

  const inputQ = document.getElementById('searchQ');
  const selectTipo = document.getElementById('filterTipo');
  const inputReg = document.getElementById('filterRegistro');

  if (inputQ) inputQ.value = '';
  if (selectTipo) selectTipo.value = '';
  if (inputReg) inputReg.value = codigoLimpio;

  setTimeout(async () => {
    try {
      let res = await fetch(`${API}/especimenes?numero_registro=${encodeURIComponent(codigoLimpio)}`, {
        headers: authHeaders()
      });

      let data = res.ok ? await res.json() : [];

      if (!data || data.length === 0) {
        const resFallback = await fetch(`${API}/especimenes?q=${encodeURIComponent(codigoLimpio)}`, {
          headers: authHeaders()
        });
        if (resFallback.ok) data = await resFallback.json();
      }

      if (data && data.length > 0) {
        ultimosEspecimenes = data;
        renderGrid(data);
        verDetalle(data[0].id);
      } else {
        alert(`Código leído: "${codigoLimpio}", pero no coincide con ningún registro en la base de datos.`);
      }
    } catch (err) {
      console.error('Fallo en la petición del ejemplar:', err);
      alert('Error de conexión al consultar el ejemplar.');
    }
  }, 120);
}

if (closeScannerBtn) {
  closeScannerBtn.addEventListener('click', detenerScannerCamara);
}

async function detenerScannerCamara() {
  escaneandoActivo = false;
  if (html5QrScanner && html5QrScanner.isScanning) {
    try {
      await html5QrScanner.stop();
    } catch (err) {
      console.error('Error al detener cámara:', err);
    }
  }
  scannerModal.style.display = 'none';
}
// Carga inicial
buscar();