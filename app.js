// Use global db from Firebase CDN

// Modal logic for inquiry form
const inquireBtn = document.getElementById('inquireBtn');
const modal = document.getElementById('inquiryFormModal');
const closeModal = document.getElementById('closeModal');
const inquiryForm = document.getElementById('inquiryForm');

inquireBtn.onclick = function() {
    modal.style.display = 'flex';
};
closeModal.onclick = function() {
    modal.style.display = 'none';
};
window.onclick = function(event) {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

inquiryForm.onsubmit = async function(e) {
    e.preventDefault();

    const formData = {
        firstName: inquiryForm.firstName.value,
        middleName: inquiryForm.middleName.value,
        lastName: inquiryForm.lastName.value,
        contactNumber: inquiryForm.contactNumber.value,
        email: inquiryForm.email.value,
        address: inquiryForm.address.value,
        dob: inquiryForm.dob.value,
        caseHistory: inquiryForm.caseHistory.value,
        emergencyContact: {
            firstName: inquiryForm.emergencyFirstName.value,
            lastName: inquiryForm.emergencyLastName.value,
            email: inquiryForm.emergencyEmail.value,
            contactNumber: inquiryForm.emergencyContactNumber.value,
            relation: inquiryForm.emergencyRelation.value
        }
    };

    try {
        await db.collection('inquiries').add(formData);
        alert('Thank you for submitting! You will be getting a text from our admin. Stay in touch.');
        modal.style.display = 'none';
        inquiryForm.reset();
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        alert('Failed to submit inquiry. Please try again.');
    }
};
