(() => {
 const script=document.createElement('script');
 if(location.protocol==='file:')script.src='js/app.bundle.js';
 else{script.type='module';script.src='js/app.js';}
 script.onerror=()=>{document.getElementById('load-error').textContent='The illustration could not load. Keep the app files together and reload this page.';};
 document.body.appendChild(script);
})();
