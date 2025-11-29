# Bjørkvang Codebase Instructions

## Project Overview
This project consists of a static frontend website (HTML/CSS/JS) and a serverless backend using Azure Functions (Node.js v4 model). The system manages bookings for the Bjørkvang venue.

## Architecture & Data Flow

### Frontend (`/`)
- **Tech**: Vanilla JavaScript, HTML, CSS.
- **Key Files**:
  - `booking.js`: Handles the booking form, FullCalendar integration, and constructs email payloads.
  - `app.js`: Manages global navigation and UI state.
- **Data Persistence**: Currently relies on `localStorage` (`bookingEvents`) for client-side persistence of calendar events.
- **API Interaction**: Sends POST requests to Azure Functions (specifically `emailHttpTriggerBooking`) to trigger emails.

### Backend (`/functions`)
- **Tech**: Azure Functions (Node.js v4 programming model).
- **Key Functions**:
  - `emailHttpTriggerBooking`: Acts as a secure proxy to send emails via Plunk. Receives pre-formatted HTML/Text from the frontend.
  - `bookingRequest`: (Experimental/Future) Handles booking logic with server-side validation and in-memory storage.
- **Shared Logic**:
  - `functions/shared/email.js`: Handles communication with the Plunk API (`api.useplunk.com`).
  - `functions/shared/http.js`: Utilities for request parsing and response formatting.
  - `functions/shared/bookingStore.js`: **In-memory** storage for bookings (Note: Data is lost on function restart).

## Critical Workflows

### Local Development
1. **Backend**:
   ```bash
   cd functions
   npm install
   npm start
   ```
   *Requires `azure-functions-core-tools`.*
   *Ensure `local.settings.json` contains `PLUNK_API_TOKEN`.*

2. **Frontend**:
   - Open `index.html` directly or serve via a simple HTTP server (e.g., `npx serve .`).
   - Update `BOOKING_EMAIL_ENDPOINT` in `booking.js` to point to localhost if testing full flow.

### Configuration
- **Environment Variables**:
  - `PLUNK_API_TOKEN`: Required for sending emails.
  - `BOARD_TO_ADDRESS`: Recipient for admin notifications.
  - `DEFAULT_FROM_ADDRESS`: Sender address (e.g., `styret@bjørkvang.no`).

## Conventions & Patterns
- **Language**: Code comments and UI text are primarily in **Norwegian** (`nb-NO`).
- **Response Format**: Use `createJsonResponse(status, body)` from `shared/http.js` for consistent API responses.
- **Email Construction**: Currently, the **frontend** (`booking.js`) constructs the email HTML/Text. The backend acts mainly as a delivery mechanism.
- **Error Handling**: Frontend uses `showStatus()` to display user-friendly messages. Backend logs errors to the Azure console context.

## Known Limitations
- **Persistence**: The backend `bookingStore.js` is in-memory only. Production persistence currently relies on the email trail and client-side `localStorage`.
- **Docker**: `docker-compose.yml` references `librebooking` and appears to be for a separate or legacy system, not the current custom implementation.
