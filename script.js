document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Dark Mode Logic
  const toggleSwitch = document.querySelector('#theme-toggle');
  const body = document.body;
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme) {
    body.classList.add(currentTheme);
    if (currentTheme === 'dark-theme') {
      toggleSwitch.checked = true;
    }
  }

  toggleSwitch.addEventListener('change', function(e) {
    if (e.target.checked) {
      body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark-theme');
    } else {
      body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light-theme');
    }
  });

  // 2. Reveal on Scroll
  const reveals = document.querySelectorAll('.reveal');
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const elementVisible = 150;

    reveals.forEach((reveal) => {
      const elementTop = reveal.getBoundingClientRect().top;
      if (elementTop < windowHeight - elementVisible) {
        reveal.classList.add('visible');
      }
    });
  };
  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll(); // check on load

  // 3. Typewriter Effect
  const typeWriterElement = document.getElementById('objective-text');
  if (typeWriterElement) {
    const text = typeWriterElement.getAttribute('data-text');
    let i = 0;
    const speed = 30; // typing speed in ms

    function typeWriter() {
      if (i < text.length) {
        typeWriterElement.innerHTML += text.charAt(i);
        i++;
        setTimeout(typeWriter, speed);
      }
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          typeWriterElement.innerHTML = "";
          i = 0;
          typeWriter();
          observer.unobserve(entry.target);
        }
      });
    });
    observer.observe(typeWriterElement);
  }
});