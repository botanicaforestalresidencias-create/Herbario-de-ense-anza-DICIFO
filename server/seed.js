// Crea el usuario administrador inicial.
// Ejecutar una sola vez con: npm run seed
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  try {
    const [existing] = await pool.query(
      'SELECT id FROM usuarios WHERE usuario = ?',
      ['admin']
    );

    if (existing.length > 0) {
      console.log('El usuario admin ya existe. No se hizo nada.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash('admin123', 10);

    await pool.query(
      'INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)',
      ['Encargado de Área', 'admin', passwordHash, 'admin']
    );

    console.log('Usuario admin creado correctamente.');
    console.log('   usuario: admin');
    console.log('   contraseña: admin123');
    console.log('IMPORTANTE: cambia esta contraseña después del primer inicio de sesión.');

    // Usuario "invitado" de solo consulta, para que los alumnos entren sin
    // tener que pedir una cuenta individual al encargado del área.
    const [existingGuest] = await pool.query(
      'SELECT id FROM usuarios WHERE usuario = ?',
      ['alumno']
    );
    if (existingGuest.length === 0) {
      const guestHash = await bcrypt.hash('alumno123', 10);
      await pool.query(
        'INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)',
        ['Acceso de consulta', 'alumno', guestHash, 'alumno']
      );
      console.log('Usuario alumno (consulta) creado: usuario "alumno" / contraseña "alumno123"');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error al crear el usuario admin:', err.message);
    process.exit(1);
  }
}

seed();
