// Smooth scroll to projects section
const scrollToProjectsBtn = document.getElementById('scrollToProjects');
if (scrollToProjectsBtn) {
    scrollToProjectsBtn.addEventListener('click', () => {
        document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
    });
}

// Project details modal logic
const projectDetails = {
    project1: {
        title: 'Project One',
        description: 'Detailed info about Project One. You can add links, images, or more here.'
    },
    project2: {
        title: 'Project Two',
        description: 'Detailed info about Project Two. You can add links, images, or more here.'
    },
    project3: {
        title: 'Project Three',
        description: 'Detailed info about Project Three. You can add links, images, or more here.'
    }
};
function showProjectDetails(projectKey) {
    const modal = document.getElementById('projectDetails');
    const content = document.getElementById('projectDetailsContent');
    if (projectDetails[projectKey]) {
        content.innerHTML = `<h3>${projectDetails[projectKey].title}</h3><p>${projectDetails[projectKey].description}</p>`;
        modal.classList.remove('hidden');
    }
}
const closeModalBtn = document.getElementById('closeModal');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        document.getElementById('projectDetails').classList.add('hidden');
    });
}
window.onclick = function(event) {
    const modal = document.getElementById('projectDetails');
    if (event.target === modal) {
        modal.classList.add('hidden');
    }
};

// Contact form logic
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        document.getElementById('formMessage').textContent = 'Thank you for your message! (Demo only)';
        contactForm.reset();
    });
}
