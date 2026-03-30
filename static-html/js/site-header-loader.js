// js/site-header-loader.js
(async function(){
  const mount = document.getElementById('site-header');
  if(!mount) return;
  const res = await fetch('/partials/header.html', { cache: 'no-cache' });
  mount.outerHTML = await res.text();
})();
