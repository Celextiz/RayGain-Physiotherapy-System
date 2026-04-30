(function () {
    const form = document.getElementById('inquireForm');
    const message = document.getElementById('formMessage');

    if (!form) return;

    const NAME_REGEX = /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/;
    const CONTACT_REGEX = /^09\d{9}$/;
    const SUFFIX_REGEX = /^(Jr|Sr|III)$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const RAYGAIN_EMAIL_SENDER = 'RayGainPT@gmail.com';
    const CLINIC_CONTACT_NUMBER = '09972375959';
    const CLINIC_LOCATION = 'Butol Santiago Ilocos Sur Zone 3';
    const db = window.raygainDb || null;
    const submitBtn = form.querySelector('button[type="submit"]');
    let isSubmitting = false;

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isActiveRecord(data) {
        if (!data || typeof data !== 'object') return false;
        if (data.isDeleted === true) return false;
        if (data.canceledArchived === true) return false;
        const status = String(data.status || '').toLowerCase();
        if (status === 'canceled' || status === 'cancelled') return false;
        return true;
    }

    async function hasExistingBookingForEmail(email) {
        if (!db) return false;
        const normalized = normalizeEmail(email);
        if (!normalized) return false;

        const [inquiriesSnap, inquiriesFallbackSnap, appointmentsSnap, appointmentsFallbackSnap] = await Promise.all([
            db.collection('inquiries').where('gmail', '==', normalized).get(),
            db.collection('inquiries').where('email', '==', normalized).get(),
            db.collection('appointments').where('inquiryData.gmail', '==', normalized).get(),
            db.collection('appointments').where('inquiryData.email', '==', normalized).get()
        ]);

        const inquiryExists = [inquiriesSnap, inquiriesFallbackSnap].some(function (snap) {
            let found = false;
            snap.forEach(function (doc) {
                if (found) return;
                const data = doc.data() || {};
                if (isActiveRecord(data)) {
                    found = true;
                }
            });
            return found;
        });

        if (inquiryExists) return true;

        const appointmentExists = [appointmentsSnap, appointmentsFallbackSnap].some(function (snap) {
            let found = false;
            snap.forEach(function (doc) {
                if (found) return;
                const data = doc.data() || {};
                if (isActiveRecord(data)) {
                    found = true;
                }
            });
            return found;
        });

        return appointmentExists;
    }

    function buildFullName(payload) {
        return [
            payload.firstName || '',
            payload.middleName || '',
            payload.suffix || '',
            payload.lastName || ''
        ].map(function (v) { return String(v || '').trim(); }).filter(Boolean).join(' ') || 'Valued Patient';
    }

    function buildInquiryTemplateParams(payload) {
        const recipientEmail = String(payload.gmail || payload.email || '').trim();
        const fullName = buildFullName(payload);
        const subject = 'Inquiry Received - RayGain Physiotherapy Clinic';
        const messageText = [
            `Dear ${fullName},`,
            '',
            'We received your inquiry at RayGain Physiotherapy Clinic.',
            'Please continue to the booking page to choose your date and time slot.',
            '',
            'Contact:',
            CLINIC_CONTACT_NUMBER,
            RAYGAIN_EMAIL_SENDER
        ].join('\n');

        return {
            recipientEmail: recipientEmail,
            subject: subject,
            html: `<p>${messageText.replace(/\n/g, '<br>')}</p>`,
            text: messageText
        };
    }

    async function queueInquiryReceiptEmail(payload) {
        if (!db) throw new Error('Firestore is not available on this page.');
        const prepared = buildInquiryTemplateParams(payload);
        if (!prepared.recipientEmail) throw new Error('No Gmail provided for this inquiry.');

        // Firebase Extension: Trigger Email listens to the `mail` collection by default.
        await db.collection('mail').add({
            to: prepared.recipientEmail,
            message: {
                subject: prepared.subject,
                text: prepared.text,
                html: prepared.html
            },
            createdAt: new Date().toISOString(),
            source: 'inquire-page'
        });
    }

    function getErrorEl(field) {
        if (!field || !field.parentElement) return null;
        let errorEl = field.parentElement.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'field-error';
            errorEl.setAttribute('aria-live', 'polite');
            field.parentElement.appendChild(errorEl);
        }
        return errorEl;
    }

    function setFieldError(field, text) {
        if (!field) return;
        field.style.borderBottomColor = '#d84b4b';
        const errorEl = getErrorEl(field);
        if (errorEl) {
            errorEl.textContent = text;
            errorEl.classList.add('is-visible');
        }
    }

    function clearFieldError(field) {
        if (!field) return;
        field.style.borderBottomColor = '#2f9ea6';
        const errorEl = getErrorEl(field);
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('is-visible');
        }
    }

    function valueOf(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function validateField(field, options) {
        if (!field) return true;

        const value = field.value.trim();
        if (options.required && !value) {
            setFieldError(field, options.requiredMessage || 'This field is required.');
            return false;
        }

        if (!value && !options.required) {
            field.style.borderBottomColor = '#b8bcc2';
            const errorEl = getErrorEl(field);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('is-visible');
            }
            return true;
        }

        if (options.test && !options.test(value)) {
            setFieldError(field, options.invalidMessage || 'Invalid value.');
            return false;
        }

        clearFieldError(field);
        return true;
    }

    const fieldRules = [
        {
            id: 'firstName',
            required: true,
            requiredMessage: 'First Name is required.',
            test: function (v) { return NAME_REGEX.test(v); },
            invalidMessage: 'Letters only. No numbers allowed.'
        },
        {
            id: 'middleName',
            required: true,
            requiredMessage: 'Middle Name is required.',
            test: function (v) { return NAME_REGEX.test(v); },
            invalidMessage: 'Letters only. No numbers allowed.'
        },
        {
            id: 'lastName',
            required: true,
            requiredMessage: 'Last Name is required.',
            test: function (v) { return NAME_REGEX.test(v); },
            invalidMessage: 'Letters only. No numbers allowed.'
        },
        {
            id: 'emergencyFirstName',
            required: true,
            requiredMessage: 'Emergency First Name is required.',
            test: function (v) { return NAME_REGEX.test(v); },
            invalidMessage: 'Letters only. No numbers allowed.'
        },
        {
            id: 'emergencyLastName',
            required: true,
            requiredMessage: 'Emergency Last Name is required.',
            test: function (v) { return NAME_REGEX.test(v); },
            invalidMessage: 'Letters only. No numbers allowed.'
        },
        {
            id: 'suffix',
            required: false,
            test: function (v) { return SUFFIX_REGEX.test(v); },
            invalidMessage: 'Suffix must be Jr, Sr, or III.'
        },
        {
            id: 'age',
            required: true,
            requiredMessage: 'Age is required.',
            test: function (v) {
                const n = Number(v);
                return Number.isInteger(n) && n >= 1 && n <= 100;
            },
            invalidMessage: 'Age must be from 1 to 100 only.'
        },
        {
            id: 'contactNumber',
            required: true,
            requiredMessage: 'Contact Number is required.',
            test: function (v) { return CONTACT_REGEX.test(v); },
            invalidMessage: 'Must start with 09 and be exactly 11 digits.'
        },
        {
            id: 'emergencyContactNumber',
            required: true,
            requiredMessage: 'Emergency Contact Number is required.',
            test: function (v) { return CONTACT_REGEX.test(v); },
            invalidMessage: 'Must start with 09 and be exactly 11 digits.'
        },
        {
            id: 'gmail',
            required: true,
            requiredMessage: 'Gmail is required.',
            test: function (v) { return EMAIL_REGEX.test(v); },
            invalidMessage: 'Enter a valid Gmail address.'
        },
        {
            id: 'emergencyGmail',
            required: false,
            test: function (v) { return EMAIL_REGEX.test(v); },
            invalidMessage: 'Enter a valid email address or leave it blank.'
        },
        { id: 'barangay', required: true, requiredMessage: 'Barangay is required.' },
        { id: 'municipality', required: true, requiredMessage: 'Municipality is required.' },
        { id: 'provinceCity', required: true, requiredMessage: 'Province/City is required.' },
        { id: 'caseCondition', required: true, requiredMessage: 'Case/Condition is required.' },
        { id: 'emergencyRelation', required: true, requiredMessage: 'Relation is required.' }
    ];

    fieldRules.forEach(function (rule) {
        const field = document.getElementById(rule.id);
        if (!field) return;
        const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventName, function () {
            validateField(field, rule);
        });
    });

    const caseConditionField = document.getElementById('caseCondition');
    if (caseConditionField) {
        caseConditionField.addEventListener('change', function () {
            if (caseConditionField.value.trim().toLowerCase() === 'others') {
                caseConditionField.value = '';
                caseConditionField.focus();
                const err = caseConditionField.parentElement && caseConditionField.parentElement.querySelector('.field-error');
                if (err) {
                    err.textContent = 'Type your case/condition.';
                    err.classList.add('is-visible');
                }
                caseConditionField.style.borderBottomColor = '#2f9ea6';
            }
        });
    }

    const emergencyRelationField = document.getElementById('emergencyRelation');
    if (emergencyRelationField) {
        emergencyRelationField.addEventListener('change', function () {
            if (emergencyRelationField.value.trim().toLowerCase() === 'others') {
                emergencyRelationField.value = '';
                emergencyRelationField.focus();
                const err = emergencyRelationField.parentElement && emergencyRelationField.parentElement.querySelector('.field-error');
                if (err) {
                    err.textContent = 'Type the relation.';
                    err.classList.add('is-visible');
                }
                emergencyRelationField.style.borderBottomColor = '#2f9ea6';
            }
        });
    }

    const ageField = document.getElementById('age');
    if (ageField) {
        ageField.addEventListener('input', function () {
            // Keep age strictly numeric and inside 1-100 while typing.
            let value = ageField.value.replace(/\D/g, '');
            if (value.length > 3) value = value.slice(0, 3);

            if (value === '0') {
                ageField.value = '';
                return;
            }

            if (value !== '' && Number(value) > 100) {
                value = '100';
            }

            ageField.value = value;
        });
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (isSubmitting) return;
        let isValid = true;

        fieldRules.forEach(function (rule) {
            const field = document.getElementById(rule.id);
            const ok = validateField(field, rule);
            if (!ok) isValid = false;
        });

        if (!isValid) {
            message.textContent = 'Please fix the highlighted fields.';
            message.style.color = '#c23636';
            return;
        }

        const payload = {};
        const formData = new FormData(form);
        formData.forEach(function (value, key) {
            payload[key] = typeof value === 'string' ? value.trim() : value;
        });
        payload.gmail = normalizeEmail(payload.gmail);
        payload.emergencyGmail = normalizeEmail(payload.emergencyGmail);
        payload.inquirySubmittedAt = new Date().toISOString();

        isSubmitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        message.textContent = 'Checking your booking status...';
        message.style.color = '#1d7b85';

        try {
            const hasDuplicate = await hasExistingBookingForEmail(payload.gmail);
            if (hasDuplicate) {
                message.innerHTML = 'If you already have a pending booking request, please <button id="duplicateSupportBtn" type="button" style="border:none;background:none;padding:0;margin:0;color:#1f8b94;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;">contact support</button> before submitting a new appointment request.';
                message.style.color = '#c23636';
                
                // Add event listener to the inline support button
                const duplicateSupportBtn = document.getElementById('duplicateSupportBtn');
                if (duplicateSupportBtn) {
                    duplicateSupportBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const modal = document.getElementById('contactSupportModal');
                        if (modal) {
                            modal.style.display = 'flex';
                            modal.setAttribute('aria-hidden', 'false');
                        }
                    });
                }
                return;
            }

            sessionStorage.setItem('raygainInquiryDraft', JSON.stringify(payload));
            await queueInquiryReceiptEmail(payload);
            window.location.href = 'booking.html';
        } catch (emailError) {
            console.error('Inquiry email failed:', emailError);
            message.textContent = `Inquiry saved but email failed: ${emailError && emailError.message ? emailError.message : 'Unknown error'}. Please try submit again.`;
            message.style.color = '#c23636';
        } finally {
            isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        }
    });
})();

// Contact Support Modal Handlers (Inquiry Page)
(function(){
    const modal = document.getElementById('contactSupportModal');
    const closeBtn = document.getElementById('closeContactSupportModal');
    const csCancel = document.getElementById('csCancelBtn');
    const form = document.getElementById('contactSupportForm');
    const submitBtn = document.getElementById('csSubmitBtn');
    const db = window.raygainDb || null;

    function openModal(){ if(modal){ modal.style.display='flex'; modal.setAttribute('aria-hidden','false'); }}
    function closeModal(){ if(modal){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }}

    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(csCancel) csCancel.addEventListener('click', closeModal);

    if(modal){
        modal.addEventListener('click', function(e){
            if(e.target === modal) closeModal();
        });
    }

    if(form){
        form.addEventListener('submit', async function(e){
            e.preventDefault();
            if(!db || typeof db.collection !== 'function'){
                alert('Support service currently unavailable.');
                return;
            }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            try{
                const payload = {
                    fullName: document.getElementById('csFullName').value.trim(),
                    email: document.getElementById('csEmail').value.trim(),
                    type: document.getElementById('csType').value,
                    message: document.getElementById('csMessage').value.trim(),
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                };
                await db.collection('supportRequests').add(payload);
                alert('Support request submitted. We will contact you shortly.');
                form.reset();
                closeModal();
            }catch(err){
                console.error(err);
                alert('Failed to submit request.');
            }finally{
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    }
})();
