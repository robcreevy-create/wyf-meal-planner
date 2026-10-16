async function loadPackedRecipes(){
  if(!window.DecompressionStream) throw new Error('This app needs an updated Safari browser.');
  const bytes=Uint8Array.from(atob(window.WYF_RECIPES_GZ),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
let recipes=[],plan=JSON.parse(localStorage.getItem('omp_plan')||'[]'),favs=new Set(JSON.parse(localStorage.getItem('omp_favs')||'[]')),settings=JSON.parse(localStorage.getItem('omp_settings')||'{}');
const $=id=>document.getElementById(id),clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').replace(/\b(irish|diced|dry|dried|fresh|sliced|baby|brown|grated|italian style|style|units|cloves|unit|clove)\b/g,'').replace(/\s+/g,' ').trim();
function icon(r){let t=r.title.toLowerCase();return /pasta|rigatoni|linguine|spaghetti|orzo|noodles/.test(t)?'🍝':/burger/.test(t)?'🍔':/curry|korma|jalfrezi|thai/.test(t)?'🍛':/taco|fajita|enchilada|tortilla|wrap|flatbread/.test(t)?'🌮':/stew|chilli|pie|stroganoff/.test(t)?'🥘':'🍽️'}

// Category labels are kept intact for the recipe detail view. For menu filtering,
// the first word determines whether a recipe belongs to Healthy, Mix or Comfort.
function categoryOf(r){
  const label=String(r.category||'').toLowerCase();
  return label.startsWith('healthy')?'Healthy':label.startsWith('comfort')?'Comfort':'Mix';
}
const meatLimit=n=>Number(n)>=5?3:2;
const selectedMeats=()=>[...document.querySelectorAll('.checks input:checked')].map(x=>x.value);
function updateMeatRule(){
  const n=Number($('numMeals').value), limit=meatLimit(n);
  const summary=$('meatRule');
  if(summary)summary.textContent=`Allowed meats (up to ${limit} different types in your ${n}-dinner plan)`;
  const hint=$('meatRuleHint');
  if(hint)hint.textContent=n>=5?'Five or more dinners can use up to three meat types.':'Three or four dinners use at most two meat types.';
}

// A future photo is added by mapping a recipe ID to a locally hosted image in
// recipe-images.js. Fallback food illustrations remain visible until then.
function dishMedia(r,large=false){
  const path=window.WYF_RECIPE_IMAGES?.[r.id];
  const safe=typeof path==='string' && /^images\/[a-z0-9_./-]+\.(?:webp|png|jpg|jpeg)$/i.test(path) && !path.includes('..');
  const photo=safe?`<img src="${clean(path)}" alt="Illustrative plated dish: ${clean(r.title)}" loading="lazy" decoding="async" onerror="this.remove()">`:'';
  return `<div class="dishpic${large?' dishpic-large':''}"><span class="dishfallback" aria-hidden="true">${icon(r)}</span>${photo}</div>`;
}
function save(){localStorage.setItem('omp_plan',JSON.stringify(plan));localStorage.setItem('omp_favs',JSON.stringify([...favs]));}
function tab(id){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));if(id==='shopping')shopping();if(id==='recipes')library();}
document.querySelectorAll('nav button').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
function eligible(){
  const meats=selectedMeats(),style=$('style').value,fish=$('excludeUnverified').checked;
  return recipes.filter(r=>r.meats.every(m=>meats.includes(m)) &&
    (!fish||!r.fishReview) &&
    (style!=='Healthy'||categoryOf(r)==='Healthy') &&
    (style!=='Comfort'||categoryOf(r)!=='Healthy'));
}
function tokens(r){return new Set(r.ingredients.map(x=>norm(x.name)).filter(x=>x.length>2&&!/water|salt|pepper|oil/.test(x)))}
function dishType(r){
  const t=r.title.toLowerCase();
  return /pasta|linguine|rigatoni|spaghetti|orzo|noodles/.test(t)?'pasta':
    /rice|bulgur|couscous|bowl/.test(t)?'grain':
    /curry|korma|jalfrezi/.test(t)?'curry':
    /burger|taco|enchilada|flatbread|tortilla/.test(t)?'bread':'other';
}
function score(r,selected,style='Mix',target=5){
  const shared=tokens(r);let overlap=0;
  selected.forEach(q=>tokens(q).forEach(k=>{if(shared.has(k))overlap++}));
  const variety=selected.some(q=>dishType(q)===dishType(r))?-8:7;
  const favourite=favs.has(r.id)?3:0;
  const category=categoryOf(r);
  let stylePoints=0;
  if(style==='Mix'){
    const healthy=selected.filter(q=>categoryOf(q)==='Healthy').length;
    const other=selected.length-healthy;
    const healthyGoal=Math.ceil(target/2);
    const otherGoal=target-healthyGoal;
    stylePoints=category==='Healthy'?(healthy<healthyGoal?7:-9):(other<otherGoal?7:-9);
  }else if(style==='Comfort'){
    stylePoints=category==='Comfort'?16:category==='Mix'?7:-12;
  }
  return overlap*1.6+variety+favourite+stylePoints+Math.random()*2;
}
function bestPool(pool,want,locked=[],style='Mix'){
  const picked=[...locked];
  let options=pool.filter(r=>!picked.some(q=>q.id===r.id));
  while(picked.length<want && options.length){
    const scored=options.map(r=>({r,s:score(r,picked,style,want)})).sort((a,b)=>b.s-a.s);
    picked.push(scored[0].r);
    options=options.filter(r=>r.id!==scored[0].r.id);
  }
  return picked;
}
function allowedSpeciesCombinations(types,limit){
  const sets=[];
  for(let mask=1;mask<(1<<types.length);mask++){
    const subset=types.filter((_,i)=>mask&(1<<i));
    if(subset.length<=limit)sets.push(new Set(subset));
  }
  return sets;
}
function generate(){
  const n=Number($('numMeals').value),kids=Number($('children').value),style=$('style').value;
  if(kids&&(!$('childInfo').value.trim()||Number($('childPortions').value)<=0)){
    alert('Please enter your children’s ages and combined portion amount first.');return;
  }
  const pool=eligible();
  if(pool.length<n){alert('Not enough matching recipes. Try selecting more meats or another style.');return;}
  // At most 2 meat species for 3–4 dinners, at most 3 for 5–7 dinners.
  // Beef-and-pork mixed mince counts as two species, not as one category.
  const types=[...new Set(pool.flatMap(r=>r.meats))];
  const options=[];
  for(const allowed of allowedSpeciesCombinations(types,meatLimit(n))){
    const candidates=pool.filter(r=>r.meats.every(m=>allowed.has(m)));
    if(candidates.length<n)continue;
    // Start with at least one recipe featuring each type in this group.
    // This avoids an all-chicken week when the user selected chicken and turkey
    // for variety, while still fitting shared purchases into the meat limit.
    const seeds=[];
    for(const species of allowed){
      if(seeds.some(r=>r.meats.includes(species)))continue;
      const choices=candidates.filter(r=>r.meats.includes(species)&&!seeds.some(q=>q.id===r.id))
        .map(r=>({r,points:score(r,seeds,style,n)}))
        .sort((a,b)=>b.points-a.points);
      if(choices.length)seeds.push(choices[0].r);
    }
    const candidate=bestPool(candidates,n,seeds,style);
    if(candidate.length!==n)continue;
    const used=new Set(candidate.flatMap(r=>r.meats));
    const measure=candidate.reduce((sum,r,i)=>sum+score(r,candidate.slice(0,i),style,n),0)
      +Math.min(used.size,meatLimit(n))*2;
    options.push({candidate,measure,used:used.size});
  }
  // Prefer at least two species when the couple has allowed multiple meats
  // and such a menu exists. A third species remains optional for larger weeks.
  const hasVariedOption=options.some(o=>o.used>=2);
  const workable=hasVariedOption?options.filter(o=>o.used>=2):options;
  workable.sort((a,b)=>b.measure-a.measure);
  if(!workable.length){alert(`Could not build ${n} dinners using at most ${meatLimit(n)} different meats. Try more eligible meats.`);return;}
  plan=workable[0].candidate.map(r=>r.id);
  settings={n,adults:Number($('adults').value),children:kids,childInfo:kids?$('childInfo').value:'',
    childPortions:kids?Number($('childPortions').value):0,style,preferredMeats:selectedMeats()};
  localStorage.setItem('omp_settings',JSON.stringify(settings));
  save();renderPlan();return true;
}
function getPlan(){return plan.map(id=>recipes.find(r=>r.id===id)).filter(Boolean)}
function renderPlan(){
  const meals=getPlan();
  const species=[...new Set(meals.flatMap(r=>r.meats))];
  const heading=`Your ${meals.length} dinners`;
  $('planOutput').innerHTML=meals.length
    ?`<div class="sectionhead"><h2>${heading}</h2><button onclick="generate()">↻ Regenerate</button></div>
      <div class="summary"><b>${clean(species.join(' + ')||'Vegetarian')}</b> · ${species.length}/${meatLimit(meals.length)} meat types · Ingredient overlap considered · Saved on this device</div>
      ${meals.map((r,i)=>`<article class="meal">${dishMedia(r)}<div class="content"><h3>${i+1}. ${clean(r.title)}</h3><p>${clean(r.minutes)} · ${clean(r.category)}</p><div class="actions"><button onclick="detail('${r.id}')">View recipe</button><button onclick="swap(${i})">↻ Swap</button><button onclick="toggleFav('${r.id}')">${favs.has(r.id)?'♥':'♡'}</button></div></div></article>`).join('')}
      <button class="primary wide" onclick="openExtras()">Next: Household extras & shopping list →</button>`
    :'<div class="panel"><p class="muted">Your meal plan will appear here once you generate it.</p></div>';
}
function swap(i){
  const old=getPlan();if(!old[i])return;
  const fixed=old.filter((_,index)=>index!==i);
  const existing=new Set(fixed.map(r=>r.id));
  const max=meatLimit(old.length);
  const currentSpecies=new Set(fixed.flatMap(r=>r.meats));
  const pool=eligible().filter(r=>
    r.id!==old[i].id && !existing.has(r.id) &&
    new Set([...currentSpecies,...r.meats]).size<=max
  );
  if(!pool.length){alert('No alternative meets your selected meats, meal style and meat limit. Try another style or more allowed meats.');return;}
  // A one-meal swap must never reshuffle or replace the other chosen dinners.
  const style=$('style').value;
  const ranked=pool.map(r=>({r,points:score(r,fixed,style,old.length)})).sort((a,b)=>b.points-a.points);
  plan[i]=ranked[0].r.id;
  save();renderPlan();
  if(!$('shopping').hidden)shopping();
}
function toggleFav(id){favs.has(id)?favs.delete(id):favs.add(id);save();renderPlan();library();}
function detail(id){
  const r=recipes.find(x=>x.id===id);if(!r)return;
  $('detailBody').innerHTML=`${dishMedia(r,true)}<h2>${clean(r.title)}</h2>
    <p class="muted">${clean(r.subtitle)} · ${clean(r.minutes)} · ${clean(r.meats.join(' + '))} · ${clean(r.category)}</p>
    <h3>Ingredients for 2 adults</h3><ul>${r.ingredients.map(x=>`<li>${clean(x.original)}</li>`).join('')}</ul>
    <h3>Cooking instructions</h3><ol>${r.steps.map(x=>`<li>${clean(x)}</li>`).join('')}</ol>
    ${r.notes.length?`<div class="note">${r.notes.map(clean).join('<p></p>')}</div>`:''}
    <p class="note">Cook poultry and minced meat through to 75°C. Recipe photographs are illustrative. Meals without photos show a food illustration until their image is added.</p>`;
  $('detail').showModal();
}
$('closeDetail').onclick=()=>$('detail').close();$('detail').onclick=e=>{if(e.target===$('detail'))$('detail').close()};
function library(){
  const term=$('search').value.toLowerCase(),cat=$('filterCategory').value,meat=$('filterMeat').value.toLowerCase();
  const matches=recipes.filter(r=>(r.title.toLowerCase().includes(term)||r.ingredients.some(x=>x.name.toLowerCase().includes(term)))
    &&(cat==='All styles'||categoryOf(r)===cat)
    &&(meat==='all meats'||r.meats.includes(meat)));
  $('recipeList').innerHTML=matches.map(r=>`<article class="recipe">${dishMedia(r)}
    <h3>${clean(r.title)}</h3><p>${clean(r.minutes)} · ${clean(r.meats.join(' + '))}</p>
    <span class="pill ${categoryOf(r).toLowerCase()}">${clean(r.category)}</span>
    <div class="actions"><button onclick="detail('${r.id}')">View</button><button onclick="toggleFav('${r.id}')">${favs.has(r.id)?'♥':'♡'}</button></div></article>`).join('')||'<p>No matching recipes.</p>';
}
// Do not combine different measurement systems, unspecified amounts, or different source-labelled ingredients.
function parseQty(q){q=q.replace(/\*\*/g,'').trim();let m=q.match(/^(\d+(?:\.\d+)?|½)\s*(g|ml|tsp|tbsp|cloves?|units?|x|sachets?|packs?|tins?|pot|cube)?(?:\b|$)/i);if(!m)return null;return {n:m[1]==='½'?.5:+m[1],unit:(m[2]||'unit').toLowerCase().replace(/s$/,'')};}
function shopping(){const p=getPlan();if(!p.length){$('shoppingOutput').innerHTML='<div class="panel">Generate a week first.</div>';return}let child=settings.children?+(settings.childPortions||0):0,factor=((settings.adults||2)+child)/2;let entries=new Map();p.forEach(r=>r.ingredients.forEach(x=>{let key=norm(x.name);let qty=parseQty(x.quantity);let cat=/chicken|beef|turkey|pork|chorizo|mince/.test(key)?'Meat':/onion|garlic|pepper|carrot|mushroom|spinach|potato|broccoli|lime|lemon|courgette|tomato|avocado|cucumber|parsley|coriander|leek|mint|ginger|scallion|bean|pea|salad/.test(key)?'Produce':/cheese|yoghurt|fraiche|milk|butter|egg/.test(key)?'Dairy & chilled':/rice|pasta|linguine|rigatoni|orzo|noodle|bulgur|tortilla|bread|couscous/.test(key)?'Grains & bread':'Pantry & sauces';let k=key+'|'+(qty?qty.unit:'original|'+x.quantity);if(!entries.has(k))entries.set(k,{name:x.name,unit:qty?.unit||'',count:0,unknown:[],cat});let e=entries.get(k);if(qty)e.count+=qty.n*factor;else e.unknown.push(x.quantity+(factor===1?'':` × ${factor.toFixed(2)} portions factor`));}));let groups={};[...entries.values()].forEach(e=>(groups[e.cat]??=[]).push(e));const id=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'-');$('shoppingOutput').innerHTML=`<div class="summary">${p.length} meals · ${settings.adults||2} adults${settings.children?` + ${settings.children} children (${clean(settings.childInfo)})`:''} · Scale × ${factor.toFixed(2)}<br><b>Important:</b> Pack and sachet weights in the source may be unknown. Shop for sufficient amounts and check your labels. Keep pantry staples such as oil, salt and pepper on hand.</div><div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="shareList()">Share / Copy list</button></div>${Object.entries(groups).map(([cat,items])=>`<div class="shopgroup"><h3>${clean(cat)}</h3>${items.sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{let k=id(e.name+e.unit),amount=e.unknown.length?e.unknown.join(' + '):`${Math.round(e.count*100)/100} ${e.unit==='unit'?'units':e.unit}`;return `<label class="shopitem"><input type="checkbox" data-shopping="${k}" ${localStorage.getItem('omp_tick_'+k)==='yes'?'checked':''} onchange="localStorage.setItem('omp_tick_'+this.dataset.shopping,this.checked?'yes':'no');this.parentNode.classList.toggle('done',this.checked)"><span>${clean(e.name)} · <b>${clean(amount)}</b></span></label>`}).join('')}</div>`).join('')}`;document.querySelectorAll('.shopitem input:checked').forEach(e=>e.parentNode.classList.add('done'));}
async function shareList(){let t=[...document.querySelectorAll('.shopgroup')].map(g=>g.querySelector('h3').textContent+'\n'+[...g.querySelectorAll('.shopitem span')].map(e=>'☐ '+e.textContent.trim()).join('\n')).join('\n\n');try{if(navigator.share)await navigator.share({title:'WYF shopping list',text:t});else{await navigator.clipboard.writeText(t);alert('Shopping list copied.')}}catch(e){if(e.name!=='AbortError')alert('Use Print / Save PDF instead.')}}
$('children').onchange=()=>{$('childDetails').hidden=Number($('children').value)===0};
$('numMeals').addEventListener('change',updateMeatRule);
$('generate').onclick=generate;
['search','filterCategory','filterMeat'].forEach(id=>$(id).addEventListener('input',library));
loadPackedRecipes().then(r=>{
  recipes=r;$('count').textContent=`${r.length} recipes`;
  for(const key of ['numMeals','adults','children','style'])if(settings[key]!==undefined)$(key).value=settings[key];
  if(settings.childInfo)$('childInfo').value=settings.childInfo;
  if(settings.childPortions)$('childPortions').value=settings.childPortions;
  // Preserve old accounts that have no saved preferred-meat list.
  if(Array.isArray(settings.preferredMeats))document.querySelectorAll('.checks input').forEach(x=>x.checked=settings.preferredMeats.includes(x.value));
  $('childDetails').hidden=!Number(settings.children||0);
  updateMeatRule();renderPlan();library();
}).catch(e=>{$('planOutput').textContent='Could not load recipes. Please use an updated Safari browser or reload the app.'});

// ------ WYF everyday shopping add-ons ------
// Stored locally on each phone. Meal ingredients are never altered by these additions.
const EXTRA_PRESETS = [
  { group: 'Food & drink', items: ['Milk', 'Bread', 'Cereal', 'Tea bags', 'Coffee', 'Eggs', 'Butter', 'Olive oil', 'Fruit', 'Snacks'] },
  { group: 'Home & bathroom', items: ['Toilet paper', 'Toothpaste', 'Shampoo', 'Shower gel', 'Hand soap', 'Kitchen roll', 'Washing-up liquid', 'Laundry detergent', 'Bin bags'] }
];
let householdExtras = readLocal('omp_extras', []);
let extrasReviewed = readLocal('omp_extras_reviewed', false);
let extrasHistory = readLocal('omp_extras_history', {});

function readLocal(key, fallback) {
  try { const stored = JSON.parse(localStorage.getItem(key)); return stored === null ? fallback : stored; }
  catch (_) { return fallback; }
}
function extraKey(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function findExtra(name) { return householdExtras.find(x => x.id === extraKey(name)); }
function presetGroup(name) {
  return EXTRA_PRESETS.find(x=>x.items.some(item=>extraKey(item)===extraKey(name)))?.group || 'Other extras';
}
function persistExtras() {
  localStorage.setItem('omp_extras', JSON.stringify(householdExtras));
  localStorage.setItem('omp_extras_reviewed', JSON.stringify(extrasReviewed));
  localStorage.setItem('omp_extras_history', JSON.stringify(extrasHistory));
}
function addHouseholdItem(rawName, group) {
  let name = String(rawName||'').trim().replace(/\s+/g, ' ').slice(0,100);
  if (!name || extraKey(name)==='') return;
  const id=extraKey(name);
  if (householdExtras.some(x=>x.id===id)) return;
  group=group||presetGroup(name);
  householdExtras.push({id,name,group,note:''});
  if (!extrasHistory[id]) extrasHistory[id]={name,group,count:0};
  extrasHistory[id].count+=1;
  persistExtras();
  renderHouseholdPicker();
}
function toggleHouseholdItem(name, group) {
  const id=extraKey(name);
  const i=householdExtras.findIndex(x=>x.id===id);
  if(i>=0) householdExtras.splice(i,1); else addHouseholdItem(name,group);
  persistExtras();
  renderHouseholdPicker();
}
function removeHouseholdItem(id) {
  householdExtras=householdExtras.filter(x=>x.id!==id);
  persistExtras();
  renderHouseholdPicker();
}
function renderHouseholdPicker() {
  const regulars = Object.values(extrasHistory).filter(x=>x?.name && x.count>0)
    .sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name)).slice(0,6);
  const groups=[];
  if(regulars.length) groups.push({group:'Your regulars',items:regulars.map(x=>x.name)});
  groups.push(...EXTRA_PRESETS);
  $('commonExtras').innerHTML=groups.map(g=>`<div class="extras-section"><h3>${clean(g.group)}</h3><div class="extra-chips">${g.items.map(name=>`<button type="button" class="extra-chip ${findExtra(name)?'selected':''}" data-extra="${encodeURIComponent(name)}" data-group="${encodeURIComponent(presetGroup(name))}" aria-pressed="${!!findExtra(name)}">${findExtra(name)?'✓ ': '+ '}${clean(name)}</button>`).join('')}</div></div>`).join('');
  $('commonExtras').querySelectorAll('[data-extra]').forEach(b=>b.addEventListener('click',()=>toggleHouseholdItem(decodeURIComponent(b.dataset.extra),decodeURIComponent(b.dataset.group))));
  $('extrasCount').textContent=householdExtras.length?`(${householdExtras.length})`:'';
  $('selectedExtras').innerHTML=householdExtras.length
    ?householdExtras.map(x=>`<div class="extra-selected-row"><span>${clean(x.name)}</span><input type="text" maxlength="100" value="${clean(x.note||'')}" placeholder="Amount, e.g. 2 L (optional)" aria-label="Quantity for ${clean(x.name)}" data-extra-note="${clean(x.id)}"><button type="button" class="remove-extra" aria-label="Remove ${clean(x.name)}" data-remove-extra="${clean(x.id)}">×</button></div>`).join('')
    :'<p class="muted">Nothing extra yet. That’s fine too!</p>';
  $('selectedExtras').querySelectorAll('[data-extra-note]').forEach(inp=>inp.addEventListener('input',()=>{
    let x=householdExtras.find(x=>x.id===inp.dataset.extraNote);
    if(x){x.note=inp.value;persistExtras();}
  }));
  $('selectedExtras').querySelectorAll('[data-remove-extra]').forEach(b=>b.addEventListener('click',()=>removeHouseholdItem(b.dataset.removeExtra)));
}
function openExtras() {
  if(!getPlan().length){tab('plan');return;}
  renderHouseholdPicker();
  if(!$('extrasDialog').open) $('extrasDialog').showModal();
}
function finishExtras(clear=false) {
  if(clear) householdExtras=[];
  extrasReviewed=true;
  persistExtras();
  $('extrasDialog').close();
  tab('shopping');
}
function addCustomExtras(e) {
  e.preventDefault();
  const input=$('customExtra'), value=input.value;
  value.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).forEach(name=>addHouseholdItem(name,'Other extras'));
  input.value=''; input.focus();
}
$('customExtraForm').addEventListener('submit',addCustomExtras);
$('closeExtras').onclick=()=>$('extrasDialog').close();
$('skipExtras').onclick=()=>finishExtras(true);
$('saveExtras').onclick=()=>finishExtras();

// Ask for household items as the last step of meal planning, including when
// the user goes straight to the Shopping tab. Swapping a meal retains extras.
const originalTab = tab;
tab = function(id) {
  if(id==='shopping' && getPlan().length && !extrasReviewed) { openExtras(); return; }
  return originalTab(id);
};
const originalGenerate = generate;
generate = function(){
  const succeeded = originalGenerate();
  if(succeeded === true){
    householdExtras=[];
    extrasReviewed=false;
    // A new week starts with an unticked checklist.
    Object.keys(localStorage).filter(k=>k.startsWith('omp_tick_')).forEach(k=>localStorage.removeItem(k));
    persistExtras();
  }
};
const originalShopping = shopping;
shopping = function() {
  originalShopping();
  if(!getPlan().length) return;
  let root=$('shoppingOutput');
  const toolbar=root.querySelector('.actions');
  if(toolbar) toolbar.insertAdjacentHTML('beforeend','<button id="editExtras">+ Edit everyday items</button>');
  $('editExtras').onclick=openExtras;
  const mealEntries=[...root.querySelectorAll('.shopgroup .shopitem')].map(row=>({row,name:row.querySelector('span')?.textContent.split('·')[0].trim().toLowerCase()}));
  const more=[];
  householdExtras.forEach(x=>{
    // Meal ingredient with same name: one checked line, but show the extra note.
    const matched=mealEntries.find(m=>extraKey(m.name)===extraKey(x.name));
    if(matched){
      const span=matched.row.querySelector('span');
      const addition=x.note?` + household: ${x.note}`:' + household extra';
      span.append(document.createTextNode(addition));
    }else more.push(x);
  });
  if(!more.length) {if(!householdExtras.length) root.insertAdjacentHTML('beforeend','<p class="muted">No extra household items selected. Tap “Edit everyday items” to add something later.</p>');return;}
  for(const category of ['Food & drink','Home & bathroom','Other extras']){
    const items=more.filter(x=>x.group===category);
    if(!items.length)continue;
    let html=`<div class="shopgroup extra-shopgroup"><h3>${clean(category)} · additional items</h3>${items.map(x=>{
      const id='extra-'+x.id, ticked=localStorage.getItem('omp_tick_'+id)==='yes';
      return `<label class="shopitem ${ticked?'done':''}"><input type="checkbox" data-shopping="${id}" ${ticked?'checked':''}><span>${clean(x.name)}${x.note?' · <b>'+clean(x.note)+'</b>':''}</span></label>`;
    }).join('')}</div>`;
    root.insertAdjacentHTML('beforeend',html);
  }
  root.querySelectorAll('.extra-shopgroup input[data-shopping]').forEach(inp=>inp.addEventListener('change',()=>{
    localStorage.setItem('omp_tick_'+inp.dataset.shopping,inp.checked?'yes':'no');
    inp.closest('.shopitem').classList.toggle('done',inp.checked);
  }));
};
// Keep original sharing implementation (it reads all .shopgroup blocks, so it
// automatically includes additional items). Only update the shared title.
const originalShareList = shareList;
shareList = async function() {
  const groups=[...document.querySelectorAll('#shoppingOutput .shopgroup')];
  const text=groups.map(g=>g.querySelector('h3').textContent+'\n'+[...g.querySelectorAll('.shopitem span')].map(s=>'☐ '+s.textContent.trim()).join('\n')).join('\n\n');
  try {
    if(navigator.share) await navigator.share({title:'WYF shopping list',text});
    else {await navigator.clipboard.writeText(text);alert('Shopping list copied.');}
  } catch(e) { if(e.name!=='AbortError') alert('Use Print / Save PDF instead.'); }
};
