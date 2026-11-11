(function () {
  const pages = [
    ['index.html', 'Home'],
    ['explore.html', 'Explore'],
    ['business.html', 'List Your Business'],
    ['about.html', 'About Us'],
    ['contact.html', 'Contact Us']
  ];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const header = document.querySelector('header.site-header');
  const footer = document.querySelector('footer.footer');

  if (header) {
    const navigation = pages.map(([href, label]) => {
      const current = currentPage === href;
      return `<a href="${href}"${current ? ' class="active" aria-current="page"' : ''}>${label}</a>`;
    }).join('');
    header.innerHTML = `
      <a href="index.html" class="logo site-brand" aria-label="BISA home">
        <img src="assets/bisa-logo-mark.png" alt="">
        <span>BISA<span class="brand-dot">.</span></span>
      </a>
      <nav class="main-nav" aria-label="Main navigation">${navigation}</nav>`;
  }

  if (footer) {
    footer.innerHTML = `
      <a href="admin-login.html" class="footer-logo" aria-label="BISA">
        <img src="assets/bisa-logo-full.png" alt="BISA — Let's do business and share ideas">
      </a>
      <p>Find What You Need. Connect with Student Businesses.</p>
      <nav class="footer-nav" aria-label="Footer navigation">
        <a href="explore.html">Explore</a>
        <a href="business.html">List Your Business</a>
        <a href="about.html">About Us</a>
        <a href="contact.html">Contact Us</a>
      </nav>
      <div class="footer-meta">
        <p class="copyright">&copy; ${new Date().getFullYear()} BISA. All rights reserved.</p>
      </div>`;
  }
})();
