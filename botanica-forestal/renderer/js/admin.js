const API = 'https://curator-activist-unheard.ngrok-free.dev/api';
//const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const sesion = JSON.parse(localStorage.getItem('sesion') || 'null');

if (!token || !sesion || sesion.rol !== 'admin') {
  window.location.href = 'login.html';
}

const userLabel = document.getElementById('userLabel');
if (userLabel) userLabel.textContent = `Sesión: ${sesion.nombre}`;

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

let ejemplaresCargados = [];
let seleccionadosIds = new Set();

function actualizarContadorSeleccionados() {
  const badge = document.getElementById('selectedCount');
  if (badge) badge.textContent = `(${seleccionadosIds.size})`;

  const masterCheck = document.getElementById('selectAllCheckbox');
  if (masterCheck && ejemplaresCargados.length > 0) {
    masterCheck.checked = seleccionadosIds.size === ejemplaresCargados.length;
  }
}

async function buscar() {
  const q = document.getElementById('searchQ').value.trim();
  const tipo = document.getElementById('filterTipo').value;
  const orden = document.getElementById('filterOrden') ? document.getElementById('filterOrden').value : 'familia_asc';
  
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tipo) params.set('tipo', tipo);
  if (orden) params.set('orden', orden);

  try {
    const res = await fetch(`${API}/especimenes?${params.toString()}`, { headers: authHeaders() });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json();
    ejemplaresCargados = data;
    seleccionadosIds.clear();
    actualizarContadorSeleccionados();
    renderGrid(data);
  } catch (err) {
    console.error('Error al cargar ejemplares:', err);
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
    
    const estaCheck = seleccionadosIds.has(item.id) ? 'checked' : '';

    card.innerHTML = `
      <!-- Fila superior: Tipo a la izquierda | Registro y Checkbox a la derecha -->
      <div class="card-header-row">
        <span class="tipo-tag">${item.tipo}</span>
        <div style="display: flex; align-items: center; gap: 8px;" onclick="event.stopPropagation();">
          <span class="reg-stamp">${item.numero_registro}</span>
          <input type="checkbox" class="specimen-check" data-id="${item.id}" ${estaCheck} 
                 title="Seleccionar para imprimir etiqueta"
                 style="width: 18px; height: 18px; cursor: pointer; accent-color: #153e23; margin: 0;">
        </div>
      </div>

      <h3>${item.nombre_cientifico || item.especie || 'Sin identificar'}</h3>
      <div class="comun">${item.nombre_comun || '—'}</div>
      <div class="familia">Fam. ${item.familia || 'N/D'}</div>
      
      <button type="button" class="btn btn-sm text-danger px-2 py-0" 
              style="position: absolute; bottom: 8px; right: 10px; z-index: 5; font-weight: bold; background: transparent; border: none; font-size: 15px; cursor: pointer;" 
              onclick="event.stopPropagation(); eliminarRapido(${item.id})" title="Eliminar ejemplar">❌</button>
    `;

    const chk = card.querySelector('.specimen-check');
    chk.addEventListener('change', (ev) => {
      if (ev.target.checked) {
        seleccionadosIds.add(item.id);
      } else {
        seleccionadosIds.delete(item.id);
      }
      actualizarContadorSeleccionados();
    });

    card.addEventListener('click', () => abrirFormulario(item.id));
    grid.appendChild(card);
  }
}

// Checkbox maestro "Todos"
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', (e) => {
    const checado = e.target.checked;
    const allChecks = document.querySelectorAll('.specimen-check');
    allChecks.forEach(chk => {
      chk.checked = checado;
      const id = parseInt(chk.dataset.id, 10);
      if (checado) seleccionadosIds.add(id);
      else seleccionadosIds.delete(id);
    });
    actualizarContadorSeleccionados();
  });
}

// ------------------------------------------------------------
// IMPRESIÓN POR LOTE DE ETIQUETAS BOTÁNICAS COMPACTAS
// ------------------------------------------------------------
const printLabelsBtn = document.getElementById('printLabelsBtn');
if (printLabelsBtn) {
  printLabelsBtn.addEventListener('click', async () => {
    if (seleccionadosIds.size === 0) {
      Swal.fire('Atención', 'Marca las casillas de los ejemplares cuyas etiquetas deseas imprimir.', 'info');
      return;
    }

    let printArea = document.getElementById('label-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'label-print-area';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = '';

    Swal.fire({
      title: 'Generando etiquetas...',
      text: `Procesando ${seleccionadosIds.size} ejemplares.`,
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const ids = Array.from(seleccionadosIds);
      const ejemplaresCompletos = await Promise.all(
        ids.map(async (id) => {
          const r = await fetch(`${API}/especimenes/${id}`, { headers: authHeaders() });
          return r.ok ? await r.json() : null;
        })
      );

      const validos = ejemplaresCompletos.filter(Boolean);

      validos.forEach((e, idx) => {
        const claveLimpia = String(e.numero_registro || '').replace(/[^a-zA-Z0-9_-]/g, '').trim();
        const svgId = `barcode-svg-${idx}`;

        const card = document.createElement('div');
        card.className = 'herb-label-card';
        card.innerHTML = `
          <div class="herb-label-header">
            <p class="title">Herbario de Enseñanza – Botánica Forestal</p>
            <p class="inst">DICIFO · Universidad Autónoma Chapingo</p>
          </div>
          
          <div class="herb-label-body">
            <p class="specie">${e.nombre_cientifico || e.especie || 'Sin identificar'}</p>
            <div class="meta-row">
              <span><strong>Fam:</strong> ${e.familia || 'N/D'}</span>
              <span><strong>Tipo:</strong> ${e.tipo}</span>
            </div>
            <div class="meta-row">
              <span><strong>N. común:</strong> ${e.nombre_comun || '—'}</span>
            </div>
          </div>

          <div class="herb-label-barcode">
            <svg id="${svgId}"></svg>
          </div>
        `;
        printArea.appendChild(card);

        setTimeout(() => {
          try {
            JsBarcode(`#${svgId}`, claveLimpia, {
              format: 'CODE128',
              width: 1.6,
              height: 28,
              displayValue: true,
              fontSize: 10,
              fontOptions: 'bold',
              textMargin: 1,
              margin: 2,
              background: '#ffffff',
              lineColor: '#000000'
            });
          } catch (errBar) {
            console.error(`Fallo código en clave ${claveLimpia}:`, errBar);
          }
        }, 10);
      });

      setTimeout(() => {
        Swal.close();
        document.body.classList.add('printing-labels');
        window.print();
        document.body.classList.remove('printing-labels');
        printArea.innerHTML = '';
      }, 350);

    } catch (err) {
      console.error('Error al generar etiquetas:', err);
      Swal.fire('Error', 'No se pudieron procesar las etiquetas para impresión.', 'error');
    }
  });
}

async function eliminarRapido(id) {
  const resultado = await Swal.fire({
    title: '¿Estás segura?',
    text: "¡Este ejemplar se borrará permanentemente!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (resultado.isConfirmed) {
    try {
      const res = await fetch(`${API}/especimenes/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        Swal.fire('¡Eliminado!', 'El espécimen ha sido borrado con éxito.', 'success');
        buscar();
      } else {
        Swal.fire('Error', 'No se pudo eliminar el registro.', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
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

// ---------- Formulario (crear / editar) ----------
const form = document.getElementById('specimenForm');
const formOverlay = document.getElementById('formOverlay');

function toggleTipoFields(fromUserAction = false) {
  const tipo = document.getElementById('f_tipo').value;
  const angioFields = document.getElementById('camposAngiosperma');
  const gimnoFields = document.getElementById('camposGimnosperma');
  if (angioFields) angioFields.style.display = tipo === 'Angiosperma' ? 'grid' : 'none';
  if (gimnoFields) gimnoFields.style.display = tipo === 'Gimnosperma' ? 'grid' : 'none';

  if (fromUserAction) {
    renderCamposPersonalizados([]);
  }
}
const fTipoSelect = document.getElementById('f_tipo');
if (fTipoSelect) fTipoSelect.addEventListener('change', () => toggleTipoFields(true));

const CAMPOS_FOTO_POR_TIPO = {
  Angiosperma: ['general', 'hojas', 'flor', 'fruto', 'sexualidad', 'distribucion'],
  Gimnosperma: ['general', 'cono', 'semilla', 'aciculas', 'distribucion']
};
const TODOS_LOS_CAMPOS_FOTO = ['general', 'hojas', 'flor', 'fruto', 'sexualidad', 'cono', 'semilla', 'aciculas', 'distribucion'];

function limpiarFormulario() {
  if (form) form.reset();
  const specimenId = document.getElementById('specimenId');
  if (specimenId) specimenId.value = '';
  const formTitle = document.getElementById('formTitle');
  if (formTitle) formTitle.textContent = 'Nuevo ejemplar';
  
  const numReg = document.getElementById('f_numero_registro');
  if (numReg) numReg.disabled = false;
  const tipoReg = document.getElementById('f_tipo');
  if (tipoReg) tipoReg.disabled = false;

  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) deleteBtn.style.display = 'none';
  const formError = document.getElementById('formError');
  if (formError) formError.textContent = '';

  TODOS_LOS_CAMPOS_FOTO.forEach((campo) => {
    const wrap = document.getElementById(`photoWrap_${campo}`);
    if (wrap) wrap.style.display = 'none';
    const thumbs = document.getElementById(`thumbs_${campo}`);
    if (thumbs) thumbs.innerHTML = '';
  });

  const container = document.getElementById('customFieldsContainer');
  if (container) container.innerHTML = '';
  
  toggleTipoFields(false);
}

function mostrarSlotsDeFoto(tipo) {
  const activos = CAMPOS_FOTO_POR_TIPO[tipo] || [];
  TODOS_LOS_CAMPOS_FOTO.forEach((campo) => {
    const wrap = document.getElementById(`photoWrap_${campo}`);
    if (wrap) {
      wrap.style.display = activos.includes(campo) ? 'block' : 'none';
    }
  });
}

function crearThumbElement(img) {
  const thumb = document.createElement('div');
  thumb.className = 'photo-thumb';
  const urlCompleta = `${API.replace('/api','')}/uploads/${img.ruta_archivo}`;
  
  thumb.innerHTML = `
    <img src="${urlCompleta}" alt="Foto" style="cursor: pointer;" title="Clic para ampliar">
    <button type="button" class="remove-thumb" data-id="${img.id}" title="Eliminar foto">×</button>
  `;

  thumb.querySelector('img').addEventListener('click', (e) => {
    e.stopPropagation();
    abrirImagenGrande(urlCompleta);
  });

  thumb.querySelector('.remove-thumb').addEventListener('click', async (e) => {
    e.stopPropagation();
    await fetch(`${API}/imagenes/${img.id}`, { method: 'DELETE', headers: authHeaders() });
    thumb.remove();
  });

  return thumb;
}

function renderGaleria(imagenes) {
  TODOS_LOS_CAMPOS_FOTO.forEach((campo) => {
    const cont = document.getElementById(`thumbs_${campo}`);
    if (cont) cont.innerHTML = '';
  });

  imagenes.forEach((img) => {
    const campo = TODOS_LOS_CAMPOS_FOTO.includes(img.campo) ? img.campo : 'general';
    const contenedor = document.getElementById(`thumbs_${campo}`);
    if (!contenedor) return;

    const thumb = crearThumbElement(img);
    contenedor.appendChild(thumb);
  });
}

if (form) {
  form.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('photo-input')) return;

    const especimenId = document.getElementById('specimenId').value;
    const campo = e.target.dataset.campo;
    const archivo = e.target.files[0];
    if (!especimenId) {
      Swal.fire('Atención', 'Primero guarda el ejemplar antes de subir fotos.', 'info');
      e.target.value = '';
      return;
    }
    if (!archivo) return;

    const fd = new FormData();
    fd.append('campo', campo); 
    fd.append('imagen', archivo);

    const res = await fetch(`${API}/imagenes/${especimenId}`, {
      method: 'POST',
      headers: authHeaders(), 
      body: fd
    });

    e.target.value = '';

    if (res.ok) {
      const nueva = await res.json();
      const contenedor = document.getElementById(`thumbs_${campo}`);
      if (contenedor) {
        const thumb = crearThumbElement(nueva);
        contenedor.appendChild(thumb);
      }
    } else {
      Swal.fire('Error', 'No se pudo subir la imagen.', 'error');
    }
  });
}

const newBtn = document.getElementById('newBtn');
if (newBtn) {
  newBtn.addEventListener('click', () => {
    limpiarFormulario();
    renderCamposPersonalizados([]);
    if (formOverlay) formOverlay.style.display = 'flex';
  });
}

const closeForm = document.getElementById('closeForm');
if (closeForm) closeForm.addEventListener('click', () => { if (formOverlay) formOverlay.style.display = 'none'; });

const cancelBtn = document.getElementById('cancelBtn');
if (cancelBtn) cancelBtn.addEventListener('click', () => { if (formOverlay) formOverlay.style.display = 'none'; });

async function abrirFormulario(id) {
  const res = await fetch(`${API}/especimenes/${id}`, { headers: authHeaders() });
  if (!res.ok) return;
  const e = await res.json();
  const d = e.detalle || {};

  limpiarFormulario();
  document.getElementById('formTitle').textContent = `Editar ejemplar — ${e.numero_registro}`;
  document.getElementById('specimenId').value = e.id;
  document.getElementById('f_numero_registro').value = e.numero_registro;
  document.getElementById('f_numero_registro').disabled = true; 
  document.getElementById('f_tipo').value = e.tipo;
  document.getElementById('f_tipo').disabled = true; 
  document.getElementById('f_familia').value = e.familia || '';
  document.getElementById('f_nombre_cientifico').value = e.nombre_cientifico || '';
  document.getElementById('f_nombre_comun').value = e.nombre_comun || '';
  document.getElementById('f_distribucion').value = e.distribucion || '';
  document.getElementById('f_otras_caracteristicas').value = e.otras_caracteristicas || '';

  if (e.tipo === 'Angiosperma') {
    document.getElementById('a_hojas').value = d.hojas || '';
    document.getElementById('a_filotaxia').value = d.filotaxia || '';
    document.getElementById('a_flor').value = d.flor || '';
    document.getElementById('a_fruto').value = d.fruto || '';
    document.getElementById('a_sexualidad').value = d.sexualidad || '';
  } else {
    document.getElementById('g_subgenero').value = d.subgenero || '';
    document.getElementById('g_seccion').value = d.seccion || '';
    document.getElementById('g_cono').value = d.cono || '';
    document.getElementById('g_longitud_cono').value = d.longitud_cono || '';
    document.getElementById('g_color_cono').value = d.color_cono || '';
    document.getElementById('g_umbo').value = d.umbo || '';
    document.getElementById('g_largo_pedunculo').value = d.largo_pedunculo || '';
    document.getElementById('g_tipo_semilla').value = d.tipo_semilla || '';
    document.getElementById('g_forma_aciculas').value = d.forma_aciculas || '';
    document.getElementById('g_numero_aciculas').value = d.numero_aciculas || '';
    document.getElementById('g_longitud_aciculas').value = d.longitud_aciculas || '';
    document.getElementById('g_vaina').value = d.vaina || '';
    document.getElementById('g_bractea_foliar').value = d.bractea_foliar || '';
    document.getElementById('g_altitud').value = d.altitud || '';
  }
  
  toggleTipoFields(false);
  
  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) deleteBtn.style.display = 'inline-block';
  mostrarSlotsDeFoto(e.tipo);
  renderGaleria(e.imagenes || []);
  renderCamposPersonalizados(e.campos_personalizados || []);

  if (formOverlay) formOverlay.style.display = 'flex';
}

// --- LÓGICA DE CAMPOS PERSONALIZADOS ---
async function renderCamposPersonalizados(camposActuales = []) {
  const tipoActual = document.getElementById('f_tipo').value;

  try {
    const res = await fetch(`${API}/especimenes/campos-unicos?tipo=${tipoActual}`, { headers: authHeaders() });
    const nombresUniversales = res.ok ? await res.json() : [];

    const camposARenderizar = [...camposActuales];

    const nombresExistentes = camposActuales
      .map(c => c.nombre_campo ? c.nombre_campo.trim().toLowerCase() : '')
      .filter(n => n !== '');

    nombresUniversales.forEach(nombre => {
      if (nombre && !nombresExistentes.includes(nombre.trim().toLowerCase())) {
        camposARenderizar.push({ nombre_campo: nombre.trim(), valor: '' });
      }
    });

    const container = document.getElementById('customFieldsContainer');
    if (!container) return;
    
    container.innerHTML = '';

    camposARenderizar.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'custom-field-row';
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      row.style.marginBottom = '5px';
      
      row.innerHTML = `
        <input type="text" class="custom-name" placeholder="Nombre del campo" value="${c.nombre_campo || ''}" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
        <input type="text" class="custom-val" placeholder="Valor" value="${c.valor || ''}" style="flex: 2; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
        <button type="button" class="remove-custom-btn" style="padding: 6px 10px; background: #d33; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Eliminar campo">×</button>
      `;

      row.querySelector('.remove-custom-btn').onclick = () => row.remove();
      container.appendChild(row);
    });

  } catch (err) {
    console.error('Error cargando atributos universales:', err);
  }
}

function obtenerCamposPersonalizadosDesdeDOM() {
  const container = document.getElementById('customFieldsContainer');
  if (!container) return [];
  const rows = container.querySelectorAll('.custom-field-row');
  const lista = [];
  rows.forEach(row => {
    const nombre_campo = row.querySelector('.custom-name').value.trim();
    const valor = row.querySelector('.custom-val').value.trim();
    if (nombre_campo || valor) {
      lista.push({ nombre_campo, valor });
    }
  });
  return lista;
}

function asegurarBotonAgregarCampo() {
  const oldBtn = document.getElementById('addCustomFieldBtn');
  if (!oldBtn) return;
  
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.onclick = (e) => {
    e.preventDefault();
    const container = document.getElementById('customFieldsContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '5px';
    
    row.innerHTML = `
      <input type="text" class="custom-name" placeholder="Nombre del campo" value="" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
      <input type="text" class="custom-val" placeholder="Valor" value="" style="flex: 2; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
      <button type="button" class="remove-custom-btn" style="padding: 6px 10px; background: #d33; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Eliminar campo">×</button>
    `;

    row.querySelector('.remove-custom-btn').onclick = () => row.remove();
    container.appendChild(row);
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', asegurarBotonAgregarCampo);
} else {
  asegurarBotonAgregarCampo();
}

function construirPayload() {
  const tipo = document.getElementById('f_tipo').value;
  const detalle = tipo === 'Angiosperma' ? {
    hojas: document.getElementById('a_hojas').value,
    filotaxia: document.getElementById('a_filotaxia').value,
    flor: document.getElementById('a_flor').value,
    fruto: document.getElementById('a_fruto').value,
    sexualidad: document.getElementById('a_sexualidad').value
  } : {
    subgenero: document.getElementById('g_subgenero').value,
    seccion: document.getElementById('g_seccion').value,
    cono: document.getElementById('g_cono').value,
    longitud_cono: document.getElementById('g_longitud_cono').value,
    color_cono: document.getElementById('g_color_cono').value,
    umbo: document.getElementById('g_umbo').value,
    largo_pedunculo: document.getElementById('g_largo_pedunculo').value,
    tipo_semilla: document.getElementById('g_tipo_semilla').value,
    forma_aciculas: document.getElementById('g_forma_aciculas').value,
    numero_aciculas: document.getElementById('g_numero_aciculas').value,
    longitud_aciculas: document.getElementById('g_longitud_aciculas').value,
    vaina: document.getElementById('g_vaina').value,
    bractea_foliar: document.getElementById('g_bractea_foliar').value,
    altitud: document.getElementById('g_altitud').value
  };

  return {
    numero_registro: document.getElementById('f_numero_registro').value.trim(),
    tipo,
    familia: document.getElementById('f_familia').value,
    nombre_cientifico: document.getElementById('f_nombre_cientifico').value,
    nombre_comun: document.getElementById('f_nombre_comun').value,
    distribucion: document.getElementById('f_distribucion').value,
    otras_caracteristicas: document.getElementById('f_otras_caracteristicas').value,
    detalle,
    campos_personalizados: obtenerCamposPersonalizadosDesdeDOM()
  };
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('specimenId').value;
    const payload = construirPayload();
    const errorMsg = document.getElementById('formError');
    if (errorMsg) errorMsg.textContent = '';

    try {
      let res, data;
      if (id) {
        res = await fetch(`${API}/especimenes/${id}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API}/especimenes`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
      }
      data = await res.json();
      if (!res.ok) { if (errorMsg) errorMsg.textContent = data.error || 'Error al guardar'; return; }

      if (!id) {
        document.getElementById('specimenId').value = data.id;
        document.getElementById('f_numero_registro').disabled = true;
        document.getElementById('f_tipo').disabled = true;
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        mostrarSlotsDeFoto(data.tipo);
        document.getElementById('formTitle').textContent = `Editar ejemplar — ${data.numero_registro}`;
        if (errorMsg) {
          errorMsg.style.color = 'var(--forest, #2c4a3e)';
          errorMsg.textContent = 'Ejemplar guardado. Ya puedes subir imágenes.';
        }
        buscar();
        return;
      }

      if (formOverlay) formOverlay.style.display = 'none';
      buscar();
    } catch (err) {
      if (errorMsg) errorMsg.textContent = 'No se pudo conectar con el servidor local.';
    }
  });
}

const deleteBtnEl = document.getElementById('deleteBtn');
if (deleteBtnEl) {
  deleteBtnEl.addEventListener('click', async () => {
    const id = document.getElementById('specimenId').value;
    if (!id) return;
    
    const resultado = await Swal.fire({
      title: '¿Estás segura?',
      text: "¡Este ejemplar se borrará permanentemente!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      const res = await fetch(`${API}/especimenes/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        if (formOverlay) formOverlay.style.display = 'none';
        buscar();
        Swal.fire('¡Eliminado!', 'El espécimen ha sido borrado con éxito.', 'success');
      }
    }
  });
}

const searchBtnEl = document.getElementById('searchBtn');
if (searchBtnEl) searchBtnEl.addEventListener('click', buscar);

const searchQEl = document.getElementById('searchQ');
if (searchQEl) searchQEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });

const filterTipoEl = document.getElementById('filterTipo');
if (filterTipoEl) filterTipoEl.addEventListener('change', buscar);

const filterOrdenEl = document.getElementById('filterOrden');
if (filterOrdenEl) filterOrdenEl.addEventListener('change', buscar);

const excelInputEl = document.getElementById('excelInput');
if (excelInputEl) {
  excelInputEl.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const fd = new FormData();
    fd.append('documento', archivo);

    Swal.fire({
      title: 'Importando...',
      text: 'Procesando datos del Excel, por favor espera.',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
    
    try {
      const res = await fetch(`${API}/especimenes/importar`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd
      });

      const data = await res.json();
      if (res.ok) {
        Swal.fire('¡Importación exitosa!', data.mensaje, 'success');
        buscar();
      } else {
        Swal.fire('Error', `No se pudo importar: ${data.error}`, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'No se pudo conectar con el servidor local para importar.', 'error');
    }
    
    e.target.value = '';
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (document.querySelector('.image-modal-overlay')) return;
    if (formOverlay && formOverlay.style.display !== 'none') {
      formOverlay.style.display = 'none';
    }
  }
});

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

buscar();