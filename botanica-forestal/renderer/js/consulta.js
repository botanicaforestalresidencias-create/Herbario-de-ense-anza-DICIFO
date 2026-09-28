/* ============================================================
   HERBARIO DIGITAL - CONSULTA.JS (VERSIÓN DEFINITIVA LIGHTBOX)
   ============================================================ */
const API = 'https://curator-activist-unheard.ngrok-free.dev/api';
//const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const sesion = JSON.parse(localStorage.getItem('sesion') || 'null');

if (!token) window.location.href = 'login.html';

let ultimosEspecimenes = [];
let indiceActual = 0;

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

function reproducirBeepExito() {
  try {
    if (navigator.vibrate) navigator.vibrate(120);
    inicializarAudioContext();
    if (!audioCtx) return;

    const oscilador = audioCtx.createOscillator();
    const nodoGanancia = audioCtx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(1800, audioCtx.currentTime);

    nodoGanancia.gain.setValueAtTime(0.18, audioCtx.currentTime);
    nodoGanancia.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

    oscilador.connect(nodoGanancia);
    nodoGanancia.connect(audioCtx.destination);

    oscilador.start(audioCtx.currentTime);
    oscilador.stop(audioCtx.currentTime + 0.12);
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
      <h3>${item.nombre_cientifico || item.especie || 'Sin identificar'}</h3>
      <div class="comun">${item.nombre_comun || '-'}</div>
      <div class="familia">Fam. ${item.familia || 'N/D'}</div>
    `;
    card.addEventListener('click', () => verDetalle(item.id));
    grid.appendChild(card);
  }
}

// ------------------------------------------------------------
// LIGHTBOX ESTANDARIZADO (TACHE ROJA ARRIBA A LA DERECHA)
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

  // El botón ahora está anclado a la derecha (right: 30px)
  overlay.innerHTML = `
    <button type="button" id="btnCerrarFoto" style="
      position: absolute;
      top: 30px;
      right: 30px;
      width: 48px;
      height: 48px;
      background: #ffffff;
      color: #153e23;
      border: 2px solid #153e23;
      border-radius: 50%;
      font-size: 32px;
      font-weight: bold;
      line-height: 1;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.6);
      z-index: 10;
      transition: all 0.2s ease;
    " onmouseover="this.style.background='#dc2626'; this.style.color='#ffffff'; this.style.borderColor='#dc2626'; this.style.transform='scale(1.15)';" 
      onmouseout="this.style.background='#ffffff'; this.style.color='#153e23'; this.style.borderColor='#153e23'; this.style.transform='scale(1)';"
      title="Cerrar">&times;</button>

    <img src="${srcRuta}" alt="Ejemplar ampliado" style="
      max-width: 85vw;
      max-height: 85vh;
      object-fit: contain;
      display: block;
      border-radius: 8px;
      border: 2px solid #2e834b;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      background: #111;
    ">
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

  let fotosGeneralesHtml = '';
  if (imgsPorCampo.general && imgsPorCampo.general.length > 0) {
    fotosGeneralesHtml = imgsPorCampo.general.map(img => {
      const urlCompleta = `${API.replace('/api', '')}/uploads/${img.ruta_archivo}`;
      return `<img src="${urlCompleta}" alt="Fotografía general" style="cursor: pointer;" title="Clic para ampliar">`;
    }).join('');
  }

  function filaFotos(campo) {
    const imgs = imgsPorCampo[campo];
    if (!imgs || imgs.length === 0) return '';
    const miniaturas = imgs.map(img => {
      const urlCompleta = `${API.replace('/api', '')}/uploads/${img.ruta_archivo}`;
      return `<img src="${urlCompleta}" alt="Foto de ${campo}" style="cursor: pointer;" title="Clic para ampliar">`;
    }).join('');
    return `<tr><td></td><td><div class="img-gallery">${miniaturas}</div></td></tr>`;
  }

  let orden = '-';
  const camposExtraRestantes = [];
  (e.campos_personalizados || []).forEach(c => {
    if (c.nombre_campo && c.nombre_campo.toLowerCase() === 'orden') {
      orden = c.valor || '-';
    } else {
      camposExtraRestantes.push(c);
    }
  });

  const filasTaxonomiaYEspecificas = `
    <tr><td class="label">Familia</td><td>${e.familia || '-'}</td></tr>
    <tr><td class="label">Orden</td><td>${orden}</td></tr>
    ${isAngio ? `
      <tr><td class="label">Hojas</td><td>${d.hojas || '-'}</td></tr>${filaFotos('hojas')}
      <tr><td class="label">Filotaxia</td><td>${d.filotaxia || '-'}</td></tr>
      <tr><td class="label">Flor</td><td>${d.flor || '-'}</td></tr>${filaFotos('flor')}
      <tr><td class="label">Fruto</td><td>${d.fruto || '-'}</td></tr>${filaFotos('fruto')}
      <tr><td class="label">Sexualidad</td><td>${d.sexualidad || '-'}</td></tr>${filaFotos('sexualidad')}
    ` : `
      <tr><td class="label">Subgénero</td><td>${d.subgenero || '-'}</td></tr>
      <tr><td class="label">Sección</td><td>${d.seccion || '-'}</td></tr>
      <tr><td class="label">Cono</td><td>${d.cono || '-'} (long.${d.longitud_cono || '-'}, color ${d.color_cono || '-'})</td></tr>${filaFotos('cono')}
      <tr><td class="label">Umbo</td><td>${d.umbo || '-'}</td></tr>
      <tr><td class="label">Tipo de semilla</td><td>${d.tipo_semilla || '-'}</td></tr>${filaFotos('semilla')}
      <tr><td class="label">Acículas</td><td>${d.forma_aciculas || '-'} · No. ${d.numero_aciculas || '-'} · long. ${d.longitud_aciculas || '-'}</td></tr>${filaFotos('aciculas')}
      <tr><td class="label">Bráctea</td><td>${d.bractea_foliar || '-'}</td></tr>
    `}
  `;

  const filasDistribucion = `
    <tr><td class="label">Distribución</td><td>${e.distribucion || '-'}</td></tr>
    ${filaFotos('distribucion')}
    ${!isAngio ? `<tr><td class="label">Altitud</td><td>${d.altitud || '-'}</td></tr>` : ''}
  `;

  const filasExtra = camposExtraRestantes.map(c => `
    <tr><td class="label">${c.nombre_campo}</td><td>${c.valor || '-'}</td></tr>
  `).join('');

  return `
    ${!esImpresion ? `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn btn-secondary" onclick="cambiarFicha(-1)" style="padding: 4px 10px; font-size: 12px; cursor: pointer;" title="Ficha anterior (Flecha Izquierda)"> Anterior</button>
          <button type="button" class="btn btn-secondary" onclick="cambiarFicha(1)" style="padding: 4px 10px; font-size: 12px; cursor: pointer;" title="Ficha siguiente (Flecha Derecha)"> Siguiente </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary" onclick="imprimirFichaActual()" style="padding: 4px 10px; font-size: 12px; cursor: pointer;">🖨️ Imprimir Cédula</button>
          <button class="close-btn" id="closeDetail" style="position: static; font-size: 22px; cursor: pointer;">&times;</button>
        </div>
      </div>
    ` : ''}
    
    <div class="ficha-header-layout">
      <div class="ficha-left">
        <span class="badge-folio">Folio: <strong>${e.numero_registro}</strong></span>
        <h2 style="font-style: italic; margin: 10px 0 2px;">${e.nombre_cientifico || e.especie || 'Sin identificar'}</h2>
        <div class="comun">${e.nombre_comun || ''}</div>
      </div>
      
      <div class="ficha-right">
        ${fotosGeneralesHtml ? `<div class="main-photo-box">${fotosGeneralesHtml}</div>` : ''}
      </div>
    </div>

    <table class="spec-table">${filasTaxonomiaYEspecificas}</table>
    
    <div class="section-title">Distribución y Hábitat</div>
    <table class="spec-table">${filasDistribucion}</table>
    
    ${e.otras_caracteristicas ? `<div class="section-title">Otras características</div><p style="font-size:12px; line-height:1.4; padding-left:4px;">${e.otras_caracteristicas}</p>` : ''}
    
    ${filasExtra ? `<div class="section-title">Otros campos</div><table class="spec-table">${filasExtra}</table>` : ''}
  `;
}

// ------------------------------------------------------------
// NAVEGACIÓN ENTRE FICHAS (BOTONES Y FLECHAS DE TECLADO)
// ------------------------------------------------------------
function cambiarFicha(direccion) {
  if (!ultimosEspecimenes || ultimosEspecimenes.length === 0) return;
  indiceActual += direccion;
  if (indiceActual < 0) indiceActual = ultimosEspecimenes.length - 1;
  if (indiceActual >= ultimosEspecimenes.length) indiceActual = 0;
  verDetalle(ultimosEspecimenes[indiceActual].id);
}

// ------------------------------------------------------------
// DETALLE DEL EJEMPLAR
// ------------------------------------------------------------
let escCerrarFichaHandler = null;

async function verDetalle(id) {
  try {
    const idxEncontrado = ultimosEspecimenes.findIndex(item => item.id == id);
    if (idxEncontrado !== -1) indiceActual = idxEncontrado;

    const res = await fetch(`${API}/especimenes/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const e = await res.json();

    const detailSheet = document.getElementById('detailSheet');
    const detailOverlay = document.getElementById('detailOverlay');

    detailSheet.innerHTML = construirHtmlFicha(e, false);

    setTimeout(() => {
      detailSheet.querySelectorAll('img').forEach(imgEl => {
        imgEl.style.cursor = 'pointer';
        imgEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          abrirImagenGrande(imgEl.src);
        });
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

    const btnCerrar = document.getElementById('closeDetail');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarDetalleModal);

    if (escCerrarFichaHandler) document.removeEventListener('keydown', escCerrarFichaHandler);
    escCerrarFichaHandler = (ev) => {
      if (document.querySelector('.image-modal-overlay')) return;
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        cerrarDetalleModal();
      } else if (ev.key === 'ArrowLeft') {
        cambiarFicha(-1);
      } else if (ev.key === 'ArrowRight') {
        cambiarFicha(1);
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
// IMPRESIÓN Y PDF
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
  const navContainer = contenidoModal.querySelector('.ficha-header-layout')?.previousElementSibling;
  if (navContainer) navContainer.remove();

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
// EXPORTACIÓN A EXCEL
// ------------------------------------------------------------
const exportExcelBtn = document.getElementById('exportExcelBtn');
if (exportExcelBtn) {
  exportExcelBtn.addEventListener('click', async () => {
    exportExcelBtn.textContent = '⏳ Descargando...';
    exportExcelBtn.disabled = true;

    try {
      const res = await fetch(`${API}/especimenes/exportar/excel`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Error en el servidor: ${res.status}`);

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
// ESCÁNER DE CÓDIGOS
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
    if (qrContainer) qrContainer.style.minHeight = '250px';

    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode('qr-reader-container', {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
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

buscar();