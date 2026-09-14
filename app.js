/**
 * psico-turnos - Lógica Principal Especializada para Psicología
 * Routing SPA, Flujo de Reserva de Pacientes, Calendario con Franjas,
 * Recordatorios 1-Click por WhatsApp, Fichas Clínicas con Notas de Evolución,
 * Gestión Completa de Consultorios y Sedes, Subida de Fotos en Base64
 * y Sincronización con Google Sheets / Calendar.
 */

// === UTILIDADES GLOBALES & FORMATO DE TIEMPO ===
const timeUtils = {
    timeToMins: (tStr) => {
        const [h, m] = tStr.split(':').map(Number);
        return h * 60 + m;
    },
    minsToTime: (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    formatDateStr: (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        return dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    formatShortDate: (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
    },
    getMonthName: (year, month) => {
        const dateObj = new Date(year, month, 1);
        return dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
};

// Utilidades de la App (Toast, Copiar Link, etc.)
const appUtils = {
    showToast: (msg) => {
        const toast = document.getElementById('toast-notification');
        const text = document.getElementById('toast-text');
        if (!toast || !text) return;
        text.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    },

    copyPatientLink: () => {
        const isFileProtocol = window.location.protocol === 'file:';
        let url = '';
        
        if (isFileProtocol) {
            url = window.location.href.split('?')[0] + '?paciente=1';
            prompt("💡 Estás usando la app en modo local (archivo directo). Para que tus pacientes puedan agendarse desde sus celulares, debes publicar estos archivos en internet (por ejemplo en Vercel, Netlify o GitHub Pages gratis).\n\nPara probar la vista de paciente en tu computadora, usa este enlace:", url);
            return;
        }

        url = window.location.origin + window.location.pathname + '?paciente=1';
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                appUtils.showToast("✓ Enlace para pacientes copiado al portapapeles");
            }).catch(() => {
                prompt("Copia este enlace para enviarlo a tus pacientes:", url);
            });
        } else {
            prompt("Copia este enlace para enviarlo a tus pacientes:", url);
        }
    }
};

// === ROUTING DE LA SPA & MODO PACIENTE LIMPIO ===
const router = {
    currentView: 'patient',
    init: () => {
        const params = new URLSearchParams(window.location.search);
        const isPatientCleanMode = params.has('paciente') || params.has('p');
        
        if (isPatientCleanMode) {
            document.body.classList.add('mode-patient-clean');
            router.navigate('patient');
        } else {
            router.navigate('patient');
        }
    },
    navigate: (viewName) => {
        router.currentView = viewName;
        
        const btnPat = document.getElementById('toggle-patient-btn');
        const btnAdm = document.getElementById('toggle-admin-btn');
        if (btnPat) btnPat.classList.toggle('active', viewName === 'patient');
        if (btnAdm) btnAdm.classList.toggle('active', viewName === 'admin');
        
        const viewPat = document.getElementById('view-patient');
        const viewAdm = document.getElementById('view-admin');
        if (viewPat) viewPat.classList.toggle('active', viewName === 'patient');
        if (viewAdm) viewAdm.classList.toggle('active', viewName === 'admin');
        
        if (viewName === 'patient') {
            bookingFlow.resetFlow();
            bookingFlow.renderSpecialistInfo();
        } else {
            adminDashboard.init();
        }
    }
};

// === SINCRONIZACIÓN CON GOOGLE SHEETS / GOOGLE CALENDAR ===
const syncService = {
    isLoading: false,
    
    // Carga turnos en tiempo real desde Google Sheets si está configurada la URL
    loadFromServer: async () => {
        const spec = window.db.getSpecialist();
        if (!spec.syncUrl) return;
        
        syncService.isLoading = true;
        try {
            const response = await fetch(spec.syncUrl + '?action=getAppointments');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    window.db.saveAppointments(data);
                    if (router.currentView === 'admin') {
                        adminDashboard.renderActiveTab();
                    }
                    console.log("✓ Turnos sincronizados exitosamente desde Google Sheets.");
                }
            }
        } catch (error) {
            console.warn("Nota: Sincronización remota en espera o URL no accesible:", error);
        } finally {
            syncService.isLoading = false;
        }
    },
    
    // Envía turno nuevo o actualizado a Google Sheets & Calendar
    saveToServer: async (apt) => {
        const spec = window.db.getSpecialist();
        if (!spec.syncUrl) return;
        
        try {
            await fetch(spec.syncUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apt)
            });
            console.log("✓ Turno sincronizado con Google Sheets & Google Calendar.");
        } catch (error) {
            console.error("Error al sincronizar con Google:", error);
        }
    }
};

// ==========================================================================
// FLUJO DE RESERVA - PACIENTE
// ==========================================================================
const bookingFlow = {
    state: {
        serviceId: null,
        date: null,
        time: null,
        office: null,
        selectedReasons: []
    },

    init: () => {
        bookingFlow.renderSpecialistInfo();
        bookingFlow.renderServicesList();
    },

    renderSpecialistInfo: () => {
        const spec = window.db.getSpecialist();
        const offices = window.db.getOffices();
        
        // Cabecera
        const brandNameEl = document.getElementById('header-brand-name');
        const brandSpecEl = document.getElementById('header-brand-specialty');
        if (brandNameEl) brandNameEl.textContent = spec.name;
        if (brandSpecEl) brandSpecEl.textContent = spec.specialty;
        
        // Tarjeta de la Psicóloga (Izquierda)
        document.getElementById('patient-spec-name').textContent = spec.name;
        document.getElementById('patient-spec-specialty').textContent = spec.specialty;
        document.getElementById('patient-spec-bio').textContent = spec.bio;
        document.getElementById('patient-spec-avatar').src = spec.avatar || 'https://images.unsplash.com/photo-1594824813576-92c4b82d49b2?auto=format&fit=crop&q=80&w=300';
        
        // Mostrar sedes activas
        const officesSummary = offices.map(o => o.name).join(' • ');
        document.getElementById('patient-spec-location').textContent = officesSummary || spec.location;
        document.getElementById('patient-spec-email').textContent = spec.email;
        document.getElementById('patient-spec-phone').textContent = spec.phone;
        
        const policyEl = document.getElementById('booking-policy-text');
        if (policyEl && spec.cancellationPolicy) {
            policyEl.textContent = spec.cancellationPolicy;
        }
    },

    renderServicesList: () => {
        const services = window.db.getServices();
        const container = document.getElementById('booking-services-list');
        container.innerHTML = '';

        if (services.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding:24px 0;">No hay servicios configurados actualmente.</p>`;
            return;
        }

        services.forEach(srv => {
            const card = document.createElement('div');
            card.className = `service-item-card ${bookingFlow.state.serviceId === srv.id ? 'selected' : ''}`;
            card.onclick = () => bookingFlow.selectService(srv.id);
            
            const modalityBadge = srv.modality ? `<span class="srv-chip">📍 ${srv.modality}</span>` : '';

            card.innerHTML = `
                <div class="service-item-left">
                    <div class="srv-title">${srv.name}</div>
                    <div class="srv-meta-row">
                        <span class="srv-chip">⏱️ ${srv.duration} min</span>
                        ${modalityBadge}
                    </div>
                    <p class="srv-desc">${srv.description}</p>
                </div>
                <div class="srv-price-col">
                    <div class="srv-price">$${srv.price.toLocaleString('es-AR')}</div>
                    <div class="srv-price-sub">por sesión</div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    selectService: (serviceId) => {
        bookingFlow.state.serviceId = serviceId;
        bookingFlow.renderServicesList();
        const nextBtn = document.getElementById('btn-goto-step2');
        if (nextBtn) nextBtn.removeAttribute('disabled');
    },

    goToStep: (stepNum) => {
        document.getElementById('booking-step-1').classList.add('hidden');
        document.getElementById('booking-step-2').classList.add('hidden');
        document.getElementById('booking-step-3').classList.add('hidden');
        document.getElementById('booking-success').classList.add('hidden');

        document.getElementById(`booking-step-${stepNum}`).classList.remove('hidden');

        // Actualizar píldoras indicadoras
        ['1', '2', '3'].forEach(num => {
            const pill = document.getElementById(`pill-step-${num}`);
            if (pill) {
                const n = parseInt(num);
                pill.classList.toggle('active', n === stepNum);
                pill.classList.toggle('done', n < stepNum);
            }
        });

        const titles = {
            1: "Seleccionar Servicio",
            2: "Seleccionar Fecha y Hora",
            3: "Completar tus Datos y Motivo"
        };
        document.getElementById('booking-step-title').textContent = titles[stepNum];

        if (stepNum === 2) {
            calendarUI.init();
            bookingFlow.state.time = null;
            document.getElementById('btn-goto-step3').setAttribute('disabled', 'true');
            syncService.loadFromServer().then(() => {
                calendarUI.render();
            });
        }

        if (stepNum === 3) {
            const selectOffice = document.getElementById('p-office');
            selectOffice.innerHTML = '';
            const offices = window.db.getOffices();
            
            offices.forEach(off => {
                const opt = document.createElement('option');
                opt.value = off.name;
                const typeIcon = off.type === 'online' ? '💻' : '🏢';
                opt.textContent = `${typeIcon} ${off.name} — ${off.address}`;
                
                // Si el slot seleccionado coincide con la sede
                if (bookingFlow.state.office && bookingFlow.state.office.toLowerCase().includes(off.name.toLowerCase().substring(0, 8))) {
                    opt.selected = true;
                }
                selectOffice.appendChild(opt);
            });
        }
    },

    // Selección de Motivos de Consulta (Chips)
    toggleReasonChip: (btnEl, reasonText) => {
        const idx = bookingFlow.state.selectedReasons.indexOf(reasonText);
        if (idx === -1) {
            bookingFlow.state.selectedReasons.push(reasonText);
            btnEl.classList.add('selected');
        } else {
            bookingFlow.state.selectedReasons.splice(idx, 1);
            btnEl.classList.remove('selected');
        }
        document.getElementById('p-reason-selected').value = bookingFlow.state.selectedReasons.join(', ');
    },

    // --- Algoritmo de cálculo de Slots Disponibles ---
    getAvailableSlotsForDate: (dateStr, serviceId) => {
        const srv = window.db.getServices().find(s => s.id === serviceId);
        if (!srv) return [];
        
        const duration = srv.duration;
        const availability = window.db.getAvailability();
        const appointments = window.db.getAppointments();

        // 1. Validar feriados o fechas bloqueadas
        if (availability.blockedDates && availability.blockedDates.includes(dateStr)) {
            return [];
        }

        // 2. Día de la semana (0: Dom, 1: Lun, etc.)
        const parts = dateStr.split('-');
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayOfWeek = dateObj.getDay();

        // 3. Validar si es día laborable
        if (!availability.workDays.includes(dayOfWeek)) {
            return [];
        }

        // 4. Franjas horarias configuradas para ese día
        const dayRanges = availability.hours[dayOfWeek];
        if (!dayRanges || dayRanges.length === 0) {
            return [];
        }

        // 5. Citas activas existentes
        const activeAppointments = appointments.filter(apt => apt.date === dateStr && apt.status !== 'cancelado');
        const availableSlots = [];
        const intervalStep = 30; // Minutos entre slots

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMins = now.getHours() * 60 + now.getMinutes();

        dayRanges.forEach(range => {
            const rangeStart = timeUtils.timeToMins(range.start);
            const rangeEnd = timeUtils.timeToMins(range.end);

            for (let slotStart = rangeStart; slotStart + duration <= rangeEnd; slotStart += intervalStep) {
                const slotEnd = slotStart + duration;
                
                // Evitar horarios pasados en el día de hoy
                if (dateStr === todayStr && slotStart <= currentMins + 15) {
                    continue;
                }

                // Detección de solapamiento
                let hasCollision = false;
                for (const apt of activeAppointments) {
                    const aptStart = timeUtils.timeToMins(apt.time);
                    const aptEnd = aptStart + apt.duration;

                    if (slotStart < aptEnd && slotEnd > aptStart) {
                        hasCollision = true;
                        break;
                    }
                }

                if (!hasCollision) {
                    availableSlots.push({ 
                        time: timeUtils.minsToTime(slotStart), 
                        office: range.office || "Consultorio" 
                    });
                }
            }
        });

        return availableSlots;
    },

    selectSlot: (timeStr, officeStr) => {
        bookingFlow.state.time = timeStr;
        bookingFlow.state.office = officeStr;
        
        document.querySelectorAll('.slot-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.getAttribute('data-time') === timeStr);
        });

        document.getElementById('btn-goto-step3').removeAttribute('disabled');
    },

    submitBooking: (event) => {
        event.preventDefault();

        const name = document.getElementById('p-name').value.trim();
        const phone = document.getElementById('p-phone').value.trim();
        const email = document.getElementById('p-email').value.trim();
        const office = document.getElementById('p-office').value;
        const notes = document.getElementById('p-notes').value.trim();
        const reason = document.getElementById('p-reason-selected').value || 'Consulta General';

        const srv = window.db.getServices().find(s => s.id === bookingFlow.state.serviceId);
        const spec = window.db.getSpecialist();
        const offices = window.db.getOffices();
        const matchedOffice = offices.find(o => o.name === office) || {};

        // Crear turno
        const newApt = {
            id: 'apt-' + Date.now(),
            serviceId: bookingFlow.state.serviceId,
            date: bookingFlow.state.date,
            time: bookingFlow.state.time,
            duration: srv.duration,
            patientName: name,
            patientPhone: phone,
            patientEmail: email,
            office: office,
            officeAddress: matchedOffice.address || office,
            reason: reason,
            notes: notes,
            status: 'pendiente',
            createdAt: new Date().toISOString()
        };

        // Guardar localmente
        const appointments = window.db.getAppointments();
        appointments.push(newApt);
        window.db.saveAppointments(appointments);

        // Sincronizar en la nube con Google Calendar y Sheets
        syncService.saveToServer(newApt);

        // Generar Comprobante
        const formattedDate = timeUtils.formatDateStr(newApt.date);
        const receiptHtml = `
            <div class="receipt-row">
                <span class="receipt-label">Servicio</span>
                <span class="receipt-val">${srv.name}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Profesional</span>
                <span class="receipt-val">${spec.name}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Fecha</span>
                <span class="receipt-val" style="text-transform: capitalize;">${formattedDate}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Horario</span>
                <span class="receipt-val">${newApt.time} hs (${newApt.duration} min)</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Sede / Lugar</span>
                <span class="receipt-val">${newApt.office}</span>
            </div>
            ${matchedOffice.address ? `
            <div class="receipt-row">
                <span class="receipt-label">Dirección</span>
                <span class="receipt-val">${matchedOffice.address}</span>
            </div>` : ''}
            <div class="receipt-row">
                <span class="receipt-label">Motivo de Consulta</span>
                <span class="receipt-val">${reason}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Honorario</span>
                <span class="receipt-val" style="color: var(--c-primary); font-size:18px;">$${srv.price.toLocaleString('es-AR')}</span>
            </div>
        `;

        document.getElementById('booking-receipt-container').innerHTML = receiptHtml;

        // Enlace de WhatsApp pre-redactado para avisar a la psicóloga
        const cleanSpecPhone = spec.phone.replace(/[^0-9]/g, '');
        const waMessage = `Hola ${spec.name}, agendé un turno para ${srv.name} el día ${formattedDate} a las ${newApt.time} hs en ${newApt.office}. Mi nombre es ${name}. ¡Muchas gracias!`;
        const waLink = `https://wa.me/${cleanSpecPhone}?text=${encodeURIComponent(waMessage)}`;
        
        const waBtn = document.getElementById('whatsapp-confirmation-link');
        if (cleanSpecPhone) {
            waBtn.href = waLink;
            waBtn.classList.remove('hidden');
        } else {
            waBtn.classList.add('hidden');
        }

        // Enlace de Google Calendar para el paciente
        const [h, m] = newApt.time.split(':').map(Number);
        const startISO = newApt.date.replace(/-/g, '') + 'T' + newApt.time.replace(/:/g, '') + '00';
        const endH = Math.floor((h * 60 + m + srv.duration) / 60);
        const endM = (h * 60 + m + srv.duration) % 60;
        const endTimeStr = String(endH).padStart(2, '0') + String(endM).padStart(2, '0') + '00';
        const endISO = newApt.date.replace(/-/g, '') + 'T' + endTimeStr;

        const calTitle = `Sesión: ${srv.name} - ${spec.name}`;
        const calDetails = `Turno de sesión terapéutica agendado con ${spec.name}.\nSede: ${newApt.office}\nDirección: ${matchedOffice.address || newApt.office}\nMotivo: ${reason}`;
        const calLoc = matchedOffice.address || newApt.office;
        const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calTitle)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(calDetails)}&location=${encodeURIComponent(calLoc)}`;

        document.getElementById('google-calendar-link').href = calUrl;

        // Mostrar pantalla de éxito
        document.getElementById('booking-step-title').textContent = "Turno Registrado";
        document.getElementById('booking-step-3').classList.add('hidden');
        document.getElementById('booking-success').classList.remove('hidden');

        appUtils.showToast("✓ Turno agendado correctamente");
    },

    resetFlow: () => {
        bookingFlow.state.serviceId = null;
        bookingFlow.state.date = null;
        bookingFlow.state.time = null;
        bookingFlow.state.selectedReasons = [];

        document.getElementById('booking-form').reset();
        document.querySelectorAll('.reason-chip').forEach(c => c.classList.remove('selected'));
        document.getElementById('p-reason-selected').value = '';
        
        const b2 = document.getElementById('btn-goto-step2');
        const b3 = document.getElementById('btn-goto-step3');
        if (b2) b2.setAttribute('disabled', 'true');
        if (b3) b3.setAttribute('disabled', 'true');
        
        bookingFlow.goToStep(1);
    }
};

// ==========================================================================
// COMPONENTE CALENDARIO INTERACTIVO
// ==========================================================================
const calendarUI = {
    currentYear: null,
    currentMonth: null,

    init: () => {
        const today = new Date();
        calendarUI.currentYear = today.getFullYear();
        calendarUI.currentMonth = today.getMonth();
        calendarUI.render();
    },

    prevMonth: () => {
        calendarUI.currentMonth--;
        if (calendarUI.currentMonth < 0) {
            calendarUI.currentMonth = 11;
            calendarUI.currentYear--;
        }
        calendarUI.render();
    },

    nextMonth: () => {
        calendarUI.currentMonth++;
        if (calendarUI.currentMonth > 11) {
            calendarUI.currentMonth = 0;
            calendarUI.currentYear++;
        }
        calendarUI.render();
    },

    render: () => {
        const container = document.getElementById('calendar-days-container');
        container.innerHTML = '';

        document.getElementById('calendar-month-title').textContent = timeUtils.getMonthName(calendarUI.currentYear, calendarUI.currentMonth);

        const firstDayIndex = new Date(calendarUI.currentYear, calendarUI.currentMonth, 1).getDay();
        const totalDays = new Date(calendarUI.currentYear, calendarUI.currentMonth + 1, 0).getDate();
        const availability = window.db.getAvailability();

        const today = new Date();
        const todayDateStr = today.toISOString().split('T')[0];

        // Rellenar días en blanco antes del día 1
        for (let i = 0; i < firstDayIndex; i++) {
            const blank = document.createElement('div');
            container.appendChild(blank);
        }

        // Renderizar los días del mes
        for (let day = 1; day <= totalDays; day++) {
            const btn = document.createElement('button');
            btn.className = 'cal-day';
            btn.textContent = day;

            const mStr = String(calendarUI.currentMonth + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const dateStr = `${calendarUI.currentYear}-${mStr}-${dStr}`;

            const checkDate = new Date(calendarUI.currentYear, calendarUI.currentMonth, day);
            
            if (dateStr === todayDateStr) {
                btn.classList.add('today');
            }

            const compareToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isPast = checkDate < compareToday;
            const dayOfWeek = checkDate.getDay();
            const isWorkingDay = availability.workDays.includes(dayOfWeek);
            const isBlocked = availability.blockedDates && availability.blockedDates.includes(dateStr);

            if (isPast || !isWorkingDay || isBlocked) {
                btn.disabled = true;
            } else {
                btn.onclick = () => calendarUI.selectDay(dateStr, btn);
            }

            if (bookingFlow.state.date === dateStr) {
                btn.classList.add('active');
            }

            container.appendChild(btn);
        }
    },

    selectDay: (dateStr, element) => {
        bookingFlow.state.date = dateStr;
        bookingFlow.state.time = null;
        document.getElementById('btn-goto-step3').setAttribute('disabled', 'true');

        document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('active'));
        element.classList.add('active');

        document.getElementById('slots-selected-date-lbl').textContent = timeUtils.formatDateStr(dateStr);
        calendarUI.renderSlotsForDate(dateStr);
    },

    renderSlotsForDate: (dateStr) => {
        const slotsContainer = document.getElementById('slots-container');
        slotsContainer.innerHTML = '';

        const availableSlots = bookingFlow.getAvailableSlotsForDate(dateStr, bookingFlow.state.serviceId);
        document.getElementById('slots-count-lbl').textContent = `${availableSlots.length} horarios libres`;

        if (availableSlots.length === 0) {
            slotsContainer.innerHTML = `<div class="no-slots-msg">No hay turnos disponibles para este día. Por favor elige otra fecha.</div>`;
            return;
        }

        // Agrupar en franja Mañana (antes de las 13:00) y Tarde (13:00 en adelante)
        const morningSlots = availableSlots.filter(s => timeUtils.timeToMins(s.time) < 780);
        const afternoonSlots = availableSlots.filter(s => timeUtils.timeToMins(s.time) >= 780);

        let html = '';

        if (morningSlots.length > 0) {
            html += `<div class="slots-group-header">☀️ Turnos de Mañana</div><div class="slots-grid">`;
            morningSlots.forEach(slot => {
                html += `
                    <button type="button" class="slot-btn" data-time="${slot.time}" onclick="bookingFlow.selectSlot('${slot.time}', '${slot.office}')">
                        <span class="slot-time">${slot.time} hs</span>
                        <span class="slot-office">${slot.office}</span>
                    </button>
                `;
            });
            html += `</div>`;
        }

        if (afternoonSlots.length > 0) {
            html += `<div class="slots-group-header" style="margin-top:16px;">🌙 Turnos de Tarde</div><div class="slots-grid">`;
            afternoonSlots.forEach(slot => {
                html += `
                    <button type="button" class="slot-btn" data-time="${slot.time}" onclick="bookingFlow.selectSlot('${slot.time}', '${slot.office}')">
                        <span class="slot-time">${slot.time} hs</span>
                        <span class="slot-office">${slot.office}</span>
                    </button>
                `;
            });
            html += `</div>`;
        }

        slotsContainer.innerHTML = html;
    }
};

// ==========================================================================
// DASHBOARD DEL PROFESIONAL (PANEL PSICÓLOGA)
// ==========================================================================
const adminDashboard = {
    currentTab: 'appointments',
    appointmentsFilter: 'todos',

    init: () => {
        const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
        if (isLoggedIn) {
            document.getElementById('admin-login-card').classList.add('hidden');
            document.getElementById('admin-dashboard-container').classList.remove('hidden');
            adminDashboard.renderActiveTab();
            adminDashboard.renderMetrics();
        } else {
            document.getElementById('admin-login-card').classList.remove('hidden');
            document.getElementById('admin-dashboard-container').classList.add('hidden');
        }
    },

    handleLogin: (event) => {
        event.preventDefault();
        const psw = document.getElementById('login-password').value;
        const err = document.getElementById('login-error-msg');
        
        if (psw === 'admin') {
            sessionStorage.setItem('admin_logged_in', 'true');
            err.classList.add('hidden');
            document.getElementById('admin-login-form').reset();
            adminDashboard.init();
            appUtils.showToast("✓ Sesión iniciada correctamente");
        } else {
            err.classList.remove('hidden');
        }
    },

    handleLogout: () => {
        sessionStorage.removeItem('admin_logged_in');
        adminDashboard.init();
        appUtils.showToast("Sesión cerrada");
    },

    switchTab: (tabId) => {
        adminDashboard.currentTab = tabId;
        
        document.querySelectorAll('.db-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        document.querySelectorAll('.db-section').forEach(sect => {
            sect.classList.toggle('active', sect.id === `db-section-${tabId}`);
        });

        adminDashboard.renderActiveTab();
    },

    renderMetrics: () => {
        const appointments = window.db.getAppointments();
        const spec = window.db.getSpecialist();
        const todayStr = new Date().toISOString().split('T')[0];

        // Saludo
        const greetingTitle = document.getElementById('db-greeting-title');
        const greetingDate = document.getElementById('db-greeting-date');
        if (greetingTitle) greetingTitle.textContent = `¡Hola ${spec.name}!`;
        if (greetingDate) greetingDate.textContent = `Hoy es ${timeUtils.formatDateStr(todayStr)}.`;

        // Métricas
        const todayCount = appointments.filter(a => a.date === todayStr && a.status !== 'cancelado').length;
        const upcomingCount = appointments.filter(a => a.date >= todayStr && a.status !== 'cancelado').length;
        const completedCount = appointments.filter(a => a.status === 'completado').length;

        // Pacientes únicos
        const uniquePatients = new Set(appointments.map(a => a.patientEmail.toLowerCase())).size;

        const mToday = document.getElementById('metric-today-count');
        const mUpcoming = document.getElementById('metric-upcoming-count');
        const mPatients = document.getElementById('metric-patients-count');
        const mCompleted = document.getElementById('metric-completed-count');

        if (mToday) mToday.textContent = todayCount;
        if (mUpcoming) mUpcoming.textContent = upcomingCount;
        if (mPatients) mPatients.textContent = uniquePatients;
        if (mCompleted) mCompleted.textContent = completedCount;
    },

    renderActiveTab: () => {
        adminDashboard.renderMetrics();
        switch (adminDashboard.currentTab) {
            case 'appointments':
                adminDashboard.renderAppointmentsTab();
                break;
            case 'patients':
                adminDashboard.renderPatientsTab();
                break;
            case 'offices':
                adminDashboard.renderOfficesTab();
                break;
            case 'availability':
                adminDashboard.renderAvailabilityTab();
                break;
            case 'services':
                adminDashboard.renderServicesTab();
                break;
            case 'settings':
                adminDashboard.renderSettingsTab();
                break;
        }
    },

    // --- TAB 1: Agenda de Citas ---
    renderAppointmentsTab: () => {
        const container = document.getElementById('db-appointments-list');
        container.innerHTML = '';
        
        let list = window.db.getAppointments();
        const services = window.db.getServices();

        list.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

        const todayStr = new Date().toISOString().split('T')[0];
        if (adminDashboard.appointmentsFilter === 'hoy') {
            list = list.filter(apt => apt.date === todayStr);
        } else if (adminDashboard.appointmentsFilter === 'proximos') {
            list = list.filter(apt => apt.date >= todayStr && apt.status !== 'cancelado');
        } else if (adminDashboard.appointmentsFilter === 'pendientes') {
            list = list.filter(apt => apt.status === 'pendiente');
        } else if (adminDashboard.appointmentsFilter === 'completados') {
            list = list.filter(apt => apt.status === 'completado');
        } else if (adminDashboard.appointmentsFilter === 'cancelados') {
            list = list.filter(apt => apt.status === 'cancelado');
        }

        if (list.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding: 36px 0;">No se encontraron turnos con el filtro actual.</p>`;
            return;
        }

        list.forEach(apt => {
            const srv = services.find(s => s.id === apt.serviceId) || { name: 'Servicio Terapéutico' };
            const parts = apt.date.split('-');
            const dateObj = new Date(parts[0], parts[1]-1, parts[2]);
            const dayNum = dateObj.getDate();
            const monthStr = dateObj.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

            const card = document.createElement('div');
            card.className = 'appointment-item animate-fade-in';
            
            // Acciones de estado
            let actionButtons = '';
            if (apt.status === 'pendiente') {
                actionButtons = `
                    <button class="btn btn-primary btn-sm" onclick="adminDashboard.updateAppointmentStatus('${apt.id}', 'confirmado')">Confirmar</button>
                    <button class="btn btn-outline btn-sm btn-danger" onclick="adminDashboard.updateAppointmentStatus('${apt.id}', 'cancelado')">Rechazar</button>
                `;
            } else if (apt.status === 'confirmado') {
                actionButtons = `
                    <button class="btn btn-secondary btn-sm" onclick="adminDashboard.updateAppointmentStatus('${apt.id}', 'completado')">Marcar Realizado</button>
                    <button class="btn btn-outline btn-sm btn-danger" onclick="adminDashboard.updateAppointmentStatus('${apt.id}', 'cancelado')">Cancelar</button>
                `;
            }

            const reasonBadge = apt.reason ? `<span class="apt-reason-pill">🌱 ${apt.reason}</span>` : '';

            card.innerHTML = `
                <div class="apt-left">
                    <div class="apt-date-badge">
                        <span class="day-num">${dayNum}</span>
                        <span class="month-name">${monthStr}</span>
                    </div>
                    <div class="apt-details">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span class="apt-patient-name">${apt.patientName}</span>
                            ${reasonBadge}
                        </div>
                        <div class="apt-meta">
                            <span>🕒 ${apt.time} hs (${apt.duration} min)</span>
                            <span>💼 ${srv.name}</span>
                            <span>📍 ${apt.office || 'Consultorio'}</span>
                            <span>📞 ${apt.patientPhone}</span>
                            <span>✉️ ${apt.patientEmail}</span>
                        </div>
                        ${apt.notes ? `<div class="apt-notes"><strong>Notas:</strong> ${apt.notes}</div>` : ''}
                    </div>
                </div>
                <div class="apt-actions">
                    <span class="badge badge-${apt.status}">${apt.status}</span>
                    <button class="btn btn-whatsapp btn-sm" onclick="adminDashboard.sendWhatsAppReminder('${apt.id}')" title="Enviar recordatorio formal por WhatsApp">
                        📲 Recordar por WhatsApp
                    </button>
                    ${actionButtons}
                </div>
            `;
            container.appendChild(card);
        });
    },

    // Recordatorio de Turno por WhatsApp en 1 Clic
    sendWhatsAppReminder: (aptId) => {
        const apt = window.db.getAppointments().find(a => a.id === aptId);
        const spec = window.db.getSpecialist();
        const services = window.db.getServices();
        if (!apt) return;

        const srv = services.find(s => s.id === apt.serviceId) || { name: 'sesión terapéutica' };
        const cleanPhone = apt.patientPhone.replace(/[^0-9]/g, '');
        const formattedDate = timeUtils.formatDateStr(apt.date);

        const msg = `Hola ${apt.patientName}! Te recuerdo nuestro turno agendado para ${srv.name} el día ${formattedDate} a las ${apt.time} hs (${apt.office || 'Consultorio'}). Por favor, confírmame tu asistencia cuando puedas. ¡Saludos cordiales! - ${spec.name}`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        appUtils.showToast("WhatsApp abierto para enviar recordatorio");
    },

    filterAppointments: (filterName) => {
        adminDashboard.appointmentsFilter = filterName;
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === filterName);
        });
        adminDashboard.renderAppointmentsTab();
    },

    updateAppointmentStatus: (id, newStatus) => {
        const appointments = window.db.getAppointments();
        const idx = appointments.findIndex(apt => apt.id === id);
        if (idx !== -1) {
            appointments[idx].status = newStatus;
            window.db.saveAppointments(appointments);
            adminDashboard.renderAppointmentsTab();
            syncService.saveToServer(appointments[idx]);
            appUtils.showToast(`✓ Estado actualizado a: ${newStatus}`);
        }
    },

    // --- TAB 2: Fichero de Pacientes & Notas Clínicas Privadas ---
    renderPatientsTab: () => {
        const container = document.getElementById('db-patients-container');
        container.innerHTML = '';

        const appointments = window.db.getAppointments();
        const clinicalNotes = window.db.getClinicalNotes();
        const services = window.db.getServices();
        const searchInput = document.getElementById('patient-search-input');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const patientsMap = {};
        appointments.forEach(apt => {
            const key = apt.patientEmail.toLowerCase();
            if (!patientsMap[key]) {
                patientsMap[key] = {
                    name: apt.patientName,
                    phone: apt.patientPhone,
                    email: apt.patientEmail,
                    appointments: []
                };
            }
            patientsMap[key].appointments.push(apt);
        });

        let list = Object.values(patientsMap);

        if (query) {
            list = list.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.phone.includes(query) ||
                p.email.toLowerCase().includes(query)
            );
        }

        if (list.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding: 36px 0;">No se encontraron pacientes registrados.</p>`;
            return;
        }

        list.sort((a, b) => a.name.localeCompare(b.name));

        list.forEach(patient => {
            const patientApts = [...patient.appointments].sort((a, b) => b.date.localeCompare(a.date));
            const patientNotes = clinicalNotes.filter(n => n.patientEmail.toLowerCase() === patient.email.toLowerCase());

            let historyHtml = '';
            patientApts.slice(0, 4).forEach(apt => {
                const srv = services.find(s => s.id === apt.serviceId) || { name: 'Consulta' };
                historyHtml += `
                    <div class="history-item">
                        <strong>${timeUtils.formatShortDate(apt.date)} (${apt.time} hs)</strong> - ${srv.name}
                        <span class="badge badge-${apt.status}" style="font-size:9px; padding:1px 6px;">${apt.status}</span>
                        ${apt.reason ? `<span class="apt-reason-pill" style="font-size:9px; margin-left:4px;">${apt.reason}</span>` : ''}
                    </div>
                `;
            });

            // Notas clínicas
            let notesHtml = '';
            if (patientNotes.length === 0) {
                notesHtml = `<p class="text-muted" style="font-size:12px; margin-top:6px;">Sin notas registradas aún.</p>`;
            } else {
                patientNotes.forEach(note => {
                    notesHtml += `
                        <div class="clinical-note-entry">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong>${note.title}</strong>
                                <span style="font-size:11px; color:var(--c-text-muted);">${timeUtils.formatShortDate(note.date)}</span>
                            </div>
                            <p style="margin-top:4px; font-size:12px; line-height:1.4;">${note.content}</p>
                            <button type="button" class="btn btn-outline btn-danger btn-sm" style="font-size:10px; padding:2px 6px; margin-top:6px;" onclick="adminDashboard.deleteClinicalNote('${note.id}')">Eliminar nota</button>
                        </div>
                    `;
                });
            }

            const card = document.createElement('div');
            card.className = 'patient-item-card animate-fade-in';
            card.innerHTML = `
                <div class="patient-bio-info">
                    <h4>${patient.name}</h4>
                    <div class="patient-contact-details">
                        <div>💬 WhatsApp: <strong>${patient.phone}</strong></div>
                        <div>✉️ Correo: ${patient.email}</div>
                        <div>📊 Total de Citas: <strong>${patient.appointments.length}</strong></div>
                    </div>
                    
                    <button class="btn btn-secondary btn-sm mt-md" onclick="adminDashboard.openClinicalNoteModal('${patient.email}', '${patient.name}')">
                        ＋ Agregar Nota de Evolución
                    </button>
                </div>

                <div class="patient-history-col">
                    <div class="history-title">
                        <span>Historial Reciente (${patient.appointments.length})</span>
                    </div>
                    <div>${historyHtml}</div>

                    <div class="clinical-notes-container">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:12px; font-weight:700; color:var(--c-primary);">🔒 Notas Clínicas Privadas (${patientNotes.length})</span>
                            <span class="clinical-note-badge">Confidencial</span>
                        </div>
                        ${notesHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    openClinicalNoteModal: (patientEmail, patientName) => {
        document.getElementById('clinical-note-form').reset();
        document.getElementById('cn-patient-email').value = patientEmail;
        document.getElementById('cn-patient-display').textContent = `${patientName} (${patientEmail})`;
        document.getElementById('cn-date').value = new Date().toISOString().split('T')[0];

        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-clinical-note');
        overlay.classList.add('active');
        modal.classList.add('active');
    },

    closeClinicalNoteModal: () => {
        document.getElementById('modal-overlay').classList.remove('active');
        document.getElementById('modal-clinical-note').classList.remove('active');
    },

    saveClinicalNote: (event) => {
        event.preventDefault();
        const patientEmail = document.getElementById('cn-patient-email').value;
        const date = document.getElementById('cn-date').value;
        const sessionNumber = document.getElementById('cn-session-num').value;
        const title = document.getElementById('cn-title').value.trim();
        const content = document.getElementById('cn-content').value.trim();

        if (!patientEmail || !date || !title || !content) return;

        window.db.addClinicalNote({
            patientEmail,
            date,
            sessionNumber: sessionNumber ? parseInt(sessionNumber) : 1,
            title,
            content,
            confidential: true
        });

        adminDashboard.closeClinicalNoteModal();
        adminDashboard.renderPatientsTab();
        appUtils.showToast("✓ Nota clínica guardada en la ficha del paciente");
    },

    deleteClinicalNote: (noteId) => {
        if (confirm("¿Estás segura de eliminar esta nota de evolución?")) {
            window.db.deleteClinicalNote(noteId);
            adminDashboard.renderPatientsTab();
            appUtils.showToast("Nota eliminada");
        }
    },

    // --- TAB: CONSULTORIOS Y SEDES ---
    renderOfficesTab: () => {
        const container = document.getElementById('db-offices-container');
        if (!container) return;
        container.innerHTML = '';

        const offices = window.db.getOffices();

        if (offices.length === 0) {
            container.innerHTML = `
                <div class="google-sync-guide-card text-center" style="padding: 40px 20px;">
                    <h4 class="font-heading" style="color:var(--c-primary); margin-bottom:8px;">No tienes consultorios o sedes configuradas</h4>
                    <p class="text-muted" style="font-size:13px; margin-bottom:16px;">Agrega tu primer consultorio presencial o la opción de atención online para que tus pacientes puedan elegir.</p>
                    <button class="btn btn-primary btn-sm" onclick="adminDashboard.openOfficeModal(null)">＋ Añadir Consultorio / Sede</button>
                </div>
            `;
            return;
        }

        offices.forEach(office => {
            const card = document.createElement('div');
            card.className = 'office-item-card animate-fade-in';
            
            const isPresencial = office.type === 'presencial';
            const badgeClass = isPresencial ? 'office-badge-presencial' : 'office-badge-online';
            const badgeText = isPresencial ? '🏢 Consultorio Presencial' : '💻 Atención Online';

            let mapsHtml = '';
            if (office.mapsUrl && office.mapsUrl.trim()) {
                mapsHtml = `
                    <div style="margin-top:8px;">
                        <a href="${office.mapsUrl}" target="_blank" class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 10px;">
                            📍 Ver en Google Maps ↗
                        </a>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="office-card-main">
                    <div class="office-header-row">
                        <span class="office-title">${office.name}</span>
                        <span class="office-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="office-address-line">
                        <span style="font-size:16px;">📍</span>
                        <span><strong>Dirección:</strong> ${office.address}</span>
                    </div>
                    ${office.instructions ? `
                        <div class="office-instructions-box">
                            <strong>Indicaciones para el paciente:</strong> ${office.instructions}
                        </div>
                    ` : ''}
                    ${mapsHtml}
                </div>
                <div class="office-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="adminDashboard.openOfficeModal('${office.id}')">Editar</button>
                    <button type="button" class="btn btn-outline btn-danger btn-sm" onclick="adminDashboard.deleteOffice('${office.id}')">Eliminar</button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    openOfficeModal: (officeId) => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-office');
        const form = document.getElementById('office-form');
        form.reset();

        if (officeId) {
            document.getElementById('office-modal-title').textContent = "Editar Consultorio / Sede";
            const office = window.db.getOffices().find(o => o.id === officeId);
            if (office) {
                document.getElementById('office-edit-id').value = office.id;
                document.getElementById('off-form-name').value = office.name;
                document.getElementById('off-form-type').value = office.type || 'presencial';
                document.getElementById('off-form-address').value = office.address || '';
                document.getElementById('off-form-instructions').value = office.instructions || '';
                document.getElementById('off-form-maps').value = office.mapsUrl || '';
            }
        } else {
            document.getElementById('office-modal-title').textContent = "Añadir Consultorio / Sede";
            document.getElementById('office-edit-id').value = '';
        }

        overlay.classList.add('active');
        modal.classList.add('active');
    },

    closeOfficeModal: () => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-office');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
    },

    handleOfficeTypeChange: (type) => {
        const addrInput = document.getElementById('off-form-address');
        const instInput = document.getElementById('off-form-instructions');
        if (type === 'online') {
            if (!addrInput.value || addrInput.value.includes('Av.')) {
                addrInput.value = 'Atención remota privada por videollamada';
            }
            if (!instInput.value) {
                instInput.value = 'El enlace privado de Google Meet o Zoom se envía 15 minutos antes del turno por WhatsApp y correo.';
            }
        } else {
            if (addrInput.value === 'Atención remota privada por videollamada') {
                addrInput.value = '';
                addrInput.placeholder = 'Ej: Av. Santa Fe 3420, Piso 3 Depto B, Palermo, CABA';
            }
        }
    },

    saveOffice: (event) => {
        event.preventDefault();
        const id = document.getElementById('office-edit-id').value;
        const name = document.getElementById('off-form-name').value.trim();
        const type = document.getElementById('off-form-type').value;
        const address = document.getElementById('off-form-address').value.trim();
        const instructions = document.getElementById('off-form-instructions').value.trim();
        const mapsUrl = document.getElementById('off-form-maps').value.trim();

        if (!name || !address) {
            alert("Por favor completa el nombre de la sede y la dirección.");
            return;
        }

        if (id) {
            window.db.updateOffice({ id, name, type, address, instructions, mapsUrl });
        } else {
            window.db.addOffice({ name, type, address, instructions, mapsUrl });
        }

        adminDashboard.closeOfficeModal();
        adminDashboard.renderOfficesTab();
        bookingFlow.renderSpecialistInfo();
        appUtils.showToast("✓ Consultorio guardado correctamente");
    },

    deleteOffice: (officeId) => {
        const offices = window.db.getOffices();
        if (offices.length <= 1) {
            alert("Debes mantener al menos un consultorio o sede configurada para tus pacientes.");
            return;
        }
        if (confirm("¿Estás segura de eliminar este consultorio?")) {
            window.db.deleteOffice(officeId);
            adminDashboard.renderOfficesTab();
            bookingFlow.renderSpecialistInfo();
            appUtils.showToast("Consultorio eliminado");
        }
    },

    // --- TAB 3: Horarios & Disponibilidad ---
    renderAvailabilityTab: () => {
        const container = document.getElementById('db-availability-list');
        container.innerHTML = '';

        const availability = window.db.getAvailability();
        const offices = window.db.getOffices().map(o => o.name);

        const dayNames = {
            1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo"
        };

        for (let d = 1; d <= 6; d++) {
            const isChecked = availability.workDays.includes(d);
            const ranges = availability.hours[d] || [{ start: "09:00", end: "13:00", office: offices[0] || "Consultorio" }];

            const row = document.createElement('div');
            row.className = 'avail-day-row';
            row.setAttribute('data-day', d);
            row.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; background:#fafdfc; border:1px solid var(--c-border); border-radius:var(--radius-lg); padding:16px; flex-wrap:wrap; gap:12px;";

            let rangesHtml = '';
            ranges.forEach((range, idx) => {
                let optionsHtml = '';
                offices.forEach(off => {
                    optionsHtml += `<option value="${off}" ${range.office === off ? 'selected' : ''}>${off}</option>`;
                });

                rangesHtml += `
                    <div class="avail-hour-range" data-index="${idx}" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                        <input type="time" class="input-ctrl start-time" style="width:110px; padding:6px;" value="${range.start}">
                        <span>a</span>
                        <input type="time" class="input-ctrl end-time" style="width:110px; padding:6px;" value="${range.end}">
                        <select class="input-ctrl range-office" style="width:220px; padding:6px;">
                            ${optionsHtml}
                        </select>
                        ${ranges.length > 1 ? `<button type="button" class="btn btn-outline btn-danger btn-sm" onclick="adminDashboard.removeAvailabilityRange(${d}, ${idx})">×</button>` : ''}
                    </div>
                `;
            });

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; min-width:140px;">
                    <input type="checkbox" class="day-active-chk" id="chk-day-${d}" style="width:18px; height:18px; cursor:pointer;" ${isChecked ? 'checked' : ''}>
                    <label for="chk-day-${d}" style="font-weight:700; cursor:pointer; font-size:15px;">${dayNames[d]}</label>
                </div>
                <div style="flex:1;">
                    ${rangesHtml}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="adminDashboard.addAvailabilityRange(${d})">＋ Agregar Franja Horaria</button>
                </div>
            `;
            container.appendChild(row);
        }

        adminDashboard.renderBlockedDates();
    },

    addAvailabilityRange: (dayNum) => {
        const availability = window.db.getAvailability();
        const offices = window.db.getOffices().map(o => o.name);
        const defaultOffice = offices[0] || "Consultorio";

        if (!availability.hours[dayNum]) {
            availability.hours[dayNum] = [];
        }
        availability.hours[dayNum].push({ start: "14:00", end: "19:00", office: defaultOffice });
        window.db.saveAvailability(availability);
        adminDashboard.renderAvailabilityTab();
    },

    removeAvailabilityRange: (dayNum, rangeIdx) => {
        const availability = window.db.getAvailability();
        if (availability.hours[dayNum]) {
            availability.hours[dayNum].splice(rangeIdx, 1);
            window.db.saveAvailability(availability);
            adminDashboard.renderAvailabilityTab();
        }
    },

    renderBlockedDates: () => {
        const container = document.getElementById('db-blocked-dates-container');
        container.innerHTML = '';

        const availability = window.db.getAvailability();
        const dates = availability.blockedDates || [];
        dates.sort();

        if (dates.length === 0) {
            container.innerHTML = `<span class="text-muted" style="font-size:13px;">No hay fechas bloqueadas.</span>`;
            return;
        }

        dates.forEach(dateStr => {
            const tag = document.createElement('span');
            tag.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:#fbeeed; color:#c0392b; padding:4px 10px; border-radius:9999px; font-size:12px; font-weight:600;";
            tag.innerHTML = `
                ${timeUtils.formatDateStr(dateStr)}
                <button type="button" style="background:none; border:none; cursor:pointer; font-weight:bold; color:inherit;" onclick="adminDashboard.removeBlockedDate('${dateStr}')">×</button>
            `;
            container.appendChild(tag);
        });
    },

    addBlockedDate: () => {
        const input = document.getElementById('block-date-input');
        const dateStr = input.value;
        if (!dateStr) return;

        const availability = window.db.getAvailability();
        if (!availability.blockedDates) availability.blockedDates = [];
        
        if (!availability.blockedDates.includes(dateStr)) {
            availability.blockedDates.push(dateStr);
            window.db.saveAvailability(availability);
            adminDashboard.renderBlockedDates();
            appUtils.showToast(`Día bloqueado: ${dateStr}`);
        }
        input.value = '';
    },

    removeBlockedDate: (dateStr) => {
        const availability = window.db.getAvailability();
        availability.blockedDates = (availability.blockedDates || []).filter(d => d !== dateStr);
        window.db.saveAvailability(availability);
        adminDashboard.renderBlockedDates();
    },

    saveAvailabilitySettings: () => {
        const availability = window.db.getAvailability();
        const newWorkDays = [];
        const newHours = {};

        document.querySelectorAll('.avail-day-row').forEach(row => {
            const dayNum = parseInt(row.getAttribute('data-day'));
            const isChecked = row.querySelector('.day-active-chk').checked;

            if (isChecked) {
                newWorkDays.push(dayNum);
            }

            const ranges = [];
            row.querySelectorAll('.avail-hour-range').forEach(rangeEl => {
                const start = rangeEl.querySelector('.start-time').value;
                const end = rangeEl.querySelector('.end-time').value;
                const office = rangeEl.querySelector('.range-office').value;
                if (start && end && office) {
                    ranges.push({ start, end, office });
                }
            });

            if (ranges.length > 0) {
                newHours[dayNum] = ranges;
            }
        });

        availability.workDays = newWorkDays;
        availability.hours = newHours;

        window.db.saveAvailability(availability);
        appUtils.showToast("✓ Horarios y disponibilidad guardados correctamente");
    },

    // --- TAB 4: Servicios Psicológicos ---
    renderServicesTab: () => {
        const container = document.getElementById('db-services-container');
        container.innerHTML = '';

        const services = window.db.getServices();

        if (services.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding:30px 0;">No tienes servicios configurados. Haz clic en "＋ Nuevo Servicio" para crear uno.</p>`;
            return;
        }

        services.forEach(srv => {
            const card = document.createElement('div');
            card.className = 'service-item-card animate-fade-in';
            card.style.cursor = 'default';
            card.innerHTML = `
                <div class="service-item-left">
                    <div class="srv-title">${srv.name}</div>
                    <div class="srv-meta-row">
                        <span class="srv-chip">⏱️ ${srv.duration} min</span>
                        ${srv.modality ? `<span class="srv-chip">📍 ${srv.modality}</span>` : ''}
                    </div>
                    <p class="srv-desc">${srv.description}</p>
                </div>
                <div class="srv-price-col" style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <div class="srv-price">$${srv.price.toLocaleString('es-AR')}</div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="adminDashboard.openServiceModal('${srv.id}')">Editar</button>
                        <button type="button" class="btn btn-outline btn-danger btn-sm" onclick="adminDashboard.deleteService('${srv.id}')">Eliminar</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    openServiceModal: (serviceId) => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-service');
        const form = document.getElementById('service-form');
        form.reset();

        if (serviceId) {
            document.getElementById('service-modal-title').textContent = "Editar Servicio Terapéutico";
            const srv = window.db.getServices().find(s => s.id === serviceId);
            if (srv) {
                document.getElementById('service-edit-id').value = srv.id;
                document.getElementById('srv-form-name').value = srv.name;
                document.getElementById('srv-form-modality').value = srv.modality || '';
                document.getElementById('srv-form-duration').value = srv.duration;
                document.getElementById('srv-form-price').value = srv.price;
                document.getElementById('srv-form-desc').value = srv.description;
            }
        } else {
            document.getElementById('service-modal-title').textContent = "Añadir Servicio Terapéutico";
            document.getElementById('service-edit-id').value = '';
        }

        overlay.classList.add('active');
        modal.classList.add('active');
    },

    closeServiceModal: () => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-service');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
    },

    saveService: (event) => {
        event.preventDefault();
        const id = document.getElementById('service-edit-id').value;
        const name = document.getElementById('srv-form-name').value.trim();
        const modality = document.getElementById('srv-form-modality').value.trim();
        const duration = parseInt(document.getElementById('srv-form-duration').value);
        const price = parseInt(document.getElementById('srv-form-price').value);
        const description = document.getElementById('srv-form-desc').value.trim();

        const services = window.db.getServices();

        if (id) {
            const idx = services.findIndex(s => s.id === id);
            if (idx !== -1) {
                services[idx] = { id, name, modality, duration, price, description };
            }
        } else {
            services.push({
                id: 'srv-' + Date.now(),
                name,
                modality,
                duration,
                price,
                description
            });
        }

        window.db.saveServices(services);
        adminDashboard.closeServiceModal();
        adminDashboard.renderServicesTab();
        bookingFlow.renderServicesList();
        appUtils.showToast("✓ Servicio guardado exitosamente");
    },

    deleteService: (id) => {
        if (confirm("¿Estás segura de eliminar este servicio?")) {
            let services = window.db.getServices().filter(s => s.id !== id);
            window.db.saveServices(services);
            adminDashboard.renderServicesTab();
            bookingFlow.renderServicesList();
            appUtils.showToast("Servicio eliminado");
        }
    },

    // --- TAB 5: Perfil & Configuración ---
    renderSettingsTab: () => {
        const spec = window.db.getSpecialist();
        document.getElementById('conf-name').value = spec.name;
        document.getElementById('conf-specialty').value = spec.specialty;
        document.getElementById('conf-bio').value = spec.bio;
        document.getElementById('conf-location').value = spec.location;
        document.getElementById('conf-email').value = spec.email;
        document.getElementById('conf-phone').value = spec.phone;
        document.getElementById('conf-avatar').value = spec.avatar || '';
        document.getElementById('conf-avatar-preview').src = spec.avatar || 'https://images.unsplash.com/photo-1594824813576-92c4b82d49b2?auto=format&fit=crop&q=80&w=300';
        document.getElementById('conf-cancellation').value = spec.cancellationPolicy || '';
        document.getElementById('conf-sync-url').value = spec.syncUrl || '';
    },

    // Manejador de Subida de Foto Local (Base64)
    handlePhotoUpload: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Por favor, selecciona un archivo de imagen válido (JPG, PNG, WebP).");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const base64Data = canvas.toDataURL('image/jpeg', 0.85);

                document.getElementById('conf-avatar-preview').src = base64Data;
                document.getElementById('conf-avatar').value = '';

                const spec = window.db.getSpecialist();
                spec.avatar = base64Data;
                window.db.saveSpecialist(spec);
                bookingFlow.renderSpecialistInfo();
                appUtils.showToast("✓ Foto de perfil actualizada con éxito");
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    previewAvatarUrl: (url) => {
        if (url && url.trim()) {
            document.getElementById('conf-avatar-preview').src = url.trim();
        }
    },

    saveProfileSettings: () => {
        const currentSpec = window.db.getSpecialist();
        const previewSrc = document.getElementById('conf-avatar-preview').src;
        const inputUrl = document.getElementById('conf-avatar').value.trim();

        const spec = {
            ...currentSpec,
            name: document.getElementById('conf-name').value.trim(),
            specialty: document.getElementById('conf-specialty').value.trim(),
            bio: document.getElementById('conf-bio').value.trim(),
            location: document.getElementById('conf-location').value.trim(),
            email: document.getElementById('conf-email').value.trim(),
            phone: document.getElementById('conf-phone').value.trim(),
            avatar: inputUrl || previewSrc || currentSpec.avatar,
            cancellationPolicy: document.getElementById('conf-cancellation').value.trim(),
            syncUrl: document.getElementById('conf-sync-url').value.trim()
        };

        if (!spec.name || !spec.specialty || !spec.location || !spec.email || !spec.phone) {
            alert("Por favor completa los campos requeridos marcados con *.");
            return;
        }

        window.db.saveSpecialist(spec);
        bookingFlow.renderSpecialistInfo();
        appUtils.showToast("✓ Perfil y configuración guardados");
    },

    handleImportBackup: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const success = window.db.importBackup(e.target.result);
            if (success) {
                appUtils.showToast("✓ Copia de seguridad restaurada");
                setTimeout(() => location.reload(), 1000);
            } else {
                alert("El archivo no tiene un formato de backup válido.");
            }
        };
        reader.readAsText(file);
    },

    // --- CITA MANUAL ---
    openManualBookingModal: () => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-manual-booking');
        const selectSrv = document.getElementById('m-service');
        const selectOffice = document.getElementById('m-office');
        
        document.getElementById('manual-booking-form').reset();
        
        selectSrv.innerHTML = `<option value="">Selecciona servicio...</option>`;
        window.db.getServices().forEach(s => {
            selectSrv.innerHTML += `<option value="${s.id}">${s.name} (${s.duration} min)</option>`;
        });

        selectOffice.innerHTML = '';
        window.db.getOffices().forEach(off => {
            const typeIcon = off.type === 'online' ? '💻' : '🏢';
            selectOffice.innerHTML += `<option value="${off.name}">${typeIcon} ${off.name} (${off.address})</option>`;
        });

        document.getElementById('m-time').innerHTML = `<option value="">Selecciona fecha primero...</option>`;

        overlay.classList.add('active');
        modal.classList.add('active');
    },

    closeManualBookingModal: () => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-manual-booking');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
    },

    updateManualBookingTimeSlots: () => {
        const serviceId = document.getElementById('m-service').value;
        const dateStr = document.getElementById('m-date').value;
        const timeSelect = document.getElementById('m-time');

        if (!serviceId) {
            alert("Selecciona un servicio antes de elegir la fecha.");
            document.getElementById('m-date').value = '';
            return;
        }

        if (!dateStr) return;

        timeSelect.innerHTML = `<option value="">Calculando...</option>`;
        const slots = bookingFlow.getAvailableSlotsForDate(dateStr, serviceId);
        
        timeSelect.innerHTML = '';
        if (slots.length === 0) {
            timeSelect.innerHTML = `<option value="">Sin turnos libres para esta fecha</option>`;
        } else {
            slots.forEach(slot => {
                timeSelect.innerHTML += `<option value="${slot.time}" data-office="${slot.office}">${slot.time} hs (${slot.office})</option>`;
            });
        }
    },

    saveManualBooking: (event) => {
        event.preventDefault();

        const serviceId = document.getElementById('m-service').value;
        const timeSelect = document.getElementById('m-time');
        const selectedOpt = timeSelect.options[timeSelect.selectedIndex];
        const office = selectedOpt ? selectedOpt.getAttribute('data-office') : document.getElementById('m-office').value;
        const date = document.getElementById('m-date').value;
        const time = timeSelect.value;
        const patientName = document.getElementById('m-pat-name').value.trim();
        const patientPhone = document.getElementById('m-pat-phone').value.trim();
        const patientEmail = document.getElementById('m-pat-email').value.trim();
        const reason = document.getElementById('m-reason').value.trim() || 'Consulta Terapéutica';
        const notes = document.getElementById('m-notes').value.trim();

        if (!serviceId || !office || !date || !time || !patientName || !patientPhone || !patientEmail) {
            alert("Completa todos los campos obligatorios.");
            return;
        }

        const srv = window.db.getServices().find(s => s.id === serviceId);

        const newApt = {
            id: 'apt-' + Date.now(),
            serviceId,
            date,
            time,
            duration: srv.duration,
            patientName,
            patientPhone,
            patientEmail,
            office,
            reason,
            notes,
            status: 'confirmado',
            createdAt: new Date().toISOString()
        };

        const appointments = window.db.getAppointments();
        appointments.push(newApt);
        window.db.saveAppointments(appointments);

        syncService.saveToServer(newApt);

        adminDashboard.closeManualBookingModal();
        adminDashboard.renderAppointmentsTab();
        appUtils.showToast("✓ Turno registrado en agenda");
    },

    closeAllModals: () => {
        adminDashboard.closeServiceModal();
        adminDashboard.closeOfficeModal();
        adminDashboard.closeManualBookingModal();
        adminDashboard.closeClinicalNoteModal();
    }
};

// Listener para cerrar modales al presionar la tecla Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        adminDashboard.closeAllModals();
    }
});

// === INICIALIZACIÓN GLOBAL ===
document.addEventListener('DOMContentLoaded', () => {
    router.init();
    bookingFlow.init();
    syncService.loadFromServer();
});
