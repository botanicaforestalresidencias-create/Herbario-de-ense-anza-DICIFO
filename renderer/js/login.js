const API = 'https://curator-activist-unheard.ngrok-free.dev/api';
//const API = 'http://localhost:3000/api';

const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const errorMsg = document.getElementById('errorMsg');
const guestLink = document.getElementById('guestLink');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');

// Alternar visibilidad de contraseña
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.textContent = isPassword ? '🔒' : '👁️';
  });
}

// Envío de formulario administrador / encargado
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
        submitBtn.textContent = 'Ingresar como encargado';
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('sesion', JSON.stringify(data.usuario));

      if (data.usuario.rol === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'consulta.html';
      }
    } catch (err) {
      errorMsg.textContent = 'No se pudo conectar con el servidor local.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar como encargado';
    }
  });
}

// Acceso rápido para alumnos
if (guestLink) {
  guestLink.addEventListener('click', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    guestLink.disabled = true;
    guestLink.textContent = 'Entrando al modo consulta...';

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: 'alumno', password: 'alumno123' })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = 'Acceso de consulta no disponible temporalmente.';
        guestLink.disabled = false;
        guestLink.innerHTML = '<span>🌿</span> Entrar como alumno (Modo Consulta)';
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('sesion', JSON.stringify(data.usuario));
      window.location.href = 'consulta.html';
    } catch (err) {
      errorMsg.textContent = 'No se pudo conectar con el servidor local.';
      guestLink.disabled = false;
      guestLink.innerHTML = '<span>🌿</span> Entrar como alumno (Modo Consulta)';
    }
  });
}