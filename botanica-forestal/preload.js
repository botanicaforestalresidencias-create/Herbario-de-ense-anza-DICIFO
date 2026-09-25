// Por ahora la app renderer habla directo con la API local (http://localhost:3000/api)
// vía fetch(), así que no se necesita exponer nada especial todavía.
// Este archivo queda listo para exponer funciones nativas (diálogos de archivo,
// impresión, notificaciones del sistema, etc.) conforme el proyecto crezca.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  apiBaseUrl: 'http://localhost:3000/api'
});
