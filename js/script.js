
    // Select all navigation links
    const navLinks = document.querySelectorAll('.nav ul li a');
    // Select the menu icon checkbox
    const menuIcon = document.getElementById('menu-icon');

    // Add a click event listener to each navigation link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Uncheck the menu icon checkbox to close the menu
            menuIcon.checked = false;
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('theme-toggle');
        const body = document.body;
    
        toggle.addEventListener('change', () => {
            body.classList.toggle('dark-mode');
        });
    
        // Check for saved theme preference
        if (localStorage.getItem('theme') === 'dark') {
            body.classList.add('dark-mode');
            toggle.checked = true;
        }
    
        body.addEventListener('classChange', () => {
            localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    });
    
    