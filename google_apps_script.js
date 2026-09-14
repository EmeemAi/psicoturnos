/**
 * ==========================================================================
 * INSTRUCCIONES DE INSTALACIÓN EN GOOGLE DRIVE
 * ==========================================================================
 * 
 * Sigue estos sencillos pasos para tener tu base de datos y Google Calendar sincronizados:
 * 
 * 1. Crea una hoja de cálculo nueva en Google Sheets (ej: "Mis Turnos Agendados").
 * 2. En el menú superior, ve a "Extensiones" -> "Apps Script".
 * 3. Borra todo el código que aparezca por defecto en el editor.
 * 4. Pega todo el código de este archivo.
 * 5. Haz clic en el botón de guardar (icono de disco).
 * 6. En la parte superior derecha, haz clic en el botón "Implementar" -> "Nueva implementación".
 * 7. En el menú de rueda dentada (tipo), elige "Aplicación web".
 * 8. Configura los parámetros:
 *    - Descripción: "Servidor de psico-turnos"
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquiera" (esto es obligatorio para que el formulario web pueda guardar datos sin pedirle login de Google al paciente).
 * 9. Haz clic en "Implementar" y autoriza los permisos que te pida Google (haz clic en "Configuración avanzada" y "Ir a Proyecto sin título (no seguro)" para aprobar tu propio script).
 * 10. Copia la "URL de la aplicación web" (termina en `/exec`).
 * 11. Abre tu aplicación de turnos, ve a "Panel Profesional" -> "Perfil / Config", pega la URL en el campo "URL de Sincronización Google Sheets" y guarda.
 * 
 * ¡Listo! Ya tienes una base de datos real en internet conectada a tu Google Calendar.
 */

// Nombre de la pestaña de la hoja de cálculo
const SHEET_NAME = 'Turnos';

// Configuración inicial de la planilla al arrancar
function setupSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        // Escribir cabeceras en la primera fila
        const headers = [
            'ID Turno', 
            'ID Servicio', 
            'Fecha', 
            'Hora', 
            'Duración (Min)', 
            'Paciente', 
            'Teléfono', 
            'Email', 
            'Consultorio / Lugar', 
            'Notas', 
            'Estado', 
            'Creado el',
            'ID Evento Google Calendar'
        ];
        sheet.appendRow(headers);
        sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#e5ebd9");
    }
}

// OBTENER TURNOS (Petición GET)
function doGet(e) {
    setupSheet();
    const action = (e && e.parameter) ? e.parameter.action : 'getAppointments';
    
    if (action === 'getAppointments') {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        const appointments = [];
        
        // Iterar filas omitiendo las cabeceras (fila 1)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            appointments.push({
                id: row[0],
                serviceId: row[1],
                date: row[2] ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "yyyy-MM-dd") : '',
                time: row[3] ? String(row[3]) : '',
                duration: Number(row[4]),
                patientName: row[5],
                patientPhone: row[6],
                patientEmail: row[7],
                office: row[8],
                notes: row[9],
                status: row[10],
                createdAt: row[11],
                calendarEventId: row[12]
            });
        }
        
        return ContentService.createTextOutput(JSON.stringify(appointments))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Acción no reconocida" }))
        .setMimeType(ContentService.MimeType.JSON);
}

// GUARDAR O ACTUALIZAR TURNO (Petición POST)
function doPost(e) {
    setupSheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    let data;
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return ContentService.createTextOutput(JSON.stringify({ error: "No post data received" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        data = JSON.parse(e.postData.contents);
    } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({ error: "JSON inválido" }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let rowIdx = -1;
    let calendarEventId = '';
    
    // Buscar si el turno ya existe en la hoja (por ID en columna A)
    for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.id) {
            rowIdx = i + 1; // +1 porque las filas de Sheets son 1-indexed
            calendarEventId = values[i][12]; // Recuperar ID del evento de Calendar
            break;
        }
    }
    
    // Sincronización con Google Calendar
    try {
        calendarEventId = syncWithGoogleCalendar(data, calendarEventId);
    } catch(calErr) {
        Logger.log("Error al sincronizar con Calendar: " + calErr.message);
    }
    
    const rowValues = [
        data.id,
        data.serviceId,
        data.date,
        data.time,
        data.duration,
        data.patientName,
        data.patientPhone,
        data.patientEmail,
        data.office,
        data.notes,
        data.status,
        data.createdAt || new Date().toISOString(),
        calendarEventId
    ];
    
    if (rowIdx !== -1) {
        // Actualizar fila existente
        sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        // Añadir nueva fila
        sheet.appendRow(rowValues);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, calendarEventId: calendarEventId }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Función auxiliar para crear o actualizar un evento en Google Calendar
function syncWithGoogleCalendar(apt, existingEventId) {
    // Si el turno está cancelado, eliminar el evento si existía
    if (apt.status === 'cancelado') {
        if (existingEventId) {
            const event = CalendarApp.getDefaultCalendar().getEventById(existingEventId);
            if (event) {
                event.deleteEvent();
            }
        }
        return '';
    }
    
    // Crear o actualizar solo si el turno está "confirmado" o "pendiente"
    if (apt.status === 'confirmado' || apt.status === 'pendiente') {
        const title = `Turno: ${apt.patientName} (${apt.office})`;
        
        // Parsear fecha y hora
        const [h, m] = apt.time.split(':').map(Number);
        const [year, month, day] = apt.date.split('-').map(Number);
        
        // Google Script requiere que los meses sean 0-indexed en New Date
        const startDate = new Date(year, month - 1, day, h, m, 0);
        const endDate = new Date(startDate.getTime() + apt.duration * 60000);
        
        const description = `
Detalles del Turno:
- Paciente: ${apt.patientName}
- Teléfono: ${apt.patientPhone}
- Email: ${apt.patientEmail}
- Consultorio/Modalidad: ${apt.office}
- Notas: ${apt.notes || 'Ninguna'}
- Estado: ${apt.status.toUpperCase()}
- ID del Turno: ${apt.id}
        `.trim();
        
        const calendar = CalendarApp.getDefaultCalendar();
        let event;
        
        if (existingEventId) {
            event = calendar.getEventById(existingEventId);
        }
        
        if (event) {
            // Actualizar evento existente
            event.setTitle(title);
            event.setTime(startDate, endDate);
            event.setDescription(description);
            event.setLocation(apt.office);
            return existingEventId;
        } else {
            // Crear evento nuevo
            const newEvent = calendar.createEvent(title, startDate, endDate, {
                description: description,
                location: apt.office
            });
            return newEvent.getId();
        }
    }
    
    return existingEventId || '';
}
