(() => {
  if (!document.body) return null;
  const cache = window.__jevFast ||= {ids:new WeakMap(), nodes:new Map(), next:1};
  const identity = e => {
    if (!cache.ids.has(e)) cache.ids.set(e,cache.next++);
    const id=cache.ids.get(e); cache.nodes.set(id,e); return id;
  };
  for (const [id,e] of cache.nodes) if (!e.isConnected) cache.nodes.delete(id);
  const safe = e => !['password','file','hidden'].includes(e.type);
  // Faundr: senha aparece como alvo, mas o valor nunca sai da página.
  const offered = e => !['file','hidden'].includes(e.type);
  const visible = e => !e.closest('[aria-hidden="true"],[inert]') &&
    e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
  const name = (e,seen=new Set()) => {
    if (!e || seen.has(e)) return '';
    seen.add(e);
    const referenced=(e.getAttribute('aria-labelledby')||'').split(/\s+/)
      .map(id=>name(document.getElementById(id),seen)).filter(Boolean).join(' ');
    return referenced || e.getAttribute('aria-label') ||
      [...(e.labels||[])].map(l=>name(l,seen)).filter(Boolean).join(' ') ||
      (['button','submit','reset'].includes(e.type) ? e.value : '') || e.getAttribute('alt') ||
      (e.tagName==='INPUT' ? '' : [...e.childNodes].map(n=>childName(n,seen)).join(' ').trim()) ||
      e.getAttribute('title') || e.getAttribute('placeholder') || '';
  };
  // Nome de um filho: texto direto, ou o nome do elemento (se não estiver escondido do leitor de tela).
  const childName = (n,seen) => {
    if (n.nodeType===3) return n.textContent;
    return n.nodeType===1 && n.getAttribute('aria-hidden')!=='true' ? name(n,seen) : '';
  };
  const roles=['button','link','checkbox','radio','switch','tab','menuitem','menuitemradio',
    'option','gridcell','combobox','textbox','searchbox','spinbutton'];
  const selector='a[href],button,input,textarea,select,summary,[contenteditable="true"],'+
    roles.map(role=>'[role="'+role+'"]').join(',');
  const role = e => {
    const explicit=e.getAttribute('role');
    if (roles.includes(explicit)) return explicit;
    if (e.tagName==='BUTTON' || e.tagName==='SUMMARY') return 'button';
    if (e.tagName==='A') return 'link';
    if (e.tagName==='SELECT') return 'combobox';
    if (e.tagName==='TEXTAREA' || e.isContentEditable) return 'textbox';
    if (e.tagName==='INPUT') {
      if (['checkbox','radio'].includes(e.type)) return e.type;
      if (['button','submit','reset','image'].includes(e.type)) return 'button';
      if (e.type==='search') return 'searchbox';
      if (e.type==='number') return 'spinbutton';
      if (['text','email','url','tel','password'].includes(e.type)) return 'textbox';
    }
    return null;
  };
  cache.pageKey=()=>[performance.timeOrigin,location.href,scrollX,scrollY,innerWidth,innerHeight,
    [...document.querySelectorAll('input,textarea,select')].filter(safe)
      .map(e=>[identity(e),e.value,e.checked,e.selectedIndex,e.disabled,e.readOnly])];
  cache.guard=e=>{
    if (!e?.isConnected || !visible(e)) return null;
    const scope=e.closest('form,dialog,[role="dialog"],article,li,tr,[role="row"]') || e.parentElement;
    return [identity(e),role(e),name(e),e.value??null,e.checked??null,e.selectedIndex??null,
      e.readOnly??null,e.matches(':disabled'),e.getAttribute('aria-disabled'),
      e.getAttribute('aria-expanded'),e.getAttribute('aria-checked'),e.getAttribute('aria-selected'),
      e.getAttribute('href'),scope?.innerText?.slice(0,6000)||''];
  };
  const actions=[];
  const blocked = e => !offered(e) || !visible(e) || e.matches(':disabled') || e.closest('[aria-disabled="true"]');
  const offScreen = (r,x,y) => r.width<=0 || r.height<=0 || x<0 || y<0 || x>=innerWidth || y>=innerHeight;
  // Valor atual do campo (senha só diz se está preenchida).
  const currentValue = (e,rname) => {
    if (e.type==='password') return e.value ? '(filled, hidden)' : '';
    if ('value' in e) return String(e.value);
    return e.isContentEditable || rname==='combobox' ? e.innerText.trim() : '';
  };
  // <select>: uma ação por opção que dá para escolher.
  const addSelectActions = (e,base) => {
    for (const o of e.options) if (!o.selected && !o.disabled && !o.closest('optgroup[disabled]'))
      actions.push({...base,kind:'select',value:o.value,
        current_value:[...e.selectedOptions].map(o=>o.label).join(', '),label:base.label+' → '+o.label});
  };
  // Campo editável vira 'fill' (e um 'click' para abrir); o resto vira 'click'.
  const addFieldActions = (e,base,rname) => {
    const editable=!e.readOnly && e.getAttribute('aria-readonly')!=='true' &&
      (['textbox','searchbox','spinbutton'].includes(rname) ||
        (rname==='combobox' && ['INPUT','TEXTAREA'].includes(e.tagName)));
    const value=currentValue(e,rname);
    actions.push({...base,kind:editable?'fill':'click',value});
    if (editable) actions.push({...base,kind:'click',value,label:'Open '+base.label});
  };
  const addActions = e => {
    if (blocked(e)) return;
    const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2, rname=role(e);
    if (!rname || offScreen(r,x,y)) return;
    if (rname==='gridcell' && e.querySelector('button,[role="button"]')) return;
    const base={node:identity(e),role:rname,label:name(e)||rname,
      rect:{x:r.x,y:r.y,w:r.width,h:r.height}};
    for (const key of ['checked','selected','expanded']) {
      const value=e.getAttribute('aria-'+key);
      if (value!==null) base[key]=value;
    }
    if (['checkbox','radio'].includes(e.type)) base.checked=String(e.checked);
    if (e.tagName==='SELECT') addSelectActions(e,base);
    else addFieldActions(e,base,rname);
  };
  for (const e of document.querySelectorAll(selector)) addActions(e);
  // Texto visível na tela (até 6000 caracteres).
  const visibleWords = () => {
    const words=[], walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const range=document.createRange(); let node,length=0;
    while ((node=walker.nextNode()) && length<6000) {
      const value=node.textContent.trim(), parent=node.parentElement;
      if (!value || !parent || parent.closest('script,style,noscript,template') || !visible(parent)) continue;
      range.selectNodeContents(node); const r=range.getBoundingClientRect();
      if (r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth) {
        words.push(value); length+=value.length;
      }
    }
    return words;
  };
  const text=visibleWords().join('\n').slice(0,6000), height=document.documentElement.scrollHeight;
  const page_key=cache.pageKey(), guards={};
  for (const a of actions) if (!(a.node in guards)) guards[a.node]=cache.guard(cache.nodes.get(a.node));
  // Compare meaning and identity. Geometry is always resolved and hit-tested just before input.
  const semantics=actions.map(({rect,...action})=>action);
  const marker=[performance.timeOrigin,location.href,scrollX,scrollY,innerWidth,innerHeight,
    document.title,text,semantics,page_key[6]];
  const omitted_actions=Math.max(0,actions.length-250);
  actions.splice(250);
  actions.forEach((a,i)=>a.id='e'+(i+1));
  if (scrollY+innerHeight<height-2) actions.push({id:'scroll_down',kind:'scroll',label:'Scroll down',delta:560});
  if (scrollY>0) actions.push({id:'scroll_up',kind:'scroll',label:'Scroll up',delta:-560});
  actions.push({id:'wait',kind:'wait',label:'Wait for the page to update'});
  return {url:location.href,title:document.title,w:innerWidth,h:innerHeight,text,
    scroll:{y:scrollY,height},actions,marker,page_key,guards,omitted_actions};
})()
