/* =========================================================
DARK MODE TOGGLE (checkbox switch)
========================================================= */

const themeToggle = document.getElementById("theme-toggle");
const body = document.body;

// Load saved preference
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  body.classList.add("dark-theme");
  if (themeToggle) themeToggle.checked = true;
} else {
  if (themeToggle) themeToggle.checked = false;
}

// Toggle theme on change
if (themeToggle) {
  themeToggle.addEventListener("change", () => {
    if (themeToggle.checked) {
      body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  });
}


/* =========================================================
SMOOTH SCROLL OFFSET (Fix for Fixed Navbar)
========================================================= */

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#" || !href) return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();

    const navbarHeight = document.querySelector(".navbar").offsetHeight;
    const targetPos = target.getBoundingClientRect().top + window.scrollY;
    const offset = targetPos - navbarHeight + 5;

    window.scrollTo({
      top: offset,
      behavior: "smooth"
    });
  });
});


/* =========================================================
TYPEWRITER EFFECT FOR OBJECTIVE (word by word)
========================================================= */

(function () {
  const objectiveEl = document.getElementById("objective-text");
  if (!objectiveEl) return;

  const text = objectiveEl.dataset.text;
  if (!text) return;

  const words = text.split(" ");
  let index = 0;
  objectiveEl.textContent = "";

  const typingDelay = 150; // ms between words

  function typeNextWord() {
    if (index >= words.length) return;
    objectiveEl.textContent += (index > 0 ? " " : "") + words[index];
    index += 1;
    if (index < words.length) {
      setTimeout(typeNextWord, typingDelay);
    }
  }

  // Start typing shortly after page load
  setTimeout(typeNextWord, 600);
})();


/* =========================================================
SCROLL-TRIGGERED REVEAL ANIMATIONS
========================================================= */

(function () {
  const revealEls = document.querySelectorAll(".reveal, .project-card");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealEls.forEach(el => observer.observe(el));
  } else {
    // Fallback: show everything if IntersectionObserver is not supported
    revealEls.forEach(el => el.classList.add("visible"));
  }
})();