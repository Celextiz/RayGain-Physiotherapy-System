(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyAL6rvtbGZoWOQxm2o3fYxvFniwKz9GpXM",
        authDomain: "raygain-cf637.firebaseapp.com",
        projectId: "raygain-cf637",
        storageBucket: "raygain-cf637.firebasestorage.app",
        messagingSenderId: "258723115236",
        appId: "1:258723115236:web:766902037a28c178e6fcf1",
        measurementId: "G-7DXLCJCLVE"
    };

    let db = null;
    if (window.firebase) {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        // Avoid Firestore WebChannel issues (often seen as /Write/channel errors) on some networks/browsers.
        try { db.settings({ experimentalForceLongPolling: true, useFetchStreams: false, merge: true }); } catch (e) {}
    }

    const EMAILJS_SERVICE_ID = 'service_8atajk9';
    const EMAILJS_TEMPLATE_ID = 'template_yp68fop';
    const RAYGAIN_EMAIL_SENDER = 'RayGainPT@gmail.com';
    const CLINIC_CONTACT_NUMBER = '09972375959';
    const CLINIC_LOCATION = 'Butol Santiago Ilocos Sur Zone 3';

    const calendarTitle = document.getElementById('calendarTitle');
    const calendarGrid = document.getElementById('calendarGrid');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    const serviceButtons = Array.from(document.querySelectorAll('[data-service]'));
    const timeButtons = Array.from(document.querySelectorAll('[data-slot]'));

    const selectedDayText = document.getElementById('selectedDayText');
    const summaryService = document.getElementById('summaryService');
    const summaryDate = document.getElementById('summaryDate');
    const summaryTime = document.getElementById('summaryTime');
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    const bookingMessage = document.getElementById('bookingMessage');
    const bookingSuccessModal = document.getElementById('bookingSuccessModal');
    const bookingOkBtn = document.getElementById('bookingOkBtn');
    const cancelAppointmentBtn = document.getElementById('cancelAppointmentBtn');
    const cancelConfirmBox = document.getElementById('cancelConfirmBox');
    const confirmCancelOkBtn = document.getElementById('confirmCancelOkBtn');
    const confirmCancelBackBtn = document.getElementById('confirmCancelBackBtn');
    const inquiryDraftRaw = sessionStorage.getItem('raygainInquiryDraft');
    let inquiryDraft = null;
    try {
        inquiryDraft = inquiryDraftRaw ? JSON.parse(inquiryDraftRaw) : null;
    } catch (error) {
        inquiryDraft = null;
    }

    const DEFAULT_AVAILABLE_WEEKDAYS = [2, 4, 6]; // Tue, Thu, Sat
    let availableWeekdays = new Set(DEFAULT_AVAILABLE_WEEKDAYS);
    const BLOCKED_RED_WEEKDAYS = new Set([0, 1, 3]); // Sun, Mon, Wed

    let viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let selectedDate = null;
    let selectedService = '';
    let selectedSlot = '';
    let lastBookingDocId = '';
    let bookedSlotsByDate = new Map();
    let appointmentsUnsubscribe = null;
    let bookingSettingsUnsubscribe = null;
    let bookingSettings = {
        enabledWeekdays: DEFAULT_AVAILABLE_WEEKDAYS.slice(),
        blockedDates: {},
        disabledSlotsByDate: {}
    };

    function normalizeBookingSettings(data) {
        const source = data && typeof data === 'object' ? data : {};
        const enabledWeekdays = Array.isArray(source.enabledWeekdays)
            ? source.enabledWeekdays.map(function (value) { return Number(value); }).filter(function (value) {
                return Number.isInteger(value) && value >= 0 && value <= 6;
            })
            : DEFAULT_AVAILABLE_WEEKDAYS.slice();

        return {
            enabledWeekdays: enabledWeekdays.length ? Array.from(new Set(enabledWeekdays)) : DEFAULT_AVAILABLE_WEEKDAYS.slice(),
            blockedDates: source.blockedDates && typeof source.blockedDates === 'object' ? source.blockedDates : {},
            disabledSlotsByDate: source.disabledSlotsByDate && typeof source.disabledSlotsByDate === 'object' ? source.disabledSlotsByDate : {}
        };
    }

    async function loadBookingSettings() {
        if (!db || typeof db.collection !== 'function') {
            bookingSettings = normalizeBookingSettings(null);
            availableWeekdays = new Set(bookingSettings.enabledWeekdays);
            return;
        }

        try {
            const settingsDoc = await db.collection('bookingSettings').doc('default').get();
            bookingSettings = normalizeBookingSettings(settingsDoc.exists ? settingsDoc.data() : null);
            availableWeekdays = new Set(bookingSettings.enabledWeekdays);
        } catch (error) {
            console.error('Failed to load booking settings:', error);
            bookingSettings = normalizeBookingSettings(null);
            availableWeekdays = new Set(bookingSettings.enabledWeekdays);
        }
    }

    function todayAtMidnight() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function formatMonthTitle(date) {
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long'
        });
    }

    function formatDate(date) {
        return date.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function isSameDate(a, b) {
        return a && b &&
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildBookingFullName(data) {
        return [
            data?.firstName || '',
            data?.middleName || '',
            data?.suffix || '',
            data?.lastName || ''
        ].map(function (value) { return String(value || '').trim(); }).filter(Boolean).join(' ') || 'Valued Patient';
    }

    function buildBookingEmailMessage(bookingId, bookingMeta) {
        const fullName = buildBookingFullName(inquiryDraft);
        const html = `
            <p>Dear ${escapeHtml(fullName)},</p>
            <p>Warm Greetings! Your appointment request has been received at RayGain Physiotherapy Clinic.</p>
            <p><strong>Booking Details:</strong><br>
            * Service Type: ${escapeHtml(bookingMeta.serviceType)}<br>
            * Date: ${escapeHtml(bookingMeta.dateLabel)}<br>
            * Time: ${escapeHtml(bookingMeta.timeLabel)}<br>
            * Booking ID: ${escapeHtml(bookingId || 'N/A')}</p>
            <p><strong>Location:</strong><br>
            ${escapeHtml(CLINIC_LOCATION)}</p>
            <p>We will review your request and send a confirmation once it has been approved.</p>
            <p><strong>Contact:</strong><br>
            ${escapeHtml(CLINIC_CONTACT_NUMBER)}<br>
            ${escapeHtml(RAYGAIN_EMAIL_SENDER)}</p>
        `;

        const text = [
            `Dear ${fullName},`,
            '',
            'Warm Greetings! Your appointment request has been received at RayGain Physiotherapy Clinic.',
            '',
            'Booking Details:',
            `* Service Type: ${bookingMeta.serviceType}`,
            `* Date: ${bookingMeta.dateLabel}`,
            `* Time: ${bookingMeta.timeLabel}`,
            `* Booking ID: ${bookingId || 'N/A'}`,
            '',
            'Location:',
            CLINIC_LOCATION,
            '',
            'We will review your request and send a confirmation once it has been approved.',
            '',
            'Contact:',
            CLINIC_CONTACT_NUMBER,
            RAYGAIN_EMAIL_SENDER
        ].join('\n');

        return { fullName, html, text };
    }

    async function sendBookingRequestEmail(bookingId) {
        const recipientEmail = String(inquiryDraft?.gmail || inquiryDraft?.email || '').trim();
        if (!recipientEmail) {
            throw new Error('No Gmail found for this booking.');
        }

        const bookingMeta = {
            serviceType: selectedService || inquiryDraft?.serviceType || inquiryDraft?.appointmentSessionType || 'Clinic',
            dateLabel: selectedDate ? formatDate(selectedDate) : String(inquiryDraft?.appointmentDate || inquiryDraft?.date || 'N/A'),
            timeLabel: selectedSlot || inquiryDraft?.appointmentTime || inquiryDraft?.time || 'N/A'
        };
        const message = buildBookingEmailMessage(bookingId, bookingMeta);
        const subject = 'Appointment Request Received - RayGain Physiotherapy Clinic';
        const templateParams = {
            to_email: recipientEmail,
            email: recipientEmail,
            user_email: recipientEmail,
            recipient_email: recipientEmail,
            gmail: recipientEmail,
            to: recipientEmail,
            recipient: recipientEmail,
            send_to: recipientEmail,
            to_name: message.fullName,
            name: message.fullName,
            from_name: RAYGAIN_EMAIL_SENDER,
            reply_to: RAYGAIN_EMAIL_SENDER,
            subject: subject,
            patient_name: message.fullName,
            service_type: bookingMeta.serviceType,
            booking_date: bookingMeta.dateLabel,
            booking_time: bookingMeta.timeLabel,
            booking_id: bookingId || 'N/A',
            clinic_location: CLINIC_LOCATION,
            clinic_contact: CLINIC_CONTACT_NUMBER,
            clinic_email: RAYGAIN_EMAIL_SENDER,
            message_html: message.html,
            message_text: message.text,
            message: message.text
        };

        // Prefer Firebase Extension: Trigger Email (writes to Firestore `mail` collection).
        if (db && typeof db.collection === 'function') {
            await db.collection('mail').add({
                to: recipientEmail,
                message: {
                    subject: subject,
                    text: message.text,
                    html: message.html
                },
                createdAt: new Date().toISOString(),
                source: 'booking-page',
                bookingId: bookingId || null,
                templateParams: templateParams
            });
            return { deliveryMode: 'firestore', recipientEmail: recipientEmail };
        }

        const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.text)}`;
        window.open(mailtoUrl, '_blank');
        return { deliveryMode: 'mailto', recipientEmail: recipientEmail };
    }

    function renderCalendar() {
        if (!calendarGrid || !calendarTitle) return;

        calendarTitle.textContent = formatMonthTitle(viewMonth);
        calendarGrid.innerHTML = '';

        const today = todayAtMidnight();

        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const startWeekday = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < startWeekday; i += 1) {
            const spacer = document.createElement('button');
            spacer.type = 'button';
            spacer.className = 'calendar-cell empty';
            spacer.disabled = true;
            spacer.textContent = '';
            calendarGrid.appendChild(spacer);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const cellDate = new Date(year, month, day);
            const weekday = cellDate.getDay();
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'calendar-cell';
            cell.textContent = String(day);

            const isPast = cellDate < today;
            const canBook = availableWeekdays.has(weekday);
            const isRedBlocked = BLOCKED_RED_WEEKDAYS.has(weekday);
            const dayHasBookedSlots = hasBookedSlots(cellDate);
            const dayIsFullyBooked = isDateFullyBooked(cellDate);
            const dayIsMarkedUnavailable = isDateMarkedUnavailable(cellDate);

            if (!isPast && canBook && !dayIsFullyBooked && !dayIsMarkedUnavailable) {
                cell.classList.add('available');
                if (dayHasBookedSlots) {
                    cell.classList.add('partially-booked');
                    cell.title = 'Some time slots are already booked.';
                }
                cell.addEventListener('click', function () {
                    selectedDate = cellDate;
                    bookingMessage.textContent = '';
                    renderCalendar();
                    updateTimeSlotAvailability();
                    renderSummary();
                });
            } else {
                cell.disabled = true;
                if (!isPast && dayIsMarkedUnavailable) {
                    cell.classList.add('blocked-red');
                    cell.title = 'Not available for this day.';
                    const blockedBadge = document.createElement('span');
                    blockedBadge.className = 'calendar-cell-badge-full';
                    blockedBadge.textContent = 'Unavailable';
                    cell.appendChild(blockedBadge);
                } else if (!isPast && canBook && dayIsFullyBooked) {
                    cell.classList.add('fully-booked');
                    cell.title = 'All time slots are already booked for this day.';
                    const fullBadge = document.createElement('span');
                    fullBadge.className = 'calendar-cell-badge-full';
                    fullBadge.textContent = 'Full';
                    cell.appendChild(fullBadge);
                } else if (isPast || isRedBlocked) {
                    cell.classList.add('blocked-red');
                } else {
                    cell.classList.add('blocked');
                }
            }

            if (isSameDate(selectedDate, cellDate)) {
                cell.classList.add('selected');
            }

            calendarGrid.appendChild(cell);
        }

        if (prevMonthBtn) {
            const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const isAtOrBeforeCurrent = viewMonth <= currentMonth;
            prevMonthBtn.disabled = isAtOrBeforeCurrent;
            prevMonthBtn.style.opacity = isAtOrBeforeCurrent ? '0.45' : '1';
            prevMonthBtn.style.cursor = isAtOrBeforeCurrent ? 'not-allowed' : 'pointer';
        }

        if (selectedDate && selectedDate < today) {
            selectedDate = null;
            renderSummary();
        }
    }

    function selectChoice(buttons, value, attrName) {
        buttons.forEach(function (btn) {
            const isSelected = btn.getAttribute(attrName) === value;
            btn.classList.toggle('is-selected', isSelected);
        });
    }

    function renderSummary() {
        selectedDayText.textContent = selectedDate ? formatDate(selectedDate) : 'No date selected yet';
        summaryService.textContent = selectedService || 'Not selected';
        summaryDate.textContent = selectedDate ? formatDate(selectedDate) : 'Not selected';
        summaryTime.textContent = selectedSlot || 'Not selected';
    }

    function toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function isActiveAppointment(data) {
        if (!data || typeof data !== 'object') return false;
        if (data.isDeleted === true) return false;
        if (data.canceledArchived === true) return false;
        const status = String(data.status || '').toLowerCase();
        if (status === 'canceled' || status === 'cancelled') return false;
        return true;
    }

    function getAppointmentDateKey(data) {
        const dateValue = data?.date || data?.appointmentDate || data?.bookingDate || '';
        return String(dateValue || '').trim();
    }

    function getAppointmentTimeKey(data) {
        const timeValue = data?.time || data?.appointmentTime || data?.timeRange || '';
        return String(timeValue || '').trim();
    }

    function getBookedSlotsForDate(date) {
        if (!date) return new Set();
        const dateKey = toDateKey(date);
        const slots = bookedSlotsByDate.get(dateKey);
        return slots ? new Set(slots) : new Set();
    }

    function getDisabledSlotsForDate(date) {
        if (!date) return new Set();
        const dateKey = toDateKey(date);
        const slotsByDate = bookingSettings && bookingSettings.disabledSlotsByDate
            ? bookingSettings.disabledSlotsByDate
            : {};
        const value = slotsByDate[dateKey];
        return Array.isArray(value) ? new Set(value) : new Set();
    }

    function isDateMarkedUnavailable(date) {
        if (!date) return false;
        const dateKey = toDateKey(date);
        const blockedDates = bookingSettings && bookingSettings.blockedDates
            ? bookingSettings.blockedDates
            : {};
        return !!blockedDates[dateKey];
    }

    function isDateFullyBooked(date) {
        if (!date) return false;
        const bookedCount = getBookedSlotsForDate(date).size;
        const disabledCount = getDisabledSlotsForDate(date).size;
        return (bookedCount + disabledCount) >= timeButtons.length;
    }

    function hasBookedSlots(date) {
        if (!date) return false;
        return getBookedSlotsForDate(date).size > 0;
    }

    function updateTimeSlotAvailability() {
        const bookedSlots = getBookedSlotsForDate(selectedDate);
        const disabledSlots = getDisabledSlotsForDate(selectedDate);

        if (selectedSlot && (bookedSlots.has(selectedSlot) || disabledSlots.has(selectedSlot))) {
            selectedSlot = '';
        }

        timeButtons.forEach(function (btn) {
            const slotValue = String(btn.getAttribute('data-slot') || '');
            const isBooked = !!selectedDate && bookedSlots.has(slotValue);
            const isDisabledByClinic = !!selectedDate && disabledSlots.has(slotValue);
            btn.disabled = isBooked || isDisabledByClinic;
            btn.classList.toggle('is-booked-slot', isBooked || isDisabledByClinic);
            if (isBooked || isDisabledByClinic) {
                btn.classList.remove('is-selected');
                btn.title = isBooked
                    ? 'This time slot is already booked.'
                    : 'This time slot is not available for this day.';
            } else {
                btn.title = '';
            }
        });
    }

    async function loadBookedSlots() {
        if (!db || typeof db.collection !== 'function') {
            bookedSlotsByDate = new Map();
            updateTimeSlotAvailability();
            renderCalendar();
            renderSummary();
            return;
        }

        const nextMap = new Map();
        const snapshot = await db.collection('appointments').get();

        snapshot.forEach(function (doc) {
            const data = doc.data() || {};
            if (!isActiveAppointment(data)) return;

            const dateKey = getAppointmentDateKey(data);
            const timeKey = getAppointmentTimeKey(data);
            if (!dateKey || !timeKey) return;

            if (!nextMap.has(dateKey)) {
                nextMap.set(dateKey, new Set());
            }
            nextMap.get(dateKey).add(timeKey);
        });

        bookedSlotsByDate = nextMap;

        if (selectedDate && isDateFullyBooked(selectedDate)) {
            selectedDate = null;
            selectedSlot = '';
        }

        updateTimeSlotAvailability();
        renderCalendar();
        renderSummary();
    }

    function subscribeToBookedSlots() {
        if (!db || typeof db.collection !== 'function') return;

        if (appointmentsUnsubscribe) {
            appointmentsUnsubscribe();
        }

        appointmentsUnsubscribe = db.collection('appointments').onSnapshot(function () {
            loadBookedSlots().catch(function (error) {
                console.error('Failed to refresh booked slots:', error);
            });
        }, function (error) {
            console.error('Appointments subscription failed:', error);
        });
    }

    function subscribeToBookingSettings() {
        if (!db || typeof db.collection !== 'function') return;

        if (bookingSettingsUnsubscribe) {
            bookingSettingsUnsubscribe();
        }

        bookingSettingsUnsubscribe = db.collection('bookingSettings').doc('default').onSnapshot(function (docSnapshot) {
            bookingSettings = normalizeBookingSettings(docSnapshot && docSnapshot.exists ? docSnapshot.data() : null);
            availableWeekdays = new Set(bookingSettings.enabledWeekdays);
            updateTimeSlotAvailability();
            renderCalendar();
            renderSummary();
        }, function (error) {
            console.error('Booking settings subscription failed:', error);
        });
    }

    async function hasBookingConflict(dateKey, timeKey) {
        if (!db || !dateKey || !timeKey) return false;

        const snapshot = await db.collection('appointments').where('date', '==', dateKey).get();
        let conflictFound = false;

        snapshot.forEach(function (doc) {
            if (conflictFound) return;
            const data = doc.data() || {};
            if (!isActiveAppointment(data)) return;
            if (getAppointmentTimeKey(data) === timeKey) {
                conflictFound = true;
            }
        });

        return conflictFound;
    }

    function openSuccessModal() {
        if (!bookingSuccessModal) return;
        bookingSuccessModal.classList.add('is-open');
        bookingSuccessModal.setAttribute('aria-hidden', 'false');
        if (cancelConfirmBox) cancelConfirmBox.hidden = true;
    }

    function closeSuccessModal() {
        if (!bookingSuccessModal) return;
        bookingSuccessModal.classList.remove('is-open');
        bookingSuccessModal.setAttribute('aria-hidden', 'true');
        if (cancelConfirmBox) cancelConfirmBox.hidden = true;
    }

    if (bookingOkBtn) {
        bookingOkBtn.addEventListener('click', function () {
            closeSuccessModal();
            // Redirect to home page after closing modal
            window.location.href = 'index.html';
        });
    }

    if (cancelAppointmentBtn) {
        cancelAppointmentBtn.addEventListener('click', function () {
            if (cancelConfirmBox) {
                cancelConfirmBox.hidden = false;
            }
        });
    }

    if (confirmCancelBackBtn) {
        confirmCancelBackBtn.addEventListener('click', function () {
            if (cancelConfirmBox) {
                cancelConfirmBox.hidden = true;
            }
        });
    }

    if (confirmCancelOkBtn) {
        confirmCancelOkBtn.addEventListener('click', async function () {
            if (!db || !lastBookingDocId) {
                bookingMessage.textContent = 'No appointment found to cancel.';
                bookingMessage.style.color = '#c24444';
                closeSuccessModal();
                return;
            }

            confirmCancelOkBtn.disabled = true;
            confirmCancelOkBtn.textContent = 'Cancelling...';

            try {
                await db.collection('appointments').doc(lastBookingDocId).delete();
                bookingMessage.textContent = 'Appointment cancelled successfully.';
                bookingMessage.style.color = '#c24444';
                lastBookingDocId = '';
                await loadBookedSlots();
                closeSuccessModal();
            } catch (error) {
                bookingMessage.textContent = 'Failed to cancel appointment. Please try again.';
                bookingMessage.style.color = '#c24444';
            } finally {
                confirmCancelOkBtn.disabled = false;
                confirmCancelOkBtn.textContent = 'OK';
            }
        });
    }

    serviceButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            selectedService = btn.getAttribute('data-service') || '';
            selectChoice(serviceButtons, selectedService, 'data-service');
            renderSummary();
        });
    });

    timeButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            selectedSlot = btn.getAttribute('data-slot') || '';
            selectChoice(timeButtons, selectedSlot, 'data-slot');
            renderSummary();
        });
    });

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function () {
            const current = todayAtMidnight();
            const currentMonth = new Date(current.getFullYear(), current.getMonth(), 1);
            const candidate = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
            if (candidate < currentMonth) return;
            viewMonth = candidate;
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function () {
            viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
            renderCalendar();
        });
    }

    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', async function () {
            if (!selectedService || !selectedDate || !selectedSlot) {
                bookingMessage.textContent = 'Select service type, available date, and time slot first.';
                bookingMessage.style.color = '#c24444';
                return;
            }

            if (!db) {
                bookingMessage.textContent = 'Firebase is not available. Please refresh and try again.';
                bookingMessage.style.color = '#c24444';
                return;
            }

            confirmBookingBtn.disabled = true;
            confirmBookingBtn.textContent = 'Saving...';

            const selectedDateKey = toDateKey(selectedDate);

            try {
                const slotAlreadyTaken = await hasBookingConflict(selectedDateKey, selectedSlot);
                if (slotAlreadyTaken) {
                    await loadBookedSlots();
                    bookingMessage.textContent = 'That date and time is already booked. Please choose another slot.';
                    bookingMessage.style.color = '#c24444';
                    return;
                }
            } catch (error) {
                bookingMessage.textContent = 'Unable to verify booking availability. Please try again.';
                bookingMessage.style.color = '#c24444';
                return;
            }

            const bookingPayload = {
                serviceType: selectedService,
                date: selectedDateKey,
                dateLabel: formatDate(selectedDate),
                time: selectedSlot,
                source: 'booking-page',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                inquiryData: inquiryDraft || null
            };

            try {
                const docRef = await db.collection('appointments').add(bookingPayload);
                lastBookingDocId = docRef.id;

                // Also save inquiry data to 'inquiries' collection for therapist-dashboard
                if (inquiryDraft) {
                    const inquiryRecord = {
                        ...inquiryDraft,
                        appointmentDate: selectedDateKey,
                        appointmentDateLabel: formatDate(selectedDate),
                        appointmentTime: selectedSlot,
                        appointmentSessionType: selectedService,
                        status: 'pending',
                        isDeleted: false,
                        bookingId: docRef.id,
                        bookingCreatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        inquiryCreatedAt: inquiryDraft.inquirySubmittedAt || new Date().toISOString()
                    };
                    await db.collection('inquiries').add(inquiryRecord);
                }

                let emailResult = null;
                try {
                    emailResult = await sendBookingRequestEmail(docRef.id);
                } catch (emailError) {
                    console.error('Booking email failed:', emailError);
                    emailResult = { deliveryMode: 'failed', error: emailError };
                }

                if (emailResult && emailResult.deliveryMode === 'emailjs') {
                    bookingMessage.textContent = `Booking saved successfully. Email sent to ${emailResult.recipientEmail}.`;
                    bookingMessage.style.color = '#1d7b85';
                } else if (emailResult && emailResult.deliveryMode === 'mailto') {
                    bookingMessage.textContent = `Booking saved successfully. Your mail app opened for ${emailResult.recipientEmail}.`;
                    bookingMessage.style.color = '#1d7b85';
                } else if (emailResult && emailResult.error) {
                    bookingMessage.textContent = `Booking saved successfully, but email could not be sent: ${emailResult.error.message || 'Unknown error'}`;
                    bookingMessage.style.color = '#c24444';
                } else {
                    bookingMessage.textContent = 'Booking saved successfully.';
                    bookingMessage.style.color = '#1d7b85';
                }
                sessionStorage.removeItem('raygainInquiryDraft');
                await loadBookedSlots();
                openSuccessModal();
            } catch (error) {
                bookingMessage.textContent = 'Failed to save booking. Please try again.';
                bookingMessage.style.color = '#c24444';
            } finally {
                confirmBookingBtn.disabled = false;
                confirmBookingBtn.textContent = 'Confirm Booking';
            }
        });
    }

    Promise.all([
        loadBookingSettings(),
        loadBookedSlots()
    ]).then(function () {
        subscribeToBookedSlots();
        subscribeToBookingSettings();
    }).catch(function (error) {
        console.error('Failed to load booking view:', error);
        renderCalendar();
        renderSummary();
    });
})();
