// Therapist login logic (no Firebase, just passcode check)
const therapistLoginForm = document.getElementById('therapistLoginForm');
const passcodeErrorModal = document.getElementById('passcodeErrorModal');
const closePasscodeError = document.getElementById('closePasscodeError');
const AUTH_SESSION_KEY = 'raygainTherapistAuth';

try {
    if (sessionStorage.getItem(AUTH_SESSION_KEY) === '1') {
        window.location.replace('therapist-dashboard.html');
    }
} catch (error) {
    // Ignore storage errors in restricted contexts.
}

therapistLoginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const passcode = therapistLoginForm.elements['therapistPasscode'].value;
    if (passcode === 'BARBEQUE') {
        try {
            sessionStorage.setItem(AUTH_SESSION_KEY, '1');
            sessionStorage.setItem('raygainTherapistLoginAt', new Date().toISOString());
        } catch (error) {
            // Ignore storage errors and continue redirect.
        }
        window.location.replace('therapist-dashboard.html');
    } else {
        passcodeErrorModal.style.display = 'flex';
    }
});

closePasscodeError.addEventListener('click', function() {
    passcodeErrorModal.style.display = 'none';
    therapistLoginForm.reset();
});
