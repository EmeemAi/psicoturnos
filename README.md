# 🌿 PsicoTurnos - Plataforma de Gestión y Turnos para Psicología Clínica

**PsicoTurnos** es una aplicación web moderna, estética y libre de fricciones diseñada especialmente para **psicólogas y psicólogos clínicos**. Permite gestionar la agenda del consultorio con herramientas de alta productividad y compartir un enlace directo y acogedor para que los pacientes reserven sus turnos en 3 simples pasos.

---

## 🚀 Cómo Iniciar la Aplicación (1 Clic)

### En Windows:
Simplemente haz doble clic sobre el archivo:
```text
Iniciar_PsicoTurnos.bat
```
La aplicación iniciará automáticamente y se abrirá en tu navegador web en `http://localhost:3000`.

### Desde la Terminal (Cualquier sistema):
```bash
python server.py
```
*(O también puedes abrir directamente el archivo `index.html` con cualquier navegador web como Chrome, Edge o Safari).*

---

## 🌟 Características Principales

### 👤 1. Experiencia del Paciente (Consultorio Digital Móvil)
- **Modo Paciente Limpio**: Al compartir el enlace directo con tus pacientes (`?paciente=1`), la interfaz oculta todo el panel de administración para que el paciente solo vea tu perfil profesional y el asistente de reserva.
- **Paso 1 - Selección de Consulta**: Servicios con duración, honorario y modalidad (*Presencial en consultorio* u *Online por videollamada*).
- **Paso 2 - Calendario Interactivo**: Selección del día y visualización clara de horarios disponibles divididos en turnos de Mañana ☀️ y Tarde 🌙.
- **Paso 3 - Formulario con Motivos de Consulta**: Selector ágil de motivos terapéuticos (*Ansiedad/Estrés, Autoestima, Vínculos/Pareja, Duelo, Crianza, etc.*) y aviso de confidencialidad médica ética.
- **Comprobante Inmediato**: Voucher digital con botón para **añadir a su Google Calendar** y botón para **enviarte confirmación por WhatsApp en un toque**.

### ⚙️ 2. Panel Profesional de la Psicóloga (Clave: `admin`)
- **Métricas del Día**: Resumen de sesiones de hoy, turnos próximos, total de pacientes y sesiones realizadas.
- **Botón "📋 Copiar Link Pacientes"**: En la barra superior, copia al portapapeles en 1 clic el enlace exacto listo para enviar por WhatsApp o colocar en tu perfil de Instagram.
- **Recordatorios por WhatsApp en 1 Clic**: Cada turno cuenta con un botón verde *"📲 Recordar por WhatsApp"* que abre el chat con el paciente con un mensaje cálido y respetuoso ya redactado (*"Hola [Nombre]! Te recuerdo nuestro turno de sesión terapéutica para el día..."*).
- **Fichero de Pacientes & Notas Clínicas Privadas (CRM)**: Historial completo de citas por paciente y apartado de **Notas de Evolución Terapéutica** (confidenciales, protegidas y almacenadas localmente).
- **Subida de Foto Propia**: Puedes subir tu foto profesional directamente desde tu computadora (JPG, PNG) con previsualización circular instantánea.
- **Gestión de Disponibilidad**: Ajuste de días laborables, franjas horarias por consultorio y bloqueo de feriados o vacaciones.

---

## 📅 ¿A Dónde Van los Turnos? (Backend & Google Calendar)

1. **Almacenamiento Local Inmediato (`localStorage`)**:
   - Todo se guarda en tu navegador al instante. No necesitas pagar hosting, servidores ni bases de datos.
2. **Sincronización con Google Sheets & Google Calendar (Gratis y sin servidores)**:
   - El proyecto incluye el archivo `google_apps_script.js`.
   - Si vinculas tu Google Script (guía de 3 pasos incluida en la pestaña de Configuración del panel):
     - **Cada reserva de un paciente se registra en tu hoja de Google Sheets**.
     - **Se crea automáticamente el evento en tu Google Calendar personal**, activando alertas y recordatorios en tu teléfono celular (Android o iPhone).
     - Al cancelar o reprogramar, tu Google Calendar se actualiza automáticamente.

---

## 💾 Copias de Seguridad (Backup)
En **Panel Profesional → Perfil & Configuración**, cuentas con botones para:
- **Descargar Backup Completo (JSON)**: Respalda todos tus turnos, notas clínicas y pacientes en un solo archivo.
- **Restaurar Backup**: Recupera tu información en cualquier momento o muévela a otra computadora.

---

*Desarrollado para brindar una solución completa, profesional y de máxima confianza a la práctica de la psicología clínica.*
