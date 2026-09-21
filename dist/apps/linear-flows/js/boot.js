// Local files cannot import ES modules in Safari. Use the packaged classic script.
(() => {
 const script=document.createElement('script');
 if(location.protocol==='file:')script.src='js/app.bundle.js';
 else{script.type='module';script.src='js/app.js';}
 script.onerror=()=>{
  document.getElementById('placement-status').textContent='The app could not load. Keep the app files together in the same folder, then reload the page.';
 };
 document.body.appendChild(script);
})();
