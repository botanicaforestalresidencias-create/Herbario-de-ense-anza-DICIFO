const API = 'https://curator-activist-unheard.ngrok-free.dev/api';
//const API = 'http://localhost:3000/api';

// Claves donde se guarda la sesión de alumno para usarla sin internet
const TOKEN_ALUMNO = 'tokenAlumno';
const SESION_ALUMNO = 'sesionAlumno';

const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const errorMsg = document.getElementById('errorMsg');
const guestLink = document.getElementById('guestLink');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');

const guardarSesion = (token, usuario) => {
  localStorage.setItem('token', token);
  localStorage.setItem('sesion', JSON.stringify(usuario));
};

// Alternar visibilidad de contraseña
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.textContent = isPassword ? '🔒' : '👁️';
  });
}

// Envío de formulario administrador / encargado (requiere servidor)
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('usuario').value.trim();
    const password = passwordInput.value;

    errorMsg.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error || 'Credenciales no válidas. Revisa tus datos.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar sesión como encargado';
        return;
      }

      guardarSesion(data.token, data.usuario);

      if (data.usuario.rol === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'consulta.html';
      }
    } catch (err) {
      errorMsg.textContent = 'No se pudo conectar con el servidor local.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar sesión como encargado';
    }
  });
}

// Acceso rápido para alumnos (funciona sin internet si ya entró una vez con conexión)
if (guestLink) {
  guestLink.addEventListener('click', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    guestLink.disabled = true;
    guestLink.textContent = 'Entrando al modo consulta...';

    const restaurarBoton = () => {
      guestLink.disabled = false;
      guestLink.innerHTML = '<span>🌿</span> Entrar como alumno (Modo Consulta)';
    };

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: 'alumno', password: 'alumno123' })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = 'Acceso de consulta no disponible temporalmente.';
        restaurarBoton();
        return;
      }

      // Se guarda la sesión de alumno para usarla después sin conexión
      localStorage.setItem(TOKEN_ALUMNO, data.token);
      localStorage.setItem(SESION_ALUMNO, JSON.stringify(data.usuario));
      guardarSesion(data.token, data.usuario);
      window.location.href = 'consulta.html';
    } catch (err) {
      // Sin conexión: usar la sesión de alumno guardada la última vez
      const tokenGuardado = localStorage.getItem(TOKEN_ALUMNO);
      const sesionGuardada = localStorage.getItem(SESION_ALUMNO);

      if (tokenGuardado && sesionGuardada) {
        try {
          guardarSesion(tokenGuardado, JSON.parse(sesionGuardada));
          window.location.href = 'consulta.html';
          return;
        } catch (parseError) {
          console.warn('Sesión de alumno guardada no válida:', parseError);
        }
      }

      errorMsg.textContent = 'Sin conexión. Conéctate a internet una vez para activar el modo consulta sin conexión.';
      restaurarBoton();
    }
  });
}