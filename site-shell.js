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
      <a href="index.html" class="logo" aria-label="BISA home">BISA<span>.</span></a>
      <nav class="main-nav" aria-label="Main navigation">${navigation}</nav>`;
  }

  if (footer) {
    footer.innerHTML = `
      <a href="index.html" class="logo footer-logo" aria-label="BISA home">BISA<span>.</span></a>
      <p>Find What You Need. Connect with Student Businesses.</p>
      <nav class="footer-nav" aria-label="Footer navigation">
        <a href="explore.html">Explore</a>
        <a href="business.html">List Your Business</a>
        <a href="about.html">About Us</a>
        <a href="contact.html">Contact Us</a>
      </nav>
      <div class="footer-meta">
        <p class="copyright">&copy; ${new Date().getFullYear()} BISA. All rights reserved.</p>
        <a href="${currentPage === 'admin.html' ? 'admin.html' : 'admin-login.html'}" class="admin-link">${currentPage === 'admin.html' ? 'Admin dashboard' : 'Admin portal'}</a>
      </div>`;
  }
})();
