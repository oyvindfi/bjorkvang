// booking.js
// Denne filen initialiserer en enkel kalender ved hjelp av FullCalendar
// og legger til funksjonalitet for å sende inn en bookingforespørsel.

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  const form = document.getElementById('booking-form');
  const statusEl = document.getElementById('booking-status');
  const reservationListEl = document.getElementById('reservation-list');
  const reservationEmptyState = document.getElementById('reservation-empty');
  const dateInput = document.getElementById('date');
  const timeInput = document.getElementById('time');

  // Flatpickr date picker — Norwegian locale, no past dates
  let datepicker = null;
  if (dateInput && typeof flatpickr !== 'undefined') {
    datepicker = flatpickr(dateInput, {
      locale: 'no',
      dateFormat: 'Y-m-d',
      minDate: 'today',
      disableMobile: false,
      allowInput: true,
      nextArrow: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
      prevArrow: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    });
  }
  const durationInputEl = document.getElementById('duration');
  const endDateInputEl = document.getElementById('end-date');
  const endTimeInputEl = document.getElementById('end-time');
  const durationFieldEl = document.getElementById('duration-field');
  const endDateFieldEl = document.getElementById('end-date-field');
  const endTimeFieldEl = document.getElementById('end-time-field');
  const normalDatetimeFieldsEl = document.getElementById('normal-datetime-fields');
  const weddingCardEl = document.getElementById('wedding-weekend-card');
  const weddingWeekendTextEl = document.getElementById('wedding-weekend-text');
  const weddingChangeBtnEl = document.getElementById('wedding-change-btn');
  const weddingDatePickerWrapEl = document.getElementById('wedding-date-picker-wrap');
  const weddingDatePickerEl = document.getElementById('wedding-date-picker');
  const eventTypeSelect = document.getElementById('event-type');
  const calculatedPriceEl = document.getElementById('calculated-price');
  const attendeesInput = document.getElementById('attendees');

  const STATUS_VALUES = ['pending', 'confirmed', 'blocked'];

  // Pricing structure
  const PRICING = {
    'Peisestue': 1500,
    'Salen': 3000,
    'Hele lokalet': 4000,
    'Bryllupspakke': 6000,
    'Små møter': 30 // per person
  };

  const MEMBER_DISCOUNT = 500;
  const MEMBER_ELIGIBLE_SPACES = ['Hele lokalet', 'Bryllupspakke'];

  // Calculate total price based on selected spaces, attendees and member discount
  const calculatePrice = () => {
    const spacesCheckboxes = form.querySelectorAll('input[name="spaces"]:checked');
    const selectedSpaces = Array.from(spacesCheckboxes).map(cb => cb.value);
    const attendees = parseInt(attendeesInput?.value) || 10;

    let total = 0;
    selectedSpaces.forEach(space => {
      if (space === 'Små møter') {
        total += PRICING[space] * attendees;
      } else if (PRICING[space]) {
        total += PRICING[space];
      }
    });

    // Apply member discount if eligible space is selected and box is checked
    const memberCheckbox = form.querySelector('#is-member');
    const isEligible = selectedSpaces.some(s => MEMBER_ELIGIBLE_SPACES.includes(s));
    if (memberCheckbox?.checked && isEligible) {
      total = Math.max(0, total - MEMBER_DISCOUNT);
    }

    return total;
  };

  // Show/hide member discount section based on eligible space selection
  const WHOLE_PREMISES = ['Hele lokalet', 'Bryllupspakke'];
  const INDIVIDUAL_SPACES = ['Peisestue', 'Salen', 'Små møter'];

  /**
   * Enforce mutual exclusion between spaces:
   * - Whole-premises (Hele lokalet / Bryllupspakke) locks out everything else.
   * - Individual rooms lock out whole-premises options and each other
   *   (only one individual room at a time).
   */
  const enforceSpaceMutualExclusion = (changed) => {
    if (!changed.checked) return; // unchecking never triggers side-effects
    const allSpaces = Array.from(form.querySelectorAll('input[name="spaces"]'));
    const val = changed.value;

    if (WHOLE_PREMISES.includes(val)) {
      // Uncheck everything except the one just selected
      allSpaces.forEach(cb => { if (cb !== changed) cb.checked = false; });
    } else if (INDIVIDUAL_SPACES.includes(val)) {
      // Uncheck whole-premises options and sibling individual rooms
      allSpaces.forEach(cb => {
        if (cb !== changed && (WHOLE_PREMISES.includes(cb.value) || INDIVIDUAL_SPACES.includes(cb.value))) {
          cb.checked = false;
        }
      });
    }
  };

  const toggleMemberDiscount = () => {
    const section = document.getElementById('member-discount-section');
    if (!section) return;
    const spacesCheckboxes = form.querySelectorAll('input[name="spaces"]:checked');
    const selectedSpaces = Array.from(spacesCheckboxes).map(cb => cb.value);
    const eligible = selectedSpaces.some(s => MEMBER_ELIGIBLE_SPACES.includes(s));
    section.hidden = !eligible;
    if (!eligible) {
      const memberCheckbox = form.querySelector('#is-member');
      if (memberCheckbox) memberCheckbox.checked = false;
    }
  };

  // Update price display
  const updatePriceDisplay = () => {
    if (!calculatedPriceEl) return;

    const total = calculatePrice();
    if (total > 0) {
      calculatedPriceEl.textContent = `Estimert pris: ${total.toLocaleString('nb-NO')} kr`;
      calculatedPriceEl.style.fontWeight = 'bold';
    } else {
      calculatedPriceEl.textContent = 'Estimert pris: Velg lokaler';
      calculatedPriceEl.style.fontWeight = 'normal';
    }
  };

  // Watch for changes to spaces and attendees
  // Update submit button label when payment method changes
  if (form) {
    const submitBtn = document.getElementById('submit-btn');
    const paymentRadios = form.querySelectorAll('input[name="paymentMethod"]');
    const updateSubmitLabel = () => {
      if (submitBtn) {
        submitBtn.textContent = 'Send bookingforespørsel';
      }
    };
    paymentRadios.forEach(r => r.addEventListener('change', updateSubmitLabel));
  }

  if (form) {
    const spacesCheckboxes = form.querySelectorAll('input[name="spaces"]');
    spacesCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        enforceSpaceMutualExclusion(checkbox);
        toggleMemberDiscount();
        updatePriceDisplay();
      });
    });

    const memberCheckbox = form.querySelector('#is-member');
    if (memberCheckbox) {
      memberCheckbox.addEventListener('change', updatePriceDisplay);
    }

    if (attendeesInput) {
      attendeesInput.addEventListener('input', updatePriceDisplay);
    }
  }

  // Debounce utility to prevent excessive function calls
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const escapeHtml = (value) => {
    if (typeof value !== 'string') {
      return '';
    }

    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return value.replace(/[&<>"']/g, (match) => htmlEscapes[match] || match);
  };

  const formatList = (items) => (Array.isArray(items) && items.length ? items.join(', ') : 'Ikke oppgitt');

  const isValidEmail = (value) => {
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const API_BASE_URL = isLocal 
    ? 'http://localhost:7071' 
    : 'https://bjorkvang-duhsaxahgfe0btgv.westeurope-01.azurewebsites.net';
  
  const BOOKING_API_ENDPOINT = `${API_BASE_URL}/api/booking`;
  const CALENDAR_API_ENDPOINT = `${API_BASE_URL}/api/booking/calendar`;

  async function submitBooking(bookingDetails) {
      const payload = {
          date: bookingDetails.startDate.toISOString().split('T')[0],
          time: bookingDetails.startDate.toTimeString().slice(0, 5),
          requesterName: bookingDetails.name,
          requesterEmail: bookingDetails.email,
          phone: bookingDetails.phone,
          address: bookingDetails.address,
          message: bookingDetails.message,
          duration: bookingDetails.duration,
          eventType: bookingDetails.eventType,
          spaces: bookingDetails.spaces,
          services: bookingDetails.services,
          attendees: bookingDetails.attendees,
          isMember: bookingDetails.isMember || false,
          cateringContact: bookingDetails.cateringContact || false,
          paymentMethod: bookingDetails.paymentMethod || 'vipps',
          paymentStatus: 'unpaid',
          totalAmount: bookingDetails.totalAmount || null,
      };

      const response = await fetch(BOOKING_API_ENDPOINT, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errorData = await response.json();
          // For 409 double-booking conflicts, prefer the detailed message over the short error code
          const errorMessage = response.status === 409
              ? (errorData.message || 'Det valgte tidspunktet er ikke tilgjengelig. Vennligst velg et annet tidspunkt.')
              : (errorData.error || 'Kunne ikke sende bookingforespørsel');
          throw new Error(errorMessage);
      }

      return await response.json();
  }
  

  const normaliseStatus = (value, fallback = 'pending') => {
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim().toLowerCase();
    return STATUS_VALUES.includes(trimmed) ? trimmed : fallback;
  };

  const statusLabels = {
    pending: 'Venter bekreftelse',
    confirmed: 'Bekreftet',
    blocked: 'Ikke tilgjengelig'
  };

  const statusPriority = {
    pending: 1,
    confirmed: 2,
    blocked: 3
  };

  const getStatusLabel = (status) => statusLabels[status] || statusLabels.pending;

  const computeSuggestedStatus = (spaces, duration, existingStatus) => {
    if (existingStatus && STATUS_VALUES.includes(existingStatus)) {
      return existingStatus;
    }
    if (Array.isArray(spaces) && spaces.some((space) => space.toLowerCase() === 'hele lokalet')) {
      return 'confirmed';
    }
    if (Number.isFinite(duration) && duration >= 8) {
      return 'confirmed';
    }
    return 'pending';
  };

  const highlightDayCells = () => {
    if (!calendarEl) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use querySelectorAll once and cache the result
    const dayCells = calendarEl.querySelectorAll('.fc-daygrid-day');
    if (!dayCells.length) {
      return;
    }
    dayCells.forEach((cell) => {
      const dateStr = cell.getAttribute('data-date');
      cell.classList.remove('is-available', 'is-pending', 'is-booked', 'is-blocked', 'is-past');
      if (!dateStr) {
        return;
      }

      const date = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      if (date < today) {
        cell.classList.add('is-past');
        return;
      }

      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setHours(23, 59, 59, 999);

      let strongestStatus = null;
      let strongestPriority = 0;

      events.forEach((event) => {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : new Date(start.getTime() + (event.extendedProps?.duration || 1) * 60 * 60 * 1000);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return;
        }

        if (start <= dayEnd && end >= dayStart) {
          const status = normaliseStatus(event.extendedProps?.status, 'pending');
          const priority = statusPriority[status] || 0;
          if (priority > strongestPriority) {
            strongestPriority = priority;
            strongestStatus = status;
          }
        }
      });

      if (!strongestStatus) {
        cell.classList.add('is-available');
        return;
      }

      if (strongestStatus === 'pending') {
        cell.classList.add('is-pending');
      } else {
        cell.classList.add('is-blocked');
      }
    });
  };

  const showStatus = (message, type = 'success') => {
    if (!statusEl) {
      if (type === 'error') {
        alert(message);
      }
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error', 'is-info', 'is-visible');
    statusEl.classList.add('is-visible');

    if (type === 'error') {
      statusEl.classList.add('is-error');
    } else if (type === 'info') {
      statusEl.classList.add('is-info');
    } else {
      statusEl.classList.add('is-success');
    }
  };

  const normaliseEvent = (event) => {
    if (!event || !event.start) {
      return null;
    }

    const startDate = new Date(event.start);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }

    const hasEnd = Boolean(event.end);
    const endDate = hasEnd ? new Date(event.end) : new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
    const safeEnd = Number.isNaN(endDate.getTime()) ? new Date(startDate.getTime() + 4 * 60 * 60 * 1000) : endDate;

    const extended = { ...(event.extendedProps || {}) };
    const name = (extended.name || '').trim();
    const eventType = extended.eventType || 'Reservasjon';
    const message = extended.message || '';
    const email = extended.email || '';
    const phone = extended.phone || '';
    const duration = extended.duration || Math.max(1, Math.round((safeEnd - startDate) / (60 * 60 * 1000)));
    const spaces = Array.isArray(extended.spaces)
      ? extended.spaces
      : typeof extended.spaces === 'string' && extended.spaces.length > 0
        ? extended.spaces.split(',').map((value) => value.trim()).filter(Boolean)
        : [];
    const services = Array.isArray(extended.services)
      ? extended.services
      : typeof extended.services === 'string' && extended.services.length > 0
        ? extended.services.split(',').map((value) => value.trim()).filter(Boolean)
        : [];
    const attendees =
      typeof extended.attendees === 'number'
        ? extended.attendees
        : typeof extended.attendees === 'string' && extended.attendees.trim() !== ''
          ? Number.parseInt(extended.attendees, 10)
          : null;
    const status = computeSuggestedStatus(spaces, duration, normaliseStatus(extended.status, ''));
    
    // Add visual indicator for pending events in the title
    let title = eventType || 'Reservert';
    if (status === 'pending') {
        title = `${title} (Venter)`;
    }

    return {
      title: title,
      start: startDate.toISOString(),
      end: safeEnd.toISOString(),
      extendedProps: {
        ...extended,
        name,
        email,
        phone,
        message,
        duration,
        eventType,
        spaces,
        services,
        attendees: Number.isFinite(attendees) ? attendees : null,
        status,
        createdAt: extended.createdAt || new Date().toISOString()
      }
    };
  };

  const loadEvents = async () => {
    try {
      const response = await fetch(CALENDAR_API_ENDPOINT);
      if (!response.ok) {
        // Fallback to local storage if API fails (e.g. offline)
        console.warn('API request failed, falling back to local storage');
        throw new Error('API failed');
      }
      const data = await response.json();
      const serverEvents = data.bookings || [];
      
      return serverEvents.map(booking => {
          return normaliseEvent({
              start: `${booking.date}T${booking.time}`,
              extendedProps: {
                  ...booking,
                  eventType: 'Reservasjon',
                  status: booking.status === 'approved' ? 'confirmed' : booking.status
              }
          });
      }).filter(Boolean);
    } catch (error) {
      console.warn('Kunne ikke laste kalender fra server, sjekker lokallager:', error);
      try {
        const stored = localStorage.getItem('bookingEvents');
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.map(normaliseEvent).filter(Boolean) : [];
      } catch (localError) {
        console.error('Kunne ikke lese lokallager:', localError);
        return [];
      }
    }
  };

  const ensureSeedEvents = (eventList) => {
    const seedEvents = [
      {
        title: 'Basar – hele lokalet',
        start: '2024-11-02T14:00:00',
        end: '2024-11-03T17:00:00',
        extendedProps: {
          eventType: 'Basar',
          message:
            'Helgøens Vel arrangerer åpen basar denne helgen. Åpningstider: 14.00–17.00 både lørdag og søndag. Trekningen starter søndag kl. 17.00, og hele salen er reservert til felles og offentlig arrangement.',
          spaces: ['Hele lokalet'],
          services: [],
          duration: 6,
          status: 'confirmed',
          createdAt: '2024-06-01T00:00:00.000Z'
        }
      },
      {
        title: 'Basar 1. november 2025',
        start: '2025-11-01T14:00:00',
        end: '2025-11-01T17:00:00',
        extendedProps: {
          eventType: 'Basar',
          message:
            'Åpen bygdebasar med aktiviteter, kafé og loddsalg. Åpent 14.00–17.00 lørdag, og hele lokalet er reservert til fellesarrangement.',
          spaces: ['Hele lokalet'],
          services: ['Frivillige'],
          duration: 3,
          status: 'confirmed',
          createdAt: '2025-05-15T00:00:00.000Z'
        }
      },
      {
        title: 'Basar 2. november 2025',
        start: '2025-11-02T14:00:00',
        end: '2025-11-02T17:00:00',
        extendedProps: {
          eventType: 'Basar',
          message:
            'Søndagsfinale for basarhelgen med trekninger, kaffekos og aktiviteter for alle generasjoner. Åpent 14.00–17.00, og trekningen starter søndag kl. 17.00.',
          spaces: ['Hele lokalet'],
          services: ['Frivillige'],
          duration: 3,
          status: 'confirmed',
          createdAt: '2025-05-15T00:00:00.000Z'
        }
      }
    ];

    const existingKeys = new Set(
      eventList.map((event) => {
        const startIso = new Date(event.start).toISOString();
        const endIso = event.end ? new Date(event.end).toISOString() : '';
        return `${startIso}|${endIso}`;
      })
    );

    seedEvents.forEach((seedEvent) => {
      const startIso = new Date(seedEvent.start).toISOString();
      const endIso = seedEvent.end ? new Date(seedEvent.end).toISOString() : '';
      const key = `${startIso}|${endIso}`;

      if (!existingKeys.has(key)) {
        const normalised = normaliseEvent(seedEvent);
        if (normalised) {
          eventList.push(normalised);
          existingKeys.add(key);
        }
      }
    });

    eventList.sort((a, b) => new Date(a.start) - new Date(b.start));
  };

  // Create debounced version to prevent excessive calls during calendar interactions
  const debouncedHighlightDayCells = debounce(highlightDayCells, 150);

  let events = [];

  const initializeEvents = async () => {
      try {
        const loaded = await loadEvents();
        // Clear and push to maintain reference if needed, or just reassign if we handle it right
        events.length = 0;
        events.push(...loaded);
        
        ensureSeedEvents(events);
        
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
            highlightDayCells();
        }
        updateReservationList();
      } catch (error) {
          console.error('Feil ved initialisering av hendelser:', error);
      }


  };

  initializeEvents();

  const updateReservationList = () => {
    if (!reservationListEl) {
      return;
    }

    const now = new Date();
    const upcoming = events
      .map((event) => {
        const startDate = new Date(event.start);
        const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + event.extendedProps?.duration * 60 * 60 * 1000);
        return { event, startDate, endDate };
      })
      .filter(({ startDate, endDate }) => !Number.isNaN(startDate) && !Number.isNaN(endDate) && endDate >= now)
      .sort((a, b) => a.startDate - b.startDate);

    reservationListEl.innerHTML = '';

    if (reservationEmptyState) {
      reservationEmptyState.hidden = upcoming.length > 0;
    }

    if (upcoming.length === 0) {
      return;
    }

    upcoming.forEach(({ event, startDate, endDate }) => {
      const listItem = document.createElement('li');
      listItem.className = 'reservation-item';

      const header = document.createElement('div');
      header.className = 'reservation-header';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'reservation-type';
      typeBadge.textContent = event.extendedProps?.eventType || 'Reservasjon';
      header.appendChild(typeBadge);

      const timeEl = document.createElement('time');
      timeEl.className = 'reservation-time';
      timeEl.dateTime = startDate.toISOString();
      const datePart = startDate.toLocaleDateString('nb-NO', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      });
      const timePart = startDate.toLocaleTimeString('nb-NO', {
        hour: '2-digit',
        minute: '2-digit'
      });
      timeEl.textContent = `${datePart} kl. ${timePart}`;
      header.appendChild(timeEl);

      const status = normaliseStatus(event.extendedProps?.status, 'pending');
      const statusBadge = document.createElement('span');
      statusBadge.className = `reservation-status reservation-status--${status}`;
      statusBadge.textContent = getStatusLabel(status);
      header.appendChild(statusBadge);

      listItem.appendChild(header);

      const host = document.createElement('p');
      host.className = 'reservation-meta';
      host.textContent = 'Kontakt styret for detaljer om denne reservasjonen.';
      listItem.appendChild(host);

      const durationHours = event.extendedProps?.duration || Math.max(1, Math.round((endDate - startDate) / (60 * 60 * 1000)));
      const duration = document.createElement('p');
      duration.className = 'reservation-meta';
      duration.textContent = `Varighet: ${durationHours} ${durationHours === 1 ? 'time' : 'timer'}`;
      listItem.appendChild(duration);

      if (event.extendedProps?.spaces?.length) {
        const spaces = document.createElement('p');
        spaces.className = 'reservation-meta';
        spaces.textContent = `Omfang: ${event.extendedProps.spaces.join(', ')}`;
        listItem.appendChild(spaces);
      }

      if (Number.isFinite(event.extendedProps?.attendees) && event.extendedProps.attendees > 0) {
        const attendees = document.createElement('p');
        attendees.className = 'reservation-meta';
        attendees.textContent = `Antall deltakere (ca.): ${event.extendedProps.attendees}`;
        listItem.appendChild(attendees);
      }

      if (event.extendedProps?.services?.length) {
        const services = document.createElement('p');
        services.className = 'reservation-meta';
        services.textContent = `Tillegg: ${event.extendedProps.services.join(', ')}`;
        listItem.appendChild(services);
      }

      if (event.extendedProps?.message) {
        const note = document.createElement('p');
        note.className = 'reservation-notes';
        note.textContent = `Notat: ${event.extendedProps.message}`;
        listItem.appendChild(note);
      }

      reservationListEl.appendChild(listItem);
    });
  };

  let calendar;

  if (calendarEl) {
    try {
      const isMobile = window.innerWidth < 768;
      
      calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      height: 'auto',
      headerToolbar: {
        left: isMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right: isMobile ? 'dayGridMonth,listMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      views: {
        listMonth: { buttonText: 'Liste' }
      },
      locale: 'nb',
      selectable: true,
      selectMirror: true,
      dayMaxEvents: true,
      validRange: { start: new Date().toISOString().slice(0, 10) },
      events: events,
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      },
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      },
      eventClassNames: function (arg) {
        const status = normaliseStatus(arg.event.extendedProps?.status, 'pending');
        const classes = [`fc-event--${status}`];
        const eventType = (arg.event.extendedProps?.eventType || '').toLowerCase();
        if (eventType.includes('basar')) {
          classes.push('fc-event--basar');
        }
        return classes;
      },
      dateClick: function (info) {
        // Check if the clicked date is blocked (confirmed/approved)
        const clickedCell = calendarEl.querySelector(`.fc-daygrid-day[data-date="${info.dateStr}"]`);
        const isBlocked = clickedCell && clickedCell.classList.contains('is-blocked');

        if (isBlocked) {
          showStatus('Denne datoen er allerede reservert. Velg en annen ledig dato.', 'error');
          return;
        }

        const isWeddingActive = !!form?.querySelector('input[name="spaces"][value="Bryllupspakke"]:checked');
        if (isWeddingActive) {
          applyWeddingDates(new Date(info.dateStr + 'T00:00:00'));
        } else if (datepicker) {
          datepicker.setDate(info.dateStr, true);
        } else if (dateInput) {
          dateInput.value = info.dateStr;
        }

        const isPending = clickedCell && clickedCell.classList.contains('is-pending');
        if (statusEl) {
          if (isPending) {
            showStatus('Det finnes en forespørsel på denne datoen som ikke er godkjent ennå. Du kan fortsatt sende din forespørsel.', 'info');
          } else {
            showStatus('Datoen er lagt inn i skjemaet. Fullfør feltene under for å sende forespørselen.', 'info');
          }
        }
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      select: function (selectionInfo) {
        const isWeddingSelected = !!form?.querySelector('input[name="spaces"][value="Bryllupspakke"]:checked');
        if (isWeddingSelected) {
          applyWeddingDates(selectionInfo.start);
        } else {
          const selectedDate = selectionInfo.startStr.slice(0, 10);
          if (datepicker) {
            datepicker.setDate(selectedDate, true);
          } else if (dateInput) {
            dateInput.value = selectedDate;
          }
          if (timeInput && !selectionInfo.allDay) {
            timeInput.value = selectionInfo.startStr.slice(11, 16);
          }
          if (selectionInfo.end && durationInputEl) {
            const diff = (selectionInfo.end.getTime() - selectionInfo.start.getTime()) / (60 * 60 * 1000);
            if (!Number.isNaN(diff) && diff >= 1) {
              durationInputEl.value = String(Math.min(72, Math.round(diff)));
            }
          }
        }
        if (statusEl) {
          showStatus('Tidspunktet er markert. Sjekk feltene under og send inn forespørselen.', 'info');
        }
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        calendar.unselect();
      },
      eventDidMount: function (info) {
        const removeTooltip = () => {
          const tooltip = document.getElementById('fc-tooltip');
          if (tooltip && tooltip.parentNode) {
            tooltip.remove();
          }
        };

        const handleMouseMove = (event) => {
          const tooltip = document.getElementById('fc-tooltip');
          if (!tooltip) {
            return;
          }
          tooltip.style.left = event.pageX + 12 + 'px';
          tooltip.style.top = event.pageY + 12 + 'px';
        };

        const handleMouseEnter = () => {
          removeTooltip();

          const tooltip = document.createElement('div');
          tooltip.id = 'fc-tooltip';
          tooltip.style.position = 'absolute';
          tooltip.style.zIndex = '10001';
          tooltip.style.background = '#fff';
          tooltip.style.border = '1px solid #ccc';
          tooltip.style.padding = '6px 9px';
          tooltip.style.borderRadius = '8px';
          tooltip.style.boxShadow = '0 8px 18px rgba(24, 61, 44, 0.18)';
          tooltip.style.pointerEvents = 'none'; // Prevent tooltip from interfering with mouse events
          tooltip.setAttribute('role', 'tooltip');

          const start = info.event.start ? new Date(info.event.start) : null;
          const end = info.event.end ? new Date(info.event.end) : null;
          const timeRange =
            start && end
              ? `${start.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('nb-NO', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`
              : start
                ? start.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                : '';

          const spaces = Array.isArray(info.event.extendedProps?.spaces) && info.event.extendedProps.spaces.length
            ? `<br>${info.event.extendedProps.spaces.join(', ')}`
            : '';
          tooltip.innerHTML =
            `<strong>${info.event.extendedProps?.eventType || 'Reservasjon'}</strong><br>` +
            `${start ? start.toLocaleDateString('nb-NO') : ''} ${timeRange}` +
            (spaces ? `<br>${spaces.replace(/^<br>/, '')}` : '');

          document.body.appendChild(tooltip);
          info.el.addEventListener('mousemove', handleMouseMove);
        };

        const handleMouseLeave = () => {
          info.el.removeEventListener('mousemove', handleMouseMove);
          removeTooltip();
        };

        info.el.addEventListener('mouseenter', handleMouseEnter);
        info.el.addEventListener('mouseleave', handleMouseLeave);

        info.el._bookingHandleMouseEnter = handleMouseEnter;
        info.el._bookingHandleMouseLeave = handleMouseLeave;
        info.el._bookingHandleMouseMove = handleMouseMove;
      },
      eventWillUnmount: function (info) {
        const tooltip = document.getElementById('fc-tooltip');
        if (tooltip && tooltip.parentNode) {
          tooltip.remove();
        }

        if (info?.el) {
          if (info.el._bookingHandleMouseEnter) {
            info.el.removeEventListener('mouseenter', info.el._bookingHandleMouseEnter);
            delete info.el._bookingHandleMouseEnter;
          }

          if (info.el._bookingHandleMouseLeave) {
            info.el.removeEventListener('mouseleave', info.el._bookingHandleMouseLeave);
            delete info.el._bookingHandleMouseLeave;
          }

          if (info.el._bookingHandleMouseMove) {
            info.el.removeEventListener('mousemove', info.el._bookingHandleMouseMove);
            delete info.el._bookingHandleMouseMove;
          }
        }
      },
      datesSet: function () {
        debouncedHighlightDayCells();
      },
      eventsSet: function () {
        debouncedHighlightDayCells();
      }
    });
    calendar.render();
    highlightDayCells();
    } catch (error) {
      console.error('Kunne ikke initialisere kalender:', error);
      if (statusEl) {
        showStatus('Kunne ikke laste kalenderen. Pr\u00f8v \u00e5 laste siden p\u00e5 nytt.', 'error');
      }
    }
  }

  updateReservationList();
  highlightDayCells();

  // Prevent double submissions
  let isSubmitting = false;

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isSubmitting) {
        return;
      }
      isSubmitting = true;

      if (statusEl) {
        statusEl.classList.remove('is-visible', 'is-success', 'is-error', 'is-info');
        statusEl.textContent = '';
      }

      const formData = new FormData(form);
      const formValues = Object.fromEntries(formData.entries());

      const name = (formValues.name || '').trim();
      const email = (formValues.email || '').trim();
      const phone = (formValues.phone || '').trim().replace(/[\s\-]/g, '').replace(/^(?:\+?47|0047)/, '');
      const address = (formValues.address || '').trim();
      const dateValue = formValues.date || '';
      const timeValue = formValues.time || '';
      const endDateValue = formValues.endDate || '';
      const endTimeValue = formValues.endTime || '';
      const durationInput = formValues.duration || '';
      const eventType = (formValues.eventType || '').trim();
      const message = (formValues.message || '').trim();
      const attendeesValue = (formValues.attendees || '').trim();
      const selectedSpaces = Array.from(form.querySelectorAll('input[name="spaces"]:checked')).map((input) => input.value);
      const selectedServices = Array.from(form.querySelectorAll('input[name="services"]:checked')).map((input) => input.value);
      const isWedding = selectedSpaces.includes('Bryllupspakke');
      const notificationEmailRaw = (formValues.notificationEmail || '').trim();
      const paymentMethod = formValues.paymentMethod || 'vipps';

      const notificationRecipients = notificationEmailRaw
        ? notificationEmailRaw
            .split(/[;,]/)
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

      const invalidRecipient = notificationRecipients.find((value) => !isValidEmail(value));
      if (invalidRecipient) {
        showStatus(`"${invalidRecipient}" er ikke en gyldig e-postadresse.`, 'error');
        isSubmitting = false;
        return;
      }

      if (!name || !email || !phone || !dateValue || !timeValue || !eventType) {
        showStatus('Vennligst fyll ut alle obligatoriske felter.', 'error');
        isSubmitting = false;
        return;
      }

      if (!selectedSpaces.length) {
        showStatus('Velg minst ett område du ønsker å leie.', 'error');
        isSubmitting = false;
        return;
      }

      const startDate = new Date(`${dateValue}T${timeValue}`);
      if (Number.isNaN(startDate.getTime())) {
        showStatus('Ugyldig dato eller klokkeslett.', 'error');
        isSubmitting = false;
        return;
      }

      let endDate, duration;
      if (isWedding) {
        if (!endDateValue || !endTimeValue) {
          showStatus('Angi ca. sluttdato og slutttid for bryllupspakken.', 'error');
          isSubmitting = false;
          return;
        }
        endDate = new Date(`${endDateValue}T${endTimeValue}`);
        if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
          showStatus('Sluttidspunkt må være etter starttidspunkt.', 'error');
          isSubmitting = false;
          return;
        }
        duration = (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000);
      } else {
        const durationParsed = parseFloat(durationInput);
        if (!Number.isFinite(durationParsed) || durationParsed <= 0) {
          showStatus('Varighet må være minst én time.', 'error');
          isSubmitting = false;
          return;
        }
        duration = durationParsed;
        endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
      }

      const conflictingEvent = events.find((event) => {
        const existingStart = new Date(event.start);
        const existingEnd = event.end ? new Date(event.end) : existingStart;
        if (Number.isNaN(existingStart) || Number.isNaN(existingEnd)) {
          return false;
        }
        
        // Only block if the existing event is confirmed/approved
        const status = normaliseStatus(event.extendedProps?.status, 'pending');
        if (status !== 'confirmed' && status !== 'approved') {
            return false;
        }

        return startDate < existingEnd && endDate > existingStart;
      });

      if (conflictingEvent) {
        const conflictStart = new Date(conflictingEvent.start).toLocaleString('nb-NO');
        showStatus(`Tidsrommet er allerede holdt av (${conflictStart}). Velg et annet tidspunkt.`, 'error');
        isSubmitting = false;
        return;
      }

      const attendeeCount = attendeesValue !== '' && Number.isFinite(Number.parseInt(attendeesValue, 10))
        ? Number.parseInt(attendeesValue, 10)
        : null;

      const status = computeSuggestedStatus(selectedSpaces, duration, '');

      const bookingDetails = {
        name,
        email,
        phone,
        address,
        message,
        duration,
        eventType,
        spaces: selectedSpaces,
        services: selectedServices,
        attendees: attendeeCount,
        isMember: form.querySelector('#is-member')?.checked ?? false,
        cateringContact: form.querySelector('#catering-contact')?.checked ?? false,
        startDate,
        endDate
      };

      // --- Submit booking request (payment preference stored, no payment taken now) ---
      try {
        showStatus('Sender bookingforesp\u00f8rsel ...', 'info');
        const totalAmount = calculatePrice();
        bookingDetails.paymentMethod = paymentMethod;
        bookingDetails.totalAmount = totalAmount;
        const result = await submitBooking(bookingDetails);

        // --- Show confirmation receipt ---
        const confirmation = document.getElementById('booking-confirmation');
        const sectionHeading = document.querySelector('.booking-form-section .section-heading');
        if (confirmation) {
          const dateFormatted = startDate.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const timeFormatted = `kl. ${startDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} (${Math.round(duration)} t)`;
          const deposit = Math.round(totalAmount / 2);
          const paymentLabel = paymentMethod === 'vipps' ? 'Vipps' : 'Bankinnbetaling';

          const setField = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
          setField('conf-date', dateFormatted);
          setField('conf-time', timeFormatted);
          setField('conf-eventtype', eventType || 'Ikke oppgitt');
          setField('conf-spaces', formatList(selectedSpaces));
          setField('conf-name', name);
          setField('conf-email', email);
          setField('conf-price', `${totalAmount.toLocaleString('nb-NO')} kr`);
          setField('conf-deposit', `${deposit.toLocaleString('nb-NO')} kr`);
          setField('conf-payment', paymentLabel);
          setField('conf-id', result.id || '—');
          setField('conf-email-sent', email);

          // Catering row — only show if checked
          const cateringRow = document.getElementById('conf-catering-row');
          const wantsCatering = form.querySelector('#catering-contact')?.checked;
          if (cateringRow && wantsCatering) {
            setField('conf-catering', 'Næs Mat og Event tar kontakt');
            cateringRow.hidden = false;
          }

          form.hidden = true;
          if (sectionHeading) sectionHeading.hidden = true;
          confirmation.hidden = false;
          confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        form.reset();
        // Re-show duration field and hide wedding fields after reset
        if (durationFieldEl) durationFieldEl.hidden = false;
        if (endDateFieldEl) endDateFieldEl.hidden = true;
        if (endTimeFieldEl) endTimeFieldEl.hidden = true;
        if (durationInputEl) durationInputEl.required = true;
        if (endDateInputEl) endDateInputEl.required = false;
        if (endTimeInputEl) endTimeInputEl.required = false;
        if (eventTypeSelect) eventTypeSelect.selectedIndex = 0;

        const paymentNote = paymentMethod === 'vipps'
          ? 'Du vil motta en Vipps-betalingsforespørsel for depositum (50 %) etter godkjenning.'
          : `Du vil motta en betalingsforespørsel for depositum (50 % av ca. kr ${totalAmount.toLocaleString('nb-NO')}) etter godkjenning.`;

        showStatus(
          `Bookingforespørsel sendt! Styret vil vurdere forespørselen og ta kontakt innen kort tid. ${paymentNote}`,
          'success'
        );
      } catch (error) {
        console.error('Booking submit error:', error);
        showStatus(error.message || 'Kunne ikke sende bookingforesp\u00f8rsel. Pr\u00f8v igjen.', 'error');
      }
      isSubmitting = false;
    });
  }

  // --- Handle Bryllupspakke auto-fill ---
  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Given any reference date, return the Thursday of that weekend block:
  // Thu/Fri/Sat → same week's Thursday; Sun/Mon/Tue/Wed → upcoming Thursday.
  const getThursdayFrom = (referenceDate) => {
    const d = new Date(referenceDate);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    let offset;
    if (day === 4)      offset = 0;
    else if (day === 5) offset = -1;
    else if (day === 6) offset = -2;
    else                offset = (4 - day + 7) % 7;
    d.setDate(d.getDate() + offset);
    return d;
  };

  // Update the wedding card text with the current Thu–Sun dates.
  const updateWeddingCard = () => {
    if (!weddingWeekendTextEl || !dateInput?.value || !endDateInputEl?.value) return;
    const thuDate = new Date(dateInput.value + 'T00:00:00');
    const sunDate = new Date(endDateInputEl.value + 'T00:00:00');
    const fmt = (d) => d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
    weddingWeekendTextEl.textContent =
      `${fmt(thuDate)} kl. 16:00 – ${fmt(sunDate)} kl. 11:00`;
  };

  // Fill all start/end fields and refresh the card.
  const applyWeddingDates = (referenceDate) => {
    const thursday = getThursdayFrom(referenceDate);
    const sunday = new Date(thursday);
    sunday.setDate(thursday.getDate() + 3);

    if (datepicker) {
      datepicker.setDate(toDateStr(thursday), true);
    } else if (dateInput) {
      dateInput.value = toDateStr(thursday);
    }
    if (timeInput) timeInput.value = '16:00';
    if (endDateInputEl) endDateInputEl.value = toDateStr(sunday);
    if (endTimeInputEl) endTimeInputEl.value = '11:00';

    updateWeddingCard();
    // Collapse the inline picker after a selection
    if (weddingDatePickerWrapEl) weddingDatePickerWrapEl.hidden = true;
  };

  const showWeddingCard = () => {
    if (normalDatetimeFieldsEl) normalDatetimeFieldsEl.hidden = true;
    if (weddingCardEl) weddingCardEl.hidden = false;
    // Underlying inputs still submit their values; exempt from HTML5 validation
    if (dateInput) dateInput.required = false;
    if (timeInput) timeInput.required = false;
    if (durationInputEl) durationInputEl.required = false;
    if (endDateInputEl) endDateInputEl.required = false;
    if (endTimeInputEl) endTimeInputEl.required = false;
  };

  const hideWeddingCard = () => {
    if (normalDatetimeFieldsEl) normalDatetimeFieldsEl.hidden = false;
    if (weddingCardEl) weddingCardEl.hidden = true;
    if (weddingDatePickerWrapEl) weddingDatePickerWrapEl.hidden = true;
    // Restore required on the normal fields
    if (dateInput) dateInput.required = true;
    if (timeInput) timeInput.required = true;
    if (durationFieldEl) durationFieldEl.hidden = false;
    if (endDateFieldEl) endDateFieldEl.hidden = true;
    if (endTimeFieldEl) endTimeFieldEl.hidden = true;
    if (durationInputEl) durationInputEl.required = true;
    if (endDateInputEl) endDateInputEl.required = false;
    if (endTimeInputEl) endTimeInputEl.required = false;
  };

  const weddingSpacesCheckboxes = document.querySelectorAll('input[name="spaces"]');
  weddingSpacesCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.value === 'Bryllupspakke') {
        if (e.target.checked) {
          const currentVal = dateInput?.value;
          const reference = currentVal ? new Date(currentVal + 'T00:00:00') : new Date();
          applyWeddingDates(reference);
          showWeddingCard();
          if (eventTypeSelect) eventTypeSelect.value = 'Bryllup';
          showStatus('Bryllupspakke valgt – klikk «Endre helg» for å velge en annen uke.', 'info');
        } else {
          hideWeddingCard();
        }
      }
    });
  });

  // Toggle the inline date picker
  if (weddingChangeBtnEl) {
    weddingChangeBtnEl.addEventListener('click', () => {
      if (weddingDatePickerWrapEl) {
        weddingDatePickerWrapEl.hidden = !weddingDatePickerWrapEl.hidden;
        if (!weddingDatePickerWrapEl.hidden && weddingDatePickerEl) {
          weddingDatePickerEl.focus();
        }
      }
    });
  }

  // Picking any date snaps to the correct Thu–Sun block
  if (weddingDatePickerEl) {
    weddingDatePickerEl.addEventListener('change', () => {
      if (weddingDatePickerEl.value) {
        applyWeddingDates(new Date(weddingDatePickerEl.value + 'T00:00:00'));
      }
    });
  }
  // ----------------------------------------

  // Resets the confirmation receipt and shows the form again
  window.resetBookingForm = function () {
    const formEl = document.getElementById('booking-form');
    const sectionHeading = document.querySelector('.booking-form-section .section-heading');
    const confirmation = document.getElementById('booking-confirmation');
    if (confirmation) confirmation.hidden = true;
    if (formEl) { formEl.hidden = false; }
    if (sectionHeading) sectionHeading.hidden = false;
    // Scroll smoothly back to the form
    const target = sectionHeading || formEl;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Image gallery navigation ---
  window.changeImage = function(direction, galleryElement) {
    if (!galleryElement) return;
    
    const images = galleryElement.querySelectorAll('.gallery-image');
    const dots = galleryElement.querySelectorAll('.dot');
    
    if (images.length === 0) return;
    
    let currentIndex = 0;
    images.forEach((img, i) => {
      if (img.classList.contains('active')) {
        currentIndex = i;
      }
    });
    
    // Hide current
    images[currentIndex].classList.remove('active');
    images[currentIndex].style.display = 'none';
    dots[currentIndex].classList.remove('active');
    dots[currentIndex].style.background = 'rgba(255,255,255,0.5)';
    
    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex >= images.length) newIndex = 0;
    if (newIndex < 0) newIndex = images.length - 1;
    
    // Show new
    images[newIndex].classList.add('active');
    images[newIndex].style.display = 'block';
    dots[newIndex].classList.add('active');
    dots[newIndex].style.background = 'white';
  };

  window.showImage = function(index, galleryElement) {
    if (!galleryElement) return;
    
    const images = galleryElement.querySelectorAll('.gallery-image');
    const dots = galleryElement.querySelectorAll('.dot');
    
    if (index < 0 || index >= images.length) return;
    
    // Hide all
    images.forEach(img => {
      img.classList.remove('active');
      img.style.display = 'none';
    });
    dots.forEach(dot => {
      dot.classList.remove('active');
      dot.style.background = 'rgba(255,255,255,0.5)';
    });
    
    // Show selected
    images[index].classList.add('active');
    images[index].style.display = 'block';
    dots[index].classList.add('active');
    dots[index].style.background = 'white';
  };
  // ----------------------------------------
});
