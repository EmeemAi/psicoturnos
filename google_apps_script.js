// ==========================================================================
// SERVIDOR DE BASE DE DATOS & SINCRONIZACIÓN GOOGLE CALENDAR
// Lic. Lucía V. Nuñez - PsicoTurnos
// ==========================================================================

const SHEET_TURNOS = 'Turnos';
const SHEET_CONFIG = 'Configuracion';

// Configuración inicial de las pestañas en Google Sheets
function setupSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Pestaña de Turnos
    let sheetTurnos = ss.getSheetByName(SHEET_TURNOS);
    if (!sheetTurnos) {
        sheetTurnos = ss.insertSheet(SHEET_TURNOS);
        const headersTurnos = [
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
        sheetTurnos.appendRow(headersTurnos);
        sheetTurnos.getRange("A1:M1").setFontWeight("bold").setBackground("#d2e3dc");
    }
    
    // 2. Pestaña de Configuración del Consultorio
    let sheetConfig = ss.getSheetByName(SHEET_CONFIG);
    if (!sheetConfig) {
        sheetConfig = ss.insertSheet(SHEET_CONFIG);
        const headersConfig = ['Clave', 'Datos JSON', 'Última Actualización'];
        sheetConfig.appendRow(headersConfig);
        sheetConfig.getRange("A1:C1").setFontWeight("bold").setBackground("#e5ebd9");
    }
}

// Obtener todos los turnos registrados
function getAppointmentsFromSheet(ss) {
    const sheet = ss.getSheetByName(SHEET_TURNOS);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    const appointments = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;
        appointments.push({
            id: String(row[0]),
            serviceId: String(row[1] || ''),
            date: row[2] ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "yyyy-MM-dd") : '',
            time: row[3] ? String(row[3]) : '',
            duration: Number(row[4]) || 50,
            patientName: String(row[5] || ''),
            patientPhone: String(row[6] || ''),
            patientEmail: String(row[7] || ''),
            office: String(row[8] || ''),
            notes: String(row[9] || ''),
            status: String(row[10] || 'pendiente'),
            createdAt: String(row[11] || ''),
            calendarEventId: String(row[12] || '')
        });
    }
    return appointments;
}

// Obtener configuración guardada del consultorio (perfil, servicios, sedes)
function getConfigFromSheet(ss) {
    const sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const config = {};
    
    for (let i = 1; i < data.length; i++) {
        const key = data[i][0];
        const valJson = data[i][1];
        if (key && valJson) {
            try {
                config[key] = JSON.parse(valJson);
            } catch(e) {
                config[key] = valJson;
            }
        }
    }
    
    return Object.keys(config).length > 0 ? config : null;
}

// Guardar configuración del consultorio en la pestaña Configuracion
function saveConfigToSheet(ss, configData) {
    let sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) {
        setupSheets();
        sheet = ss.getSheetByName(SHEET_CONFIG);
    }
    
    const timestamp = new Date().toISOString();
    const keys = ['specialist', 'services', 'offices', 'availability'];
    
    keys.forEach(function(key) {
        if (configData[key] !== undefined) {
            const jsonStr = JSON.stringify(configData[key]);
            const data = sheet.getDataRange().getValues();
            let rowIdx = -1;
            
            for (let i = 1; i < data.length; i++) {
                if (data[i][0] === key) {
                    rowIdx = i + 1;
                    break;
                }
            }
            
            if (rowIdx !== -1) {
                sheet.getRange(rowIdx, 2).setValue(jsonStr);
                sheet.getRange(rowIdx, 3).setValue(timestamp);
            } else {
                sheet.appendRow([key, jsonStr, timestamp]);
            }
        }
    });
}

// ==========================================================================
// PETICIONES GET (Consulta de datos)
// ==========================================================================
function doGet(e) {
    setupSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter) ? e.parameter.action : 'getAllData';
    
    // Devolver turnos y configuración completa en una sola llamada
    if (action === 'getAllData' || !action) {
        const payload = {
            appointments: getAppointmentsFromSheet(ss),
            config: getConfigFromSheet(ss)
        };
        return ContentService.createTextOutput(JSON.stringify(payload))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Solo turnos
    if (action === 'getAppointments') {
        const appointments = getAppointmentsFromSheet(ss);
        return ContentService.createTextOutput(JSON.stringify(appointments))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Solo configuración
    if (action === 'getConfig') {
        const config = getConfigFromSheet(ss);
        return ContentService.createTextOutput(JSON.stringify(config || {}))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Acción no reconocida" }))
        .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================================
// PETICIONES POST (Guardado de turnos y configuración)
// ==========================================================================
function doPost(e) {
    setupSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let data;
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return ContentService.createTextOutput(JSON.stringify({ error: "Sin datos recibidos" }))
                .setMimeType(ContentService.MimeType.JSON);
        }
        data = JSON.parse(e.postData.contents);
    } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({ error: "JSON inválido" }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    // CASO 1: Guardar Configuración (Perfil, Servicios, Consultorios, Disponibilidad)
    if (data.type === 'saveConfig' || data.config) {
        const configToSave = data.config || data;
        saveConfigToSheet(ss, configToSave);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Configuración guardada en Google Sheets" }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    // CASO 2: Guardar o Actualizar Turno
    const sheetTurnos = ss.getSheetByName(SHEET_TURNOS);
    const dataRange = sheetTurnos.getDataRange();
    const values = dataRange.getValues();
    let rowIdx = -1;
    let calendarEventId = '';
    
    for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.id) {
            rowIdx = i + 1;
            calendarEventId = values[i][12];
            break;
        }
    }
    
    // Sincronización automática con Google Calendar
    try {
        calendarEventId = syncWithGoogleCalendar(data, calendarEventId);
    } catch(calErr) {
        Logger.log("Error con Google Calendar: " + calErr.message);
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
        sheetTurnos.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        sheetTurnos.appendRow(rowValues);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, calendarEventId: calendarEventId }))
        .setMimeType(ContentService.MimeType.JSON);
}

// Sincronizar turno con el Google Calendar de la psicóloga
function syncWithGoogleCalendar(apt, existingEventId) {
    if (apt.status === 'cancelado') {
        if (existingEventId) {
            const event = CalendarApp.getDefaultCalendar().getEventById(existingEventId);
            if (event) event.deleteEvent();
        }
        return '';
    }
    
    if (apt.status === 'confirmado' || apt.status === 'pendiente') {
        const title = `Turno: ${apt.patientName} (${apt.office})`;
        const partsTime = (apt.time || "00:00").split(':').map(Number);
        const partsDate = (apt.date || "2026-01-01").split('-').map(Number);
        
        const startDate = new Date(partsDate[0], partsDate[1] - 1, partsDate[2], partsTime[0], partsTime[1], 0);
        const endDate = new Date(startDate.getTime() + (Number(apt.duration) || 50) * 60000);
        
        const description = [
            "Turno Terapéutico - Lic. Lucía V. Nuñez",
            "---------------------------------------",
            "Paciente: " + apt.patientName,
            "Teléfono: " + apt.patientPhone,
            "Email: " + (apt.patientEmail || '-'),
            "Sede: " + apt.office,
            "Motivo / Notas: " + (apt.notes || '-'),
            "Estado: " + String(apt.status).toUpperCase(),
            "ID Turno: " + apt.id
        ].join('\n');
        
        const calendar = CalendarApp.getDefaultCalendar();
        let event;
        
        if (existingEventId) {
            event = calendar.getEventById(existingEventId);
        }
        
        if (event) {
            event.setTitle(title);
            event.setTime(startDate, endDate);
            event.setDescription(description);
            event.setLocation(apt.office);
            return existingEventId;
        } else {
            const newEvent = calendar.createEvent(title, startDate, endDate, {
                description: description,
                location: apt.office
            });
            return newEvent.getId();
        }
    }
    
    return existingEventId || '';
}
