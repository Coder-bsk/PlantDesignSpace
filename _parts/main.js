const sl=[...document.querySelectorAll('#car svg')],dt=[...document.querySelectorAll('.dots i')],T=[['Piping route','Aveva E3D','3D model'],['General arrangement','Aveva E3D Draw','2D drawing'],['Connected data','Digital twin','Live asset model']];let n=0;
setInterval(()=>{sl[n].classList.remove('on');dt[n].classList.remove('on');n=(n+1)%3;sl[n].classList.add('on');dt[n].classList.add('on');$('#ct').textContent=T[n][0];$('#cs').textContent=T[n][1];$('#co').textContent=T[n][2]},4000);
$('#ef').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),m=$('#em');
 try{m.className='msg';m.textContent='Sending…';await send({name:f.name,email:f.email,subject:'Enquiry from website',message:f.message+(f.phone?'\nPhone: '+f.phone:'')});
 m.className='msg ok';m.textContent='Thanks '+f.name+'. We sent a confirmation to '+f.email+'.';e.target.reset()}catch(x){m.className='msg er';m.textContent='Could not send. Email us at '+CFG.email}};
