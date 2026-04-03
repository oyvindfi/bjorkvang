/**
 * Check if a new booking overlaps with any existing (non-rejected/cancelled) bookings.
 * Handles the "Hele lokalet" rule: booking the whole premises conflicts with any
 * individual room, and any individual room conflicts with a whole-premises booking.
 *
 * @param {Object} newBooking - { date, time, duration, spaces, id? }
 * @param {Array}  existingBookings
 * @returns {{ conflict: boolean, conflictingBooking: Object|null }}
 */
function checkForDoubleBooking(newBooking, existingBookings) {
    const newStart = new Date(`${newBooking.date}T${newBooking.time}`);
    const newEnd = new Date(newStart.getTime() + newBooking.duration * 60 * 60 * 1000);

    const WHOLE_PREMISES = ['Hele lokalet', 'Bryllupspakke'];
    const newIncludesWhole = newBooking.spaces.some(s => WHOLE_PREMISES.includes(s));

    for (const existing of existingBookings) {
        if (['rejected', 'cancelled', 'pending'].includes(existing.status)) continue;

        // Skip the booking being rescheduled
        if (newBooking.id && existing.id === newBooking.id) continue;

        const existingSpaces = Array.isArray(existing.spaces)
            ? existing.spaces
            : [existing.spaces].filter(Boolean);
        const existingIncludesWhole = existingSpaces.some(s => WHOLE_PREMISES.includes(s));

        const spacesOverlap =
            newIncludesWhole ||
            existingIncludesWhole ||
            newBooking.spaces.some((s) => existingSpaces.includes(s));

        if (!spacesOverlap) continue;

        const existingStart = new Date(`${existing.date}T${existing.time || '00:00'}`);
        const existingEnd = new Date(existingStart.getTime() + (existing.duration || 1) * 60 * 60 * 1000);

        if (newStart < existingEnd && newEnd > existingStart) {
            return { conflict: true, conflictingBooking: existing };
        }
    }

    return { conflict: false, conflictingBooking: null };
}

module.exports = { checkForDoubleBooking };
