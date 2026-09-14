/**
 * psico-turnos - Persistencia y Datos Iniciales Especializados para Psicología Clínica
 * Provee la interfaz para interactuar con localStorage, estructura de datos terapéutica
 * y gestión de múltiples consultorios, sedes físicas y modalidad online.
 */

const DB_PREFIX = 'psico_turnos_';

// Consultorios y Sedes por defecto
const DEFAULT_OFFICES = [
    {
        id: "off-1",
        name: "Consultorio Palermo Soho",
        type: "presencial",
        address: "Av. Santa Fe 3420, Piso 3 Depto B, Palermo, CABA",
        instructions: "A 2 cuadras de Estación Bulnes (Línea D). Tocar timbre 'Consultorios 3B'. Sala de espera con té y café.",
        mapsUrl: "https://maps.google.com/?q=Av.+Santa+Fe+3420,+Palermo,+CABA"
    },
    {
        id: "off-2",
        name: "Consultorio Recoleta",
        type: "presencial",
        address: "Av. Callao 1520, Piso 2 Consultorio 5, Recoleta, CABA",
        instructions: "Edificio profesional con ascensor. Anunciarse en recepción/portería como paciente de la Lic. Lucía Menéndez.",
        mapsUrl: "https://maps.google.com/?q=Av.+Callao+1520,+Recoleta,+CABA"
    },
    {
        id: "off-3",
        name: "Sesión Online (Google Meet / Zoom)",
        type: "online",
        address: "Atención remota privada por videollamada",
        instructions: "El enlace privado de Google Meet o Zoom se envía 15 minutos antes del turno por WhatsApp y correo.",
        mapsUrl: ""
    }
];

// Perfil por defecto de la psicóloga
const DEFAULT_SPECIALIST = {
    name: "Lic. Lucía Menéndez",
    specialty: "Psicóloga Clínica (M.N. 52.840 / M.P. 89.120)",
    bio: "Especialista en Psicoterapia Individual, de Pareja y Vínculos con enfoque Cognitivo-Conductual (TCC) e Integrativo. Brindo un espacio cálido, seguro y confidencial para acompañarte en tu bienestar emocional, manejo de ansiedad, procesos de cambio y autoconocimiento.",
    location: "Consultorio Palermo Soho / Recoleta y Atención Online",
    email: "lic.luciamenendez@psicologia.com",
    phone: "+54 9 11 5432-8765",
    avatar: "https://images.unsplash.com/photo-1594824813576-92c4b82d49b2?auto=format&fit=crop&q=80&w=300",
    offices: [
        "Consultorio Palermo Soho",
        "Consultorio Recoleta",
        "Sesión Online (Google Meet / Zoom)"
    ],
    syncUrl: "",
    cancellationPolicy: "Por favor, recuerda que las cancelaciones o reprogramaciones deben realizarse con al menos 24 horas de anticipación para poder disponer del espacio."
};

// Servicios psicológicos especializados
const DEFAULT_SERVICES = [
    {
        id: "srv-1",
        name: "Primera Entrevista de Admisión / Evaluación",
        duration: 60,
        price: 22000,
        modality: "Presencial u Online",
        description: "Espacio de evaluación inicial y escucha clínica. Definimos el motivo de consulta, objetivos terapéuticos y el encuadre de trabajo."
    },
    {
        id: "srv-2",
        name: "Sesión Psicoterapéutica Individual",
        duration: 50,
        price: 18000,
        modality: "Presencial u Online",
        description: "Proceso terapéutico individual continuo. Abordaje de ansiedad, regulación emocional, autoestima, duelos y conflictos vitales."
    },
    {
        id: "srv-3",
        name: "Terapia de Pareja / Vincular",
        duration: 60,
        price: 26000,
        modality: "Presencial u Online",
        description: "Espacio para trabajar en patrones de comunicación, resolución de conflictos, acuerdos y dinámicas vinculares."
    },
    {
        id: "srv-4",
        name: "Orientación a Padres y Pautas de Crianza",
        duration: 50,
        price: 20000,
        modality: "Presencial u Online",
        description: "Acompañamiento especializado en etapas del desarrollo infanto-juvenil, establecimiento de límites respetuosos y dinámicas familiares."
    },
    {
        id: "srv-5",
        name: "Sesión Psicológica Online (Remota)",
        duration: 50,
        price: 18000,
        modality: "Online (Videollamada)",
        description: "Atención psicológica a distancia a través de Google Meet o Zoom, con la misma calidez y privacidad desde cualquier lugar."
    }
];

// Disponibilidad semanal por defecto (Lunes a Viernes)
const DEFAULT_AVAILABILITY = {
    workDays: [1, 2, 3, 4, 5],
    hours: {
        1: [
            { start: "09:00", end: "13:00", office: "Consultorio Palermo Soho" },
            { start: "14:00", end: "19:00", office: "Sesión Online (Google Meet / Zoom)" }
        ],
        2: [
            { start: "10:00", end: "14:00", office: "Consultorio Recoleta" },
            { start: "15:00", end: "20:00", office: "Consultorio Recoleta" }
        ],
        3: [
            { start: "09:00", end: "13:00", office: "Consultorio Palermo Soho" },
            { start: "14:00", end: "19:00", office: "Sesión Online (Google Meet / Zoom)" }
        ],
        4: [
            { start: "10:00", end: "14:00", office: "Consultorio Recoleta" },
            { start: "15:00", end: "20:00", office: "Sesión Online (Google Meet / Zoom)" }
        ],
        5: [
            { start: "09:00", end: "14:00", office: "Consultorio Palermo Soho" },
            { start: "15:00", end: "18:00", office: "Sesión Online (Google Meet / Zoom)" }
        ]
    },
    blockedDates: []
};

// Generar fechas relativas para citas de demostración
const getRelativeDateStr = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
};

// Turnos de ejemplo enfocados en psicología
const DEFAULT_APPOINTMENTS = [
    {
        id: "apt-1",
        serviceId: "srv-2",
        date: getRelativeDateStr(0), // Hoy
        time: "10:00",
        duration: 50,
        patientName: "Camila Fernández",
        patientPhone: "+54 9 11 4455-8899",
        patientEmail: "camila.fernandez@email.com",
        office: "Consultorio Palermo Soho",
        reason: "Ansiedad / Estrés",
        notes: "Sesión quincenal de seguimiento. Enfoque en técnicas de exposición gradual y manejo del insomnio.",
        status: "confirmado",
        createdAt: new Date().toISOString()
    },
    {
        id: "apt-2",
        serviceId: "srv-1",
        date: getRelativeDateStr(0), // Hoy
        time: "15:00",
        duration: 60,
        patientName: "Martín Goldfarb",
        patientPhone: "+54 9 11 6789-1234",
        patientEmail: "martin.gold@email.com",
        office: "Sesión Online (Google Meet / Zoom)",
        reason: "Duelo / Separación",
        notes: "Primera entrevista de admisión. Derivado por el Dr. Rossi. Duelo reciente por separación tras 8 años.",
        status: "pendiente",
        createdAt: new Date().toISOString()
    },
    {
        id: "apt-3",
        serviceId: "srv-3",
        date: getRelativeDateStr(1), // Mañana
        time: "11:00",
        duration: 60,
        patientName: "Luciana & Federico",
        patientPhone: "+54 9 11 2233-4455",
        patientEmail: "luciana.v@email.com",
        office: "Consultorio Recoleta",
        reason: "Relaciones / Vínculos",
        notes: "Terapia vincular de pareja. Dificultades en acuerdos de convivencia.",
        status: "confirmado",
        createdAt: new Date().toISOString()
    },
    {
        id: "apt-4",
        serviceId: "srv-2",
        date: getRelativeDateStr(2), // En 2 días
        time: "16:00",
        duration: 50,
        patientName: "Esteban Morales",
        patientPhone: "+54 9 11 9988-7766",
        patientEmail: "esteban.morales@email.com",
        office: "Sesión Online (Google Meet / Zoom)",
        reason: "Autoestima / Crecimiento Personal",
        notes: "Tratamiento en curso. Revisión del registro semanal de pensamientos automáticos.",
        status: "confirmado",
        createdAt: new Date().toISOString()
    },
    {
        id: "apt-5",
        serviceId: "srv-2",
        date: getRelativeDateStr(-3), // Histórico
        time: "17:00",
        duration: 50,
        patientName: "Camila Fernández",
        patientPhone: "+54 9 11 4455-8899",
        patientEmail: "camila.fernandez@email.com",
        office: "Consultorio Palermo Soho",
        reason: "Ansiedad / Estrés",
        notes: "Avances significativos en respiración diafragmática. Disminuyeron los episodios de pánico.",
        status: "completado",
        createdAt: new Date().toISOString()
    }
];

// Fichas y notas de evolución clínica confidenciales (Privadas para la psicóloga)
const DEFAULT_CLINICAL_NOTES = [
    {
        id: "note-1",
        patientEmail: "camila.fernandez@email.com",
        date: getRelativeDateStr(-3),
        sessionNumber: 4,
        title: "Sesión 4: Manejo de reestructuración cognitiva",
        content: "Paciente se presenta puntual y reflexiva. Refiere que logró aplicar la técnica de detención del pensamiento durante una situación laboral estresante el día jueves. Disminuyó la intensidad del síntoma de 8/10 a 4/10. Se acuerda mantener registro diario de autoobservación.",
        confidential: true
    },
    {
        id: "note-2",
        patientEmail: "esteban.morales@email.com",
        date: getRelativeDateStr(-7),
        sessionNumber: 2,
        title: "Sesión 2: Encuadre de creencias nucleares",
        content: "Exploración de exigencias de autoeficacia y perfeccionismo aprendidas en el ámbito familiar. Buena alianza terapéutica. Mostró apertura emocional.",
        confidential: true
    }
];

// Métodos de lectura y persistencia en LocalStorage
const db = {
    get: (key, defaultValue) => {
        try {
            const data = localStorage.getItem(DB_PREFIX + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error("Error al leer de localStorage:", e);
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error("Error al guardar en localStorage:", e);
            return false;
        }
    },
    
    // Perfil Profesional
    getSpecialist: () => {
        const spec = db.get('specialist', DEFAULT_SPECIALIST);
        let updated = false;
        
        // Garantizar sincronización de consultorios
        const offices = db.getOffices();
        spec.offices = offices.map(o => o.name);

        if (spec.syncUrl === undefined) {
            spec.syncUrl = "";
            updated = true;
        }
        if (!spec.cancellationPolicy) {
            spec.cancellationPolicy = DEFAULT_SPECIALIST.cancellationPolicy;
            updated = true;
        }
        if (updated) {
            db.saveSpecialist(spec);
        }
        return spec;
    },
    saveSpecialist: (data) => db.set('specialist', data),
    
    // Consultorios & Sedes
    getOffices: () => {
        const stored = db.get('offices', null);
        if (stored && Array.isArray(stored) && stored.length > 0) {
            return stored;
        }
        db.saveOffices(DEFAULT_OFFICES);
        return DEFAULT_OFFICES;
    },
    saveOffices: (offices) => {
        db.set('offices', offices);
        // Actualizar nombres en specialist
        const spec = db.get('specialist', DEFAULT_SPECIALIST);
        spec.offices = offices.map(o => o.name);
        db.set('specialist', spec);
    },
    addOffice: (office) => {
        const offices = db.getOffices();
        office.id = 'off-' + Date.now();
        offices.push(office);
        db.saveOffices(offices);
        return office;
    },
    updateOffice: (updatedOffice) => {
        let offices = db.getOffices();
        const idx = offices.findIndex(o => o.id === updatedOffice.id);
        if (idx !== -1) {
            offices[idx] = updatedOffice;
            db.saveOffices(offices);
            return true;
        }
        return false;
    },
    deleteOffice: (officeId) => {
        let offices = db.getOffices();
        offices = offices.filter(o => o.id !== officeId);
        db.saveOffices(offices);
        return true;
    },

    // Servicios
    getServices: () => db.get('services', DEFAULT_SERVICES),
    saveServices: (data) => db.set('services', data),
    
    // Disponibilidad
    getAvailability: () => db.get('availability', DEFAULT_AVAILABILITY),
    saveAvailability: (data) => db.set('availability', data),
    
    // Turnos
    getAppointments: () => db.get('appointments', DEFAULT_APPOINTMENTS),
    saveAppointments: (data) => db.set('appointments', data),

    // Notas Clínicas / Evolución Terapéutica Privada
    getClinicalNotes: () => db.get('clinical_notes', DEFAULT_CLINICAL_NOTES),
    saveClinicalNotes: (notes) => db.set('clinical_notes', notes),
    
    addClinicalNote: (note) => {
        const notes = db.getClinicalNotes();
        note.id = 'note-' + Date.now();
        notes.unshift(note);
        db.saveClinicalNotes(notes);
        return note;
    },

    deleteClinicalNote: (noteId) => {
        let notes = db.getClinicalNotes();
        notes = notes.filter(n => n.id !== noteId);
        db.saveClinicalNotes(notes);
    },
    
    // Exportar todos los datos a JSON (Backup para la psicóloga)
    exportBackup: () => {
        const backupData = {
            specialist: db.getSpecialist(),
            offices: db.getOffices(),
            services: db.getServices(),
            availability: db.getAvailability(),
            appointments: db.getAppointments(),
            clinicalNotes: db.getClinicalNotes(),
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_psicoturnos_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // Importar datos desde JSON
    importBackup: (jsonData) => {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (data.specialist) db.saveSpecialist(data.specialist);
            if (data.offices) db.saveOffices(data.offices);
            if (data.services) db.saveServices(data.services);
            if (data.availability) db.saveAvailability(data.availability);
            if (data.appointments) db.saveAppointments(data.appointments);
            if (data.clinicalNotes) db.saveClinicalNotes(data.clinicalNotes);
            return true;
        } catch (e) {
            console.error("Error al importar backup:", e);
            return false;
        }
    },

    // Reiniciar base de datos a valores de psicología por defecto
    resetToDefaults: () => {
        localStorage.removeItem(DB_PREFIX + 'specialist');
        localStorage.removeItem(DB_PREFIX + 'offices');
        localStorage.removeItem(DB_PREFIX + 'services');
        localStorage.removeItem(DB_PREFIX + 'availability');
        localStorage.removeItem(DB_PREFIX + 'appointments');
        localStorage.removeItem(DB_PREFIX + 'clinical_notes');
        location.reload();
    }
};

window.db = db;
