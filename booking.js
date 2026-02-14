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
  const durationInputEl = document.getElementById('duration');
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

  // Calculate total price based on selected spaces and attendees
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

    return total;
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
  if (form) {
    const spacesCheckboxes = form.querySelectorAll('input[name="spaces"]');
    spacesCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updatePriceDisplay);
    });

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

  // Check if returning from Vipps payment
  const urlParams = new URLSearchParams(window.location.search);
  const vippsStatus = urlParams.get('status');
  const vippsOrderId = urlParams.get('orderId');

  // Store Vipps return parameters to handle after initialization
  let pendingVippsReturn = null;
  if (vippsStatus === 'success' && vippsOrderId) {
    pendingVippsReturn = vippsOrderId;
  }

  async function handleVippsReturn(orderId) {
    try {
      // Show status message
      if (statusEl) {
        showStatus('Verifiserer betaling ...', 'info');
      }

      // Check payment status with Vipps
      const statusResponse = await fetch(`${API_BASE_URL}/api/vipps/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      if (!statusResponse.ok) {
        throw new Error('Kunne ikke verifisere betaling');
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'AUTHORIZED' || statusData.status === 'CAPTURED') {
        // Payment successful - submit the booking
        const pendingBooking = sessionStorage.getItem('pendingBooking');
        if (pendingBooking) {
          const bookingDetails = JSON.parse(pendingBooking);

          // Add payment information
          bookingDetails.paymentOrderId = orderId;
          bookingDetails.paymentStatus = 'paid';

          await submitBooking(bookingDetails);

          // Clean up session storage
          sessionStorage.removeItem('pendingBooking');
          sessionStorage.removeItem('vippsOrderId');

          // Add to events
          const { startDate: startDateObj, endDate: endDateObj, ...restDetails } = bookingDetails;
          const startDate = new Date(startDateObj);
          const endDate = new Date(endDateObj);

          const newEvent = {
            title: bookingDetails.eventType || 'Reservert',
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            extendedProps: {
              ...restDetails,
              status: 'confirmed', // Paid bookings are auto-confirmed
              createdAt: new Date().toISOString(),
              paymentStatus: 'paid'
            }
          };

          events.push(newEvent);
          events.sort((a, b) => new Date(a.start) - new Date(b.start));

          if (calendar) {
            calendar.addEvent(newEvent);
            highlightDayCells();
          }

          updateReservationList();

          showStatus('Betaling godkjent! Din booking er bekreftet. Du vil motta e-post med bekreftelse.', 'success');
        } else {
          showStatus('Betaling godkjent, men bookingdetaljer mangler. Ta kontakt med styret.', 'error');
        }
      } else {
        showStatus('Betalingen ble ikke fullført. Prøv igjen eller velg "Betal etter godkjenning".', 'error');
      }
    } catch (error) {
      console.error('Error handling Vipps return:', error);
      showStatus('Kunne ikke verifisere betalingen. Ta kontakt med styret hvis beløpet er trukket.', 'error');
    }

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function submitBooking(bookingDetails) {
      const payload = {
          date: bookingDetails.startDate.toISOString().split('T')[0],
          time: bookingDetails.startDate.toTimeString().slice(0, 5),
          requesterName: bookingDetails.name,
          requesterEmail: bookingDetails.email,
          phone: bookingDetails.phone,
          message: bookingDetails.message,
          duration: bookingDetails.duration,
          eventType: bookingDetails.eventType,
          spaces: bookingDetails.spaces,
          services: bookingDetails.services,
          attendees: bookingDetails.attendees,
          paymentOrderId: bookingDetails.paymentOrderId || null,
          paymentStatus: bookingDetails.paymentStatus || 'unpaid'
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
          throw new Error(errorData.error || 'Kunne ikke sende bookingforespørsel');
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

      // Handle Vipps return if returning from payment
      if (pendingVippsReturn) {
        await handleVippsReturn(pendingVippsReturn);
        pendingVippsReturn = null;
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
        if (dateInput) {
          dateInput.value = info.dateStr;
        }
        if (statusEl) {
          showStatus('Datoen er lagt inn i skjemaet. Fullfør feltene under for å sende forespørselen.', 'info');
        }
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      select: function (selectionInfo) {
        if (dateInput) {
          dateInput.value = selectionInfo.startStr.slice(0, 10);
        }
        if (timeInput && !selectionInfo.allDay) {
          timeInput.value = selectionInfo.startStr.slice(11, 16);
        }
        if (durationInputEl && selectionInfo.end) {
          const diff = (selectionInfo.end.getTime() - selectionInfo.start.getTime()) / (60 * 60 * 1000);
          if (!Number.isNaN(diff) && diff >= 1) {
            const clamped = Math.min(12, Math.round(diff));
            durationInputEl.value = String(clamped);
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
      const phone = (formValues.phone || '').trim();
      const dateValue = formValues.date || '';
      const timeValue = formValues.time || '';
      const durationInput = formValues.duration || '';
      const eventType = (formValues.eventType || '').trim();
      const message = (formValues.message || '').trim();
      const attendeesValue = (formValues.attendees || '').trim();
      const selectedSpaces = Array.from(form.querySelectorAll('input[name="spaces"]:checked')).map((input) => input.value);
      const selectedServices = Array.from(form.querySelectorAll('input[name="services"]:checked')).map((input) => input.value);
      const notificationEmailRaw = (formValues.notificationEmail || '').trim();
      const paymentMethod = formValues.paymentMethod || 'later';

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

      if (!name || !email || !phone || !dateValue || !timeValue || !durationInput || !eventType) {
        showStatus('Vennligst fyll ut alle obligatoriske felter.', 'error');
        isSubmitting = false;
        return;
      }

      if (!selectedSpaces.length) {
        showStatus('Velg minst ett område du ønsker å leie.', 'error');
        isSubmitting = false;
        return;
      }

      const duration = parseFloat(durationInput);
      if (!Number.isFinite(duration) || duration <= 0) {
        showStatus('Varighet må være minst én time.', 'error');
        isSubmitting = false;
        return;
      }

      const startDate = new Date(`${dateValue}T${timeValue}`);
      if (Number.isNaN(startDate.getTime())) {
        showStatus('Ugyldig dato eller klokkeslett.', 'error');
        isSubmitting = false;
        return;
      }

      const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

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
        message,
        duration,
        eventType,
        spaces: selectedSpaces,
        services: selectedServices,
        attendees: attendeeCount,
        startDate,
        endDate
      };

      // If user chose Vipps payment, redirect to Vipps first
      if (paymentMethod === 'vipps') {
        try {
          showStatus('Starter Vipps-betaling ...', 'info');

          const vippsResponse = await fetch(`${API_BASE_URL}/api/vipps/initiate-booking`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phoneNumber: phone,
              spaces: selectedSpaces,
              attendees: attendeeCount,
              date: dateValue,
              time: timeValue,
              requesterName: name,
              eventType: eventType
            })
          });

          if (!vippsResponse.ok) {
            const errorData = await vippsResponse.json();
            throw new Error(errorData.error || 'Kunne ikke starte Vipps-betaling');
          }

          const vippsData = await vippsResponse.json();

          // Store booking details in sessionStorage so we can submit after payment
          sessionStorage.setItem('pendingBooking', JSON.stringify(bookingDetails));
          sessionStorage.setItem('vippsOrderId', vippsData.orderId);

          // Redirect to Vipps
          window.location.href = vippsData.url;
          return;
        } catch (error) {
          console.error('Vipps payment error:', error);
          showStatus('Kunne ikke starte Vipps-betaling. Prøv "Betal etter godkjenning" i stedet.', 'error');
          isSubmitting = false;
          return;
        }
      }

      // Regular booking submission without Vipps payment

      try {
        showStatus('Sender forespørselen ...', 'info');
        await submitBooking(bookingDetails);
      } catch (error) {
        console.error('Kunne ikke sende bookingforespørsel:', error);
        showStatus(
          'Kunne ikke sende bookingforespørselen. Sjekk nettforbindelsen og prøv igjen litt senere.',
          'error'
        );
        isSubmitting = false;
        return;
      }

      const { startDate: startDateObj, endDate: endDateObj, ...restDetails } = bookingDetails;

      const newEvent = {
        title: eventType || 'Reservert',
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        extendedProps: {
          ...restDetails,
          startDate: startDateObj.toISOString(),
          endDate: endDateObj.toISOString(),
          status,
          createdAt: new Date().toISOString()
        }
      };

      events.push(newEvent);
      events.sort((a, b) => new Date(a.start) - new Date(b.start));

      try {
        const eventsJson = JSON.stringify(events);
        localStorage.setItem('bookingEvents', eventsJson);
      } catch (err) {
        console.error('Kunne ikke lagre hendelse:', err);
        // Check if quota exceeded
        if (err.name === 'QuotaExceededError') {
          console.warn('LocalStorage quota exceeded. Removing old events.');
          // Keep only future events to save space
          const futureEvents = events.filter(e => new Date(e.start) >= new Date());
          try {
            localStorage.setItem('bookingEvents', JSON.stringify(futureEvents));
            events = futureEvents;
          } catch (retryErr) {
            console.error('Still failed after cleanup:', retryErr);
          }
        }
      }

      if (calendar) {
        calendar.addEvent(newEvent);
        highlightDayCells();
      }

      updateReservationList();
      highlightDayCells();

      form.reset();
      if (durationInputEl) {
        durationInputEl.value = '4';
      }
      if (eventTypeSelect) {
        eventTypeSelect.selectedIndex = 0;
      }

      showStatus(
        'Din bookingforespørsel er mottatt og vises nå i kalenderen. Du blir kontaktet av styret for endelig bekreftelse.'
      );
      
      isSubmitting = false;
    });
  }

  // --- NEW: Handle Bryllupspakke logic ---
  const spacesCheckboxes = document.querySelectorAll('input[name="spaces"]');
  spacesCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.value === 'Bryllupspakke' && e.target.checked) {
        // Uncheck others to avoid confusion
        spacesCheckboxes.forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
        // Suggest duration (e.g. whole weekend = 48+ hours)
        if (durationInputEl) durationInputEl.value = 48; 
        // Auto-select event type
        if (eventTypeSelect) eventTypeSelect.value = 'Familiefeiring';
        
        showStatus('Bryllupspakke valgt. Varighet satt til helg (48t).', 'info');
      } else if (e.target.checked && e.target.value !== 'Bryllupspakke') {
        // If selecting regular spaces, uncheck Bryllupspakke
        const wedding = document.querySelector('input[name="spaces"][value="Bryllupspakke"]');
        if (wedding && wedding.checked) {
            wedding.checked = false;
            if (durationInputEl) durationInputEl.value = 4; // Reset to default
        }
      }
    });
  });
  // ----------------------------------------
});
