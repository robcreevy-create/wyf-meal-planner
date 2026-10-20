// WYF v1.5.4. Clear Monday-only date selector and compact household form.
const WYF_VERSION = '1.5.4';
async function loadPackedRecipes(){
  if(!Array.isArray(window.WYF_RECIPES)) throw new Error('Recipe data is missing.');
  return window.WYF_RECIPES;
}
let recipes=[],plan=readLocal('omp_plan',[]),favs=new Set(Array.isArray(readLocal('omp_favs',[]))?readLocal('omp_favs',[]):[]),settings=readLocal('omp_settings',{});
let recipeVariants=readLocal('wyf_recipe_variants',{});
if(!Array.isArray(plan))plan=[];
if(!settings||typeof settings!=='object'||Array.isArray(settings))settings={};
if(!recipeVariants||typeof recipeVariants!=='object'||Array.isArray(recipeVariants))recipeVariants={};
function resolveRecipe(base){ return base; }

const $=id=>document.getElementById(id),clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').replace(/\b(irish|diced|dry|dried|fresh|sliced|baby|brown|grated|italian style|style|units|cloves|unit|clove)\b/g,'').replace(/\s+/g,' ').trim();

// Plan start dates use local calendar parts at midday, avoiding UTC/DST drift.
function localDateISO(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function parseLocalDate(iso){
  if(typeof iso!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
  const [y,m,d]=iso.split('-').map(Number),x=new Date(y,m-1,d,12);
  return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null;
}
function validWeekStart(iso){const d=parseLocalDate(iso);return !!d&&d.getDay()===1;}
function upcomingWeekStart(today=new Date()){
  const d=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  d.setDate(d.getDate()+(8-d.getDay())%7);
  return localDateISO(d);
}
function mondayOnOrBefore(date){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
  d.setDate(d.getDate()-(d.getDay()+6)%7);return localDateISO(d);
}
// On a new planning visit, don't leave the picker silently stuck on an old
// Monday. Keep upcoming choices and still-unlocked current-week drafts.
function suggestedWeekStart(remembered,today=new Date(),alreadyLocked=false){
  const upcoming=upcomingWeekStart(today),current=mondayOnOrBefore(today);
  if(!validWeekStart(remembered)||remembered<current)return upcoming;
  if(today.getDay()===0 && remembered===current && alreadyLocked)return upcoming;
  return remembered;
}
function weekLabel(iso){
  const d=parseLocalDate(iso);
  return d?d.toLocaleDateString('en-IE',{day:'numeric',month:'long',year:'numeric'}):'';
}
function historicalWeekStart(w){
  if(validWeekStart(w?.weekStart))return w.weekStart;
  // Older WYF files kept only a human-readable '19 October 2026' label.
  const text=String(w?.weekOf||'');
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const m=text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/),n=m?months.indexOf(m[2].toLowerCase()):-1;
  if(m&&n>=0){const d=parseLocalDate(`${m[3]}-${String(n+1).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`);if(d)return mondayOnOrBefore(d);}
  const created=new Date(w?.createdAt);
  return Number.isFinite(created.getTime())?mondayOnOrBefore(created):null;
}
// The interface offers Mondays only, using the same compact select control as other fields.
// Include the current and surrounding weeks, and honour a previously selected Monday
// even if it falls outside the usual choices. Values remain YYYY-MM-DD for saved data.
function populateWeekMondayOptions(today=new Date()){
  const picker=$('weekStart');if(!picker)return;
  const monday=parseLocalDate(mondayOnOrBefore(today));
  const choices=[];
  for(let n=-2;n<=20;n++){
    const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+n*7,12);
    choices.push(localDateISO(d));
  }
  if(validWeekStart(settings.planWeekStart)&&!choices.includes(settings.planWeekStart))choices.push(settings.planWeekStart);
  choices.sort();
  picker.innerHTML=choices.map(iso=>{
    const d=parseLocalDate(iso);
    const shortDate=d.toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'});
    return `<option value="${iso}">Monday ${shortDate}</option>`;
  }).join('');
}
function selectedWeekStart(){return $('weekStart')?.value||settings.planWeekStart||upcomingWeekStart();}
function validateSelectedWeek(){
  const day=selectedWeekStart();
  if(validWeekStart(day))return day;
  alert('Choose a valid Monday for the week you want to plan.');
  $('weekStart')?.focus();return null;
}
function savePlanWeekChoice(){
  const iso=$('weekStart').value;
  if(!validWeekStart(iso)){
    $('weekStartWarning').hidden=false;return;
  }
  $('weekStartWarning').hidden=true;
  settings={...settings,planWeekStart:iso};
  try{localStorage.setItem('omp_settings',JSON.stringify(settings));}catch(_){alert('Could not save the week date. Please check device storage.');}
  renderPlan();
}

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
  if(hint)hint.textContent=`Tick every meat you are happy to eat. WYF uses no more than ${limit} species in the finished plan; you can still tick all four.`;
}

// Original, user-approved AI-generated illustrations, keyed by recipe ID, never by recipe order.
// Keep an emoji fallback if a file is missing, slow or blocked by browser caches.
function dishMedia(r,large=false,action=''){
  const src=(window.WYF_RECIPE_IMAGES || {})[r.id];
  const fallback=`<span class="dishfallback" aria-hidden="true">${icon(r)}</span>`;
  const image=src ? `<img src="${clean(src)}" loading="${large?'eager':'lazy'}" decoding="async" alt="${large?`Illustrative photo of ${clean(r.title)}`:''}" onerror="this.remove()">` : '';
  const content=fallback+image;
  return large ? `<div class="dishpic dishpic-large">${content}</div>` :
    `<button type="button" class="dishpic dish-open" aria-label="Open ${clean(r.title)}" onclick="${action||`detail('${r.id}')`}">${content}</button>`;
}
const titleFirst=s=>{s=String(s??'').trim();return s?s.charAt(0).toLocaleUpperCase('en-IE')+s.slice(1):s;};
const roundAmount=n=>Math.round((n+Number.EPSILON)*100)/100;
function formatNumber(n){return Number.isFinite(n)?String(roundAmount(n)):'0';}
function formatUnit(n,u){
  const words={unit:['item','items'],clove:['clove','cloves'],cube:['cube','cubes']};
  return words[u]?words[u][n===1?0:1]:u;
}
function householdFactor(s=settings){return ((Number(s.adults)||2)+(Number(s.children)>0?Number(s.childPortions||0):0))/2;}
function householdLabel(s=settings){
  const a=Number(s.adults)||2,c=Number(s.children)||0;
  return `${a} adult${a===1?'':'s'}${c?` + ${c} child${c===1?'':'ren'}`:''}`;
}
function portionTotal(s=settings){return formatNumber(householdFactor(s)*2);}
let childProfiles=[];
let householdIsValid=true;
let householdLoaded=false;
function readHouseholdForm(){
  const adults=Number($('adults').value),children=Number($('children').value);
  const selected=childProfiles.slice(0,children);
  const valid=adults>=1&&children>=0&&selected.length===children&&selected.every(c=>
    c.age!==''&&c.age!=null&&[0.25,0.5,0.75,1].includes(Number(c.portion)));
  return {valid,adults,children,childProfiles:deepCopy(selected),
    childPortions:valid?selected.reduce((n,c)=>n+Number(c.portion),0):0,
    childInfo:selected.map((c,i)=>`Child ${i+1}: ${c.age==='under1'?'under 1':c.age+' years'}, ${c.portion||'?'} adult portion`).join('; ')};
}
function renderChildDropdowns(){
  const count=Number($('children').value);
  while(childProfiles.length<count)childProfiles.push({age:'',portion:''});
  // Do not discard hidden children's choices; changing the count back restores them.
  $('childDetails').hidden=count===0;
  $('childRows').innerHTML=childProfiles.slice(0,count).map((c,i)=>`<fieldset class="child-card"><legend>Child ${i+1}</legend><div class="formgrid">
    <label for="child-age-${i}">Age<select id="child-age-${i}" data-child-age="${i}"><option value="">Choose age</option><option value="under1" ${c.age==='under1'?'selected':''}>Under 1</option>${Array.from({length:17},(_,n)=>n+1).map(age=>`<option value="${age}" ${String(c.age)===String(age)?'selected':''}>${age} year${age===1?'':'s'}</option>`).join('')}<option value="18+" ${c.age==='18+'?'selected':''}>18+</option></select></label>
    <label for="child-size-${i}">Usual portion<select id="child-size-${i}" data-child-portion="${i}"><option value="">Choose portion</option>${[[.25,'Small · ¼'],[.5,'Medium · ½'],[.75,'Large · ¾'],[1,'Full portion']].map(([v,t])=>`<option value="${v}" ${String(c.portion)===String(v)?'selected':''}>${t}</option>`).join('')}</select></label>
    </div></fieldset>`).join('');
  $('childRows').querySelectorAll('[data-child-age]').forEach(el=>el.onchange=()=>{childProfiles[Number(el.dataset.childAge)].age=el.value;updateHousehold();});
  $('childRows').querySelectorAll('[data-child-portion]').forEach(el=>el.onchange=()=>{childProfiles[Number(el.dataset.childPortion)].portion=el.value;updateHousehold();});
}
function clearRecipeTicks(){Object.keys(localStorage).filter(k=>k.startsWith('omp_tick_')&&!k.startsWith('omp_tick_extra-')).forEach(k=>localStorage.removeItem(k));}
function updateHousehold(persist=true){
  const h=readHouseholdForm();householdIsValid=h.valid;
  $('householdError').hidden=h.valid;
  if(!h.valid){
    if(householdLoaded&&!$('shopping').hidden)shopping();
    return;
  }
  const oldSignature=JSON.stringify([settings.adults,settings.children,settings.childProfiles,settings.childPortions]);
  const updated={...settings,adults:h.adults,children:h.children,childProfiles:h.childProfiles,childPortions:h.childPortions,childInfo:h.childInfo,householdSchema:2};
  if(oldSignature!==JSON.stringify([updated.adults,updated.children,updated.childProfiles,updated.childPortions])){
    settings=updated;
    if(persist){localStorage.setItem('omp_settings',JSON.stringify(settings));clearRecipeTicks();}
  }
  if(householdLoaded){renderPlan();if(!$('shopping').hidden)shopping();}
}
function requireHousehold(){
  if(readHouseholdForm().valid)return true;
  originalTab('plan');$('childDetails').scrollIntoView({block:'center'});$('householdError').hidden=false;
  const missing=$('childRows').querySelector('select:has(option[value=""]:checked)');if(missing)missing.focus();
  alert('Choose each child’s age and usual portion first. The app calculates the total for you.');return false;
}

function save(){localStorage.setItem('omp_plan',JSON.stringify(plan));localStorage.setItem('omp_favs',JSON.stringify([...favs]));}
function tab(id){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));if(id==='shopping')shopping();if(id==='recipes')library();}
document.querySelectorAll('nav button').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
function eligible(){
  const meats=selectedMeats(),style=$('style').value,fish=$('excludeUnverified').checked;
  return recipes.map(resolveRecipe).filter(r=>!r.reviewRequired && r.meats.every(m=>meats.includes(m)) &&
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
  const chosenMonday=validateSelectedWeek();if(!chosenMonday)return;
  const n=Number($('numMeals').value),kids=Number($('children').value),style=$('style').value;
  if(![3,4,5,6,7].includes(n)){alert('Choose between 3 and 7 dinners.');return;}
  if(!requireHousehold())return;
  updateHousehold();
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
  settings={...settings,n,numMeals:n,style,planWeekStart:chosenMonday,preferredMeats:selectedMeats(),excludeFishReview:$('excludeUnverified').checked,planMode:'generated'};
  localStorage.setItem('omp_settings',JSON.stringify(settings));
  save();renderPlan();return true;
}
function getPlan(){return plan.map(id=>recipes.find(r=>r.id===id)).filter(Boolean).map(resolveRecipe)}
function renderPlan(){
  const meals=getPlan();
  const manual=settings.planMode==='manual';
  const species=[...new Set(meals.flatMap(r=>r.meats))];
  const heading=`Your ${meals.length} dinners`;
  const summary=manual
    ?`<b>Hand-picked week</b> · ${clean(householdLabel())} · Week of ${clean(weekLabel(selectedWeekStart()))} · No meat limits or overlap rules · Draft on this device`
    :`<b>${clean(species.join(' + ')||'Vegetarian')}</b> · ${species.length}/${meatLimit(meals.length)} meat types · ${clean(householdLabel())} · Week of ${clean(weekLabel(selectedWeekStart()))} · Draft on this device`;
  $('planOutput').innerHTML=meals.length
    ?`<div class="sectionhead"><h2>${heading}</h2><button type="button" onclick="${manual?'openManualPicker()':'generate()'}">${manual?'✎ Edit picks':'↻ Regenerate'}</button></div>
      <div class="summary">${summary}</div>
      ${meals.map((r,i)=>`<article class="meal">${dishMedia(r)}<div class="content"><h3>${i+1}. ${clean(r.title)}</h3><p>${clean(r.minutes)} · ${clean(r.category)}</p><div class="actions"><button type="button" onclick="detail('${r.id}')">View recipe</button><button type="button" onclick="${manual?`openManualPicker(${i})`:`swap(${i})`}">${manual?'Change':'↻ Swap'}</button><button type="button" onclick="toggleFav('${r.id}')">${favs.has(r.id)?'♥':'♡'}</button></div></div></article>`).join('')}
      <button type="button" class="primary wide" onclick="openExtras()">Next: Household extras & shopping list →</button>`
    :'<div class="panel"><p class="muted">Your meal plan will appear here once you generate it or make your own picks.</p></div>';
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
  Object.keys(localStorage).filter(k=>k.startsWith('omp_tick_')&&!k.startsWith('omp_tick_extra-')).forEach(k=>localStorage.removeItem(k));
  save();renderPlan();
  if(!$('shopping').hidden)shopping();
}
function toggleFav(id){favs.has(id)?favs.delete(id):favs.add(id);save();renderPlan();library();}
function quantityText(x,factor=1){
  if(Number.isFinite(x.amount)&&x.unit){
    const amount=roundAmount(x.amount*factor);
    return `${formatNumber(amount)}${x.unit==='unit'?'':' '+formatUnit(amount,x.unit)}`;
  }
  // Old saved weeks keep their original descriptive units. No invented history.
  return String(x.quantity||'To taste')+(factor===1?'':` × ${formatNumber(factor)}`);
}
function ingredientLine(x,factor=1){
  return `<li><span>${clean(titleFirst(x.name))}: <strong>${clean(quantityText(x,factor))}</strong></span>${x.optional?' <span class="ingredient-note">(optional)</span>':''}${x.note&&!/unconfirmed|unspecified|not specified|original.*size/i.test(x.note)?` <span class="ingredient-note"> · ${clean(x.note)}</span>`:''}</li>`;
}
function renderStepText(r,template,factor){
  return template.replace(/\{\{q:([\d.]+):([a-z]+)\}\}/g,(_,n,u)=>`${formatNumber(Number(n)*factor)} ${formatUnit(Number(n)*factor,u)}`)
    .replace(/\{\{i:(\d+)\}\}/g,(_,n)=>quantityText(r.ingredients[Number(n)],factor));
}
function cookSteps(r,factor){
  const templates=r.stepTemplates||legacyStepTemplates(r.steps||[]);
  return templates.map(t=>renderStepText(r,t,factor));
}
function legacyStepTemplates(steps){
  // Safely scale only explicit food units in historical instructions.
  // Temperatures, timings, dimensions and descriptive original portions are untouched.
  return steps.map(t=>String(typeof t==='string'?t:t.text||'').replace(/(?<![\w.])(\d+(?:\.\d+)?|[¼½¾])\s*(ml|g|tsp|tbsp)\b/gi,(m,n,u)=>`{{q:${({'¼':.25,'½':.5,'¾':.75})[n]??Number(n)}:${u.toLowerCase()}}`));
}
function recipeBody(r,factor,household,history=''){
  const fractionalEgg=(r.ingredients||[]).some(i=>/\begg\b/i.test(i.name)&&Number.isFinite(i.amount)&&!Number.isInteger(roundAmount(i.amount*factor)));
  return `${dishMedia(r,true)}<h2>${clean(r.title)}</h2>
    <p class="muted">${[r.subtitle,r.minutes,(r.meats||[]).join(' + '),r.category].filter(Boolean).map(clean).join(' · ')}</p>
    <p class="serving-badge"><strong>For ${clean(householdLabel(household))}</strong> · ${formatNumber(factor*2)} adult-sized portions</p>
    ${history?`<p class="small-hint">${clean(history)}</p>`:''}
    ${r.fishReview?'<p class="small-hint">For a seafood-free meal, choose sauces labelled suitable for vegetarians and check every ingredient label.</p>':''}
    <h3>Ingredients for your household</h3><ul class="ingredients">${(r.ingredients||[]).map(x=>ingredientLine(x,factor)).join('')}</ul>
    <h3>Pantry for your household</h3><ul class="ingredients">${(r.pantry||[]).map(x=>ingredientLine(x,factor)).join('')}</ul>
    ${r.hasEstimatedQuantities?'<p class="small-hint estimate-note">Some amounts are practical supermarket estimates, not original sachet weights.</p>':''}
    ${fractionalEgg?'<p class="note">For a fractional egg, beat an egg first and measure the fraction needed. Buy whole eggs; do not round up the amount going into the recipe.</p>':''}
    <h3>Cooking instructions</h3><p class="small-hint">Use the quantities above, sharing the total oil across cooking stages. Amounts below match your household. Times and temperatures do not multiply; use larger pans or cook in batches when needed. Taste before adding extra salt or chilli.</p>
    <ol class="method">${cookSteps(r,factor).map(x=>`<li>${clean(x)}</li>`).join('')}</ol>
    <details class="recipe-guidance"><summary>Allergens & cooking safety</summary>
    <p>Always check purchased-product labels.</p><ul>${(r.allergenNotes||[]).map(x=>`<li>${clean(x)}</li>`).join('')}</ul>
    ${(r.safetyNotes||[]).map(x=>`<p>${clean(x)}</p>`).join('')}
    <p>Cook poultry, pork, mince and sausages to 75°C at the centre. Cooking times depend on size and heat. <a href="https://www.safefood.net/food-safety/cooking-food-safety/check-meat-cooked-properly" target="_blank" rel="noopener noreferrer">Food safety guidance</a></p></details>`;
}
function openRecipeDialog(){
  if(!$('detail').open)$('detail').showModal();
  $('detail').scrollTop=0;
}
function detail(id){
  const r=recipes.find(x=>x.id===id);if(!r)return;
  if(!requireHousehold())return;
  updateHousehold();
  $('detailBody').innerHTML=recipeBody(r,householdFactor(),settings);
  openRecipeDialog();
}
$('closeDetail').onclick=()=>$('detail').close();$('detail').onclick=e=>{if(e.target===$('detail'))$('detail').close()};
function library(){
  const term=$('search').value.toLowerCase(),cat=$('filterCategory').value,meat=$('filterMeat').value.toLowerCase();
  const matches=recipes.filter(base=>[base,...(base.variants||[])].some(r=>(r.title+' '+r.subtitle).toLowerCase().includes(term)||r.ingredients.some(x=>x.name.toLowerCase().includes(term))))
    .map(base=>({base,r:resolveRecipe(base)})).filter(({r})=>(cat==='All styles'||categoryOf(r)===cat)&&(meat==='all meats'||r.meats.includes(meat)));
  $('recipeList').innerHTML=matches.map(({base,r})=>`<article class="recipe">${dishMedia(r)}
    <h3>${clean(r.title)}</h3><p>${clean(r.subtitle)}</p><p>${clean(r.minutes)} · ${clean(r.meats.join(' + '))}</p>
    <span class="pill ${categoryOf(r).toLowerCase()}">${clean(r.category)}</span>

    ${r.reviewRequired?'<span class="pill review-pill">Needs review</span>':''}
    <div class="actions"><button onclick="detail('${base.id}')">View</button><button aria-label="Favourite ${clean(base.title)}" onclick="toggleFav('${base.id}')">${favs.has(base.id)?'♥':'♡'}</button></div></article>`).join('')||'<p>No matching recipes.</p>';
}
function allIngredients(r){return [...r.ingredients,...(r.pantry||[])];}
function collectShopping(p,factor){
  const entries=new Map();
  for(const r of p)for(const x of allIngredients(r)){
    const measurable=Number.isFinite(x.amount)&&!!x.unit;
    const key=(x.shoppingKey||norm(x.name))+'|'+(measurable?x.unit:'text:'+x.quantity)+'|'+(x.optional?'optional':'required');
    if(!entries.has(key))entries.set(key,{name:x.shoppingName||titleFirst(x.name),unit:x.unit||'',count:0,quantity:x.quantity,measurable,sourceUnits:x.quantityStatus==='source-unit',optional:!!x.optional,cat:x.shoppingCategory||'Pantry & sauces',allocations:[],notes:new Set()});
    const e=entries.get(key);if(measurable)e.count+=roundAmount(x.amount*factor);
    e.sourceUnits ||= x.quantityStatus==='source-unit';
    if(x.pantry)e.cat='Pantry staples';
    e.allocations.push({recipe:r.title,amount:quantityText(x,factor),note:x.note||''});
    if(x.note)e.notes.add(x.note);
  }
  return [...entries.values()];
}
function shopping(){
  const p=getPlan();if(!p.length){$('shoppingOutput').innerHTML='<div class="panel">Generate a week first.</div>';return;}
  if(!householdIsValid){$('shoppingOutput').innerHTML='<div class="panel">Choose each child’s age and portion in Plan week before viewing personalised shopping quantities.</div>';return;}
  const factor=householdFactor(),entries=collectShopping(p,factor),groups={};
  entries.forEach(e=>(groups[e.cat]??=[]).push(e));
  const keyFor=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'-');
  const order=['Meat','Fruit & vegetables','Dairy & eggs','Grains & bread','Tins & jars','Pantry & sauces','Pantry staples'];
  $('shoppingOutput').innerHTML=`<div class="summary"><strong>${p.length} meals · ${clean(householdLabel())}</strong><br>${portionTotal()} adult-sized portions per dinner. Amounts shown are used in recipes, not shop pack sizes. Buy whole items as needed.</div>
    <div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="shareList()">Share / Copy list</button></div>
    ${order.filter(cat=>groups[cat]?.length).map(cat=>`<div class="shopgroup"><h3>${clean(cat)}</h3>${groups[cat].sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{
      const key=keyFor(e.name+e.unit+(e.measurable?'':e.quantity)+(e.optional?'optional':''));
      const checked=localStorage.getItem('omp_tick_'+key)==='yes';
      return `<label class="shopitem ${checked?'done':''}"><input type="checkbox" data-shopping="${key}" ${checked?'checked':''} onchange="localStorage.setItem('omp_tick_'+this.dataset.shopping,this.checked?'yes':'no');this.parentNode.classList.toggle('done',this.checked)"><span>${clean(titleFirst(e.name))} · <b>${clean(savedAmount(e))}</b>${e.optional?' <small>(optional)</small>':''}</span></label>`;
    }).join('')}</div>`).join('')}`;
}

async function shareList(){let t=[...document.querySelectorAll('.shopgroup')].map(g=>g.querySelector('h3').textContent+'\n'+[...g.querySelectorAll('.shopitem span')].map(e=>'☐ '+e.textContent.trim()).join('\n')).join('\n\n');try{if(navigator.share)await navigator.share({title:'WYF shopping list',text:t});else{await navigator.clipboard.writeText(t);alert('Shopping list copied.')}}catch(e){if(e.name!=='AbortError')alert('Use Print / Save PDF instead.')}}
$('children').onchange=()=>{renderChildDropdowns();updateHousehold();};
$('adults').onchange=()=>updateHousehold();
$('numMeals').addEventListener('change',updateMeatRule);
$('weekStart').addEventListener('change',savePlanWeekChoice);
$('generate').onclick=()=>generate();
['search','filterCategory','filterMeat'].forEach(id=>$(id).addEventListener('input',library));
loadPackedRecipes().then(r=>{
  recipes=r;$('count').textContent=`${r.length} recipes`;
  if(!localStorage.getItem('wyf_v141_migrated')){
    const snapshot={};Object.keys(localStorage).filter(k=>k.startsWith('omp_')||k==='wyf_device_profile'||k==='wyf_recipe_variants').forEach(k=>snapshot[k]=localStorage.getItem(k));
    try{localStorage.setItem('wyf_v141_backup',JSON.stringify(snapshot));localStorage.setItem('wyf_v141_migrated','yes');}
    catch(e){$('updateStatus').textContent='Automatic pre-update backup could not be saved. Use Back up this device.';}
    // Shopping amounts changed from kit units; do not retain stale current ticks.
    clearRecipeTicks();
  }
  $('numMeals').value=String(settings.numMeals||settings.n||5);
  for(const key of ['numMeals','adults','children','style'])if(settings[key]!==undefined)$(key).value=String(settings[key]);
  if(!$('adults').value)$('adults').value='2';
  if(!$('children').value)$('children').value='0';
  if(!$('style').value)$('style').value='Mix';
  if(!$('numMeals').value)$('numMeals').value='5';
  const recentlyLocked=lockedWeeks.some(w=>historicalWeekStart(w)===settings.planWeekStart);
  populateWeekMondayOptions();
  $('weekStart').value=suggestedWeekStart(settings.planWeekStart,new Date(),recentlyLocked);
  childProfiles=Array.isArray(settings.childProfiles)?deepCopy(settings.childProfiles):[];
  if(Array.isArray(settings.preferredMeats))document.querySelectorAll('.checks input').forEach(x=>x.checked=settings.preferredMeats.includes(x.value));
  if(typeof settings.excludeFishReview==='boolean')$('excludeUnverified').checked=settings.excludeFishReview;
  renderChildDropdowns();updateHousehold(false);householdLoaded=true;
  updateMeatRule();migratePreviouslyTickedWeeks();renderPlan();library();
}).catch(e=>{$('planOutput').textContent='Could not load the recipe bank or local data. Use Check for updates, or reopen the latest WYF link. Do not clear website data.'});

// ------ WYF everyday shopping add-ons ------
// Stored locally on each phone. Meal ingredients are never altered by these additions.
const EXTRA_PRESETS = [
  { group: 'Food & drink', items: ['Milk', 'Bread', 'Cereal', 'Tea bags', 'Coffee', 'Eggs', 'Butter', 'Olive oil', 'Fruit', 'Snacks'] },
  { group: 'Home & bathroom', items: ['Toilet paper', 'Toothpaste', 'Shampoo', 'Shower gel', 'Hand soap', 'Kitchen roll', 'Washing-up liquid', 'Laundry detergent', 'Bin bags'] }
];
let householdExtras = readLocal('omp_extras', []);
let extrasReviewed = readLocal('omp_extras_reviewed', false);
let extrasHistory = readLocal('omp_extras_history', {});
if(!Array.isArray(householdExtras))householdExtras=[];
householdExtras=householdExtras.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string');
if(!extrasHistory||typeof extrasHistory!=='object'||Array.isArray(extrasHistory))extrasHistory={};

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
  if(!requireHousehold())return;
  if(!getPlan().length){tab('plan');return;}
  renderHouseholdPicker();
  if(!$('extrasDialog').open) $('extrasDialog').showModal();
}
function finishExtras(clear=false) {
  if(clear) householdExtras=[];
  extrasReviewed=true;
  persistExtras();
  $('extrasDialog').close();
  lockThisWeek();
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
  if(id==='shopping' && getPlan().length && !extrasReviewed && !activeShoppingWeek()) { openExtras(); return; }
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
    cancelManualPicks();
    markActiveWeek(null); // A newly generated plan is a separate draft.
  }
  return succeeded;
};
const originalShopping = shopping;
shopping = function() {
  originalShopping();
  if(!getPlan().length || !householdIsValid) return;
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
      return `<label class="shopitem ${ticked?'done':''}"><input type="checkbox" data-shopping="${id}" ${ticked?'checked':''}><span>${clean(titleFirst(x.name))}${x.note?' · <b>'+clean(x.note)+'</b>':''}</span></label>`;
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

$('generate').onclick=()=>generate();
function exportDeviceBackup(){
  const data={};Object.keys(localStorage).filter(k=>isWYFBackupKey(k)).forEach(k=>data[k]=localStorage.getItem(k));
  const blob=new Blob([JSON.stringify({app:'WYF',version:WYF_VERSION,createdAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='WYF-device-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function checkForUpdates(){
  const status=$('updateStatus');status.textContent='Checking published version…';
  try{
    const response=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error('Not available');
    const remote=await response.json();
    if(typeof remote.version!=='string'||!/^\d+\.\d+\.\d+$/.test(remote.version))throw new Error('Invalid version file');
    if(remote.version!==WYF_VERSION){
      if(confirm(`WYF ${remote.version} is available. Reload now? Your saved device data will stay in place.`)){
        const url=new URL(location.href);url.searchParams.set('v',remote.version);url.searchParams.set('refresh',Date.now());location.replace(url.href);
      }else status.textContent='Update available; reload when ready.';
    }else status.textContent='You are using WYF '+WYF_VERSION+'.';
  }catch(e){status.textContent='Could not check for updates. Check the connection and try again; nothing was cleared.';}
}
$('backupDevice').onclick=exportDeviceBackup;
$('checkUpdates').onclick=checkForUpdates;

// Restore requires an intentional local file selection, strict structure checks,
// explicit confirmation and rollback if the browser refuses the write.
const RESTORE_LIMIT_BYTES=10*1024*1024;
function isWYFBackupKey(key){
  return /^omp_[a-z0-9_-]{1,120}$/i.test(key)||
    ['wyf_device_profile','wyf_recipe_variants','wyf_v141_backup','wyf_v141_migrated','wyf_v152_check_migrated'].includes(key);
}
function validateDeviceBackup(backup){
  if(!backup||backup.app!=='WYF'||!backup.data||typeof backup.data!=='object'||Array.isArray(backup.data))throw new Error('Not a WYF device backup.');
  if(typeof backup.version!=='string'||!/^\d+\.\d+\.\d+$/.test(backup.version))throw new Error('Invalid backup version.');
  const entries=Object.entries(backup.data);
  if(!entries.length||entries.length>2000)throw new Error('The backup has no valid data or too many entries.');
  const data={};
  for(const [key,value] of entries){
    if(!isWYFBackupKey(key)||typeof value!=='string'||value.length>RESTORE_LIMIT_BYTES)throw new Error('Unexpected backup entry: '+key);
    if(key.startsWith('omp_tick_')&&value!=='yes'&&value!=='no')throw new Error('Invalid shopping tick.');
    if(key==='omp_active_locked_week'&&!/^week-[a-z0-9-]{5,100}$/i.test(value))throw new Error('Invalid active-week ID.');
    if(['omp_plan','omp_favs','omp_extras','omp_locked_weeks'].includes(key)){
      const val=JSON.parse(value);
      if(!Array.isArray(val)||val.length>300)throw new Error('Invalid '+key+' array.');
      if(key==='omp_locked_weeks'&&val.some(w=>!w||typeof w.id!=='string'||!Array.isArray(w.meals)||!Array.isArray(w.shopping)||!Array.isArray(w.extras)))throw new Error('Incomplete saved week.');
    }
    if(['omp_settings','omp_extras_history','wyf_recipe_variants','wyf_v141_backup'].includes(key)){
      const val=JSON.parse(value);
      if(!val||typeof val!=='object'||Array.isArray(val))throw new Error('Invalid '+key+' object.');
    }
    if(key==='omp_extras_reviewed'&&typeof JSON.parse(value)!=='boolean')throw new Error('Invalid extras status.');
    data[key]=value;
  }
  if(!Array.isArray(JSON.parse(data.omp_locked_weeks||'[]')))throw new Error('Invalid weeks.');
  return data;
}
async function restoreDeviceBackup(event){
  const field=event.target,file=field.files?.[0];field.value='';
  if(!file)return;
  if(file.size>RESTORE_LIMIT_BYTES){alert('This backup is too large. No data was changed.');return;}
  let data;
  try{data=validateDeviceBackup(JSON.parse(await file.text()));}
  catch(e){alert('Backup not restored: '+String(e?.message||'Unreadable file').replace(/\.$/,'')+'. Your current WYF data is unchanged.');return;}
  const savedWeeks=JSON.parse(data.omp_locked_weeks||'[]').length;
  if(!confirm(`Restore this WYF backup (${savedWeeks} saved week${savedWeeks===1?'':'s'})? This REPLACES this iPhone's current WYF plans, shopping ticks, favourites and saved weeks. Back up your current device first if needed.`))return;
  const current={};
  for(const key of Object.keys(localStorage))if(isWYFBackupKey(key))current[key]=localStorage.getItem(key);
  try{
    for(const key of Object.keys(current))localStorage.removeItem(key);
    for(const [key,value] of Object.entries(data))localStorage.setItem(key,value);
    // An earlier backup needs its original v1.5.2 tick migration run again.
    if(!Object.hasOwn(data,'wyf_v152_check_migrated'))localStorage.removeItem('wyf_v152_check_migrated');
  }catch(e){
    try{
      for(const key of Object.keys(localStorage))if(isWYFBackupKey(key))localStorage.removeItem(key);
      for(const [key,value] of Object.entries(current))localStorage.setItem(key,value);
      alert('Storage was unavailable. Your previous WYF information has been restored.');
    }catch(_){alert('Restore failed and browser storage may be incomplete. Keep both backup files safe and do not clear site data.');}
    return;
  }
  alert('WYF backup restored. The app will reload with your saved data.');
  location.reload();
}
$('restoreBackup').onclick=()=>$('restoreBackupFile').click();
$('restoreBackupFile').addEventListener('change',restoreDeviceBackup);



// ------ v1.4.1: immutable, device-local locked week snapshots ------
// Each week contains full recipe data, shopping allocations and household extras.
const WEEKS_KEY='omp_locked_weeks';
let lockedWeeks=readLocal(WEEKS_KEY,[]);
if(!Array.isArray(lockedWeeks)) lockedWeeks=[];
lockedWeeks=lockedWeeks.filter(w=>w&&typeof w.id==='string'&&Array.isArray(w.meals));
const deepCopy=x=>JSON.parse(JSON.stringify(x));
function weekDate(iso){return new Date(iso).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'});}
function weekMonday(date){return weekLabel(mondayOnOrBefore(date));}
function weekFingerprint(meals){return JSON.stringify({ids:meals.map(r=>[r.id,r.variantId||'',r.dataVersion||WYF_VERSION]),household:{adults:settings.adults,children:settings.children,childPortions:settings.childPortions},extras:householdExtras.map(e=>({id:e.id,note:e.note})).sort((a,b)=>a.id.localeCompare(b.id))});}
function lockThisWeek(){
  if(!requireHousehold())return;
  updateHousehold();
  const monday=validateSelectedWeek();if(!monday)return;
  const meals=getPlan();if(!meals.length){tab('plan');return;}
  const fingerprint=weekFingerprint(meals);
  const prior=lockedWeeks.find(w=>historicalWeekStart(w)===monday&&sameShoppingContext(w));
  if(prior){markActiveWeek(prior);originalTab('shopping');alert('This week is already saved in Weeks. No duplicate was created.');return;}
  const now=new Date();
  const factor=householdFactor();
  const record={id:'week-'+now.getTime()+'-'+Math.random().toString(36).slice(2,7),createdAt:now.toISOString(),weekStart:monday,weekOf:weekLabel(monday),fingerprint,
    schemaVersion:2,appVersion:WYF_VERSION,meals:deepCopy(meals),settings:deepCopy(settings),extras:deepCopy(householdExtras),factor,
    shopping:deepCopy(collectShopping(meals,factor)),checks:{}};
  lockedWeeks.unshift(record);
  try{localStorage.setItem(WEEKS_KEY,JSON.stringify(lockedWeeks));}
  catch(e){lockedWeeks.shift();alert('Could not save this week. Device storage may be full. No week was locked.');return;}
  tab('shopping');
  $('shoppingOutput').insertAdjacentHTML('afterbegin',`<div class="summary"><b>✓ Week locked in!</b> Saved under Weeks (${clean(record.weekOf)}). Your recipes and shopping quantities are stored as a snapshot on this iPhone. <button type="button" onclick="tab('weeks')">Open Weeks</button></div>`);
}
function saveLockedWeeks(){try{localStorage.setItem(WEEKS_KEY,JSON.stringify(lockedWeeks));return true;}catch(e){alert('Unable to save. Check available storage.');return false;}}
function savedAmount(e){return e.measurable?`${formatNumber(e.count)}${e.unit==='unit'?'':' '+formatUnit(roundAmount(e.count),e.unit)}`:String(e.quantity||'To taste');}
function savedShopping(w){
  const groups={};(w.shopping||[]).forEach(e=>(groups[e.cat]??=[]).push(e));
  const order=['Meat','Fruit & vegetables','Dairy & eggs','Grains & bread','Tins & jars','Pantry & sauces','Pantry staples'];
  const food=order.filter(k=>groups[k]?.length).map(k=>`<div class="shopgroup"><h3>${clean(k)}</h3>${groups[k].map((e,i)=>`<label class="shopitem ${w.checks?.['food-'+k+'-'+i]?'done':''}"><input type="checkbox" data-week-check="food-${clean(k)}-${i}" ${w.checks?.['food-'+k+'-'+i]?'checked':''}><span>${clean(titleFirst(e.name))} · <b>${clean(savedAmount(e))}</b>${e.optional?' <small>(optional)</small>':''}</span></label>`).join('')}</div>`).join('');
  const extras=w.extras?.length?`<div class="shopgroup"><h3>Household extras</h3>${w.extras.map((e,i)=>`<label class="shopitem ${w.checks?.['extra-'+i]?'done':''}"><input type="checkbox" data-week-check="extra-${i}" ${w.checks?.['extra-'+i]?'checked':''}><span>${clean(titleFirst(e.name))}${e.note?' · '+clean(e.note):''}</span></label>`).join('')}</div>`:'';
  return `<p class="small-hint">Saved quantities for ${clean(householdLabel(w.settings))}. ${w.schemaVersion===2?'':'This historical list keeps its original recipe units.'}</p>${food}${extras}`;
}

function renderWeeks(){
  const root=$('weeksOutput');
  if(!lockedWeeks.length){root.innerHTML='<div class="panel">No saved weeks yet. Generate dinners, review your extras, then tap Lock This Week In.</div>';return;}
  root.innerHTML=lockedWeeks.map(w=>`<article class="panel saved-week"><h3>Week of ${clean(w.weekOf)}</h3><p class="muted">${w.meals.length} dinners · ${clean(householdLabel(w.settings))}${w.settings?.planMode==='manual'?' · Hand-picked':''} · Locked ${clean(weekDate(w.createdAt))} at ${clean(new Date(w.createdAt).toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'}))}</p>
  <details><summary>View dinners and cooking instructions</summary>${w.meals.map((r,i)=>`<div class="saved-dinner"><strong>${i+1}. ${clean(r.title)}</strong><p>${clean(r.minutes||'')}</p><button type="button" data-saved-recipe="${clean(w.id)}" data-meal-index="${i}">Ingredients & cooking steps →</button></div>`).join('')}</details>
  <details><summary>Saved shopping list</summary>${savedShopping(w)}</details>
  <button type="button" class="delete-week" data-delete-week="${clean(w.id)}">Delete week</button></article>`).join('');
  root.querySelectorAll('[data-saved-recipe]').forEach(b=>b.addEventListener('click',()=>showSavedRecipe(b.dataset.savedRecipe,Number(b.dataset.mealIndex))));
  root.querySelectorAll('[data-delete-week]').forEach(b=>b.addEventListener('click',()=>deleteLockedWeek(b.dataset.deleteWeek)));
  root.querySelectorAll('[data-week-check]').forEach(inp=>inp.addEventListener('change',()=>{
    const w=lockedWeeks.find(w=>w.id===inp.closest('.saved-week').querySelector('[data-delete-week]').dataset.deleteWeek);
    if(!w)return;w.checks??={};w.checks[inp.dataset.weekCheck]=inp.checked;inp.closest('.shopitem').classList.toggle('done',inp.checked);saveLockedWeeks();
  }));
}
function showSavedRecipe(id,index){
  const w=lockedWeeks.find(w=>w.id===id),r=w?.meals[index];if(!r)return;
  const factor=Number.isFinite(w.factor)?w.factor:householdFactor(w.settings);
  $('detailBody').innerHTML=recipeBody(r,factor,w.settings,`Saved ${weekDate(w.createdAt)}. Uses this saved week's household, not today's selections.${w.schemaVersion===2?'':' This older recipe retains its original kit units and methods.'}`);
  openRecipeDialog();
}

function deleteLockedWeek(id){
  const w=lockedWeeks.find(w=>w.id===id);if(!w)return;
  if(!confirm(`Delete the saved week of ${w.weekOf}? This cannot be undone. Your recipe library and current meal plan will not be deleted.`))return;
  const before=lockedWeeks;lockedWeeks=lockedWeeks.filter(x=>x.id!==id);
  if(saveLockedWeeks()){
    if(localStorage.getItem(ACTIVE_WEEK_KEY)===id)markActiveWeek(null);
    renderWeeks();
  }else lockedWeeks=before;
}
const tabBeforeWeeks=tab;
tab=function(id){if(id==='weeks'){originalTab(id);renderWeeks();return;}return tabBeforeWeeks(id);};


// ------ WYF v1.5.1: unrestricted "Make my own picks" flow ------
// Only selection changes: ingredients, household scaling, extras, shopping and
// saved Weeks continue to use the exact same plan[] IDs and recipe snapshots.
let manualDraft=[];
let manualReplaceIndex=null;
const manualTarget=()=>Number($('numMeals').value);

function openManualPicker(replaceIndex=null){
  if(!recipes.length){alert('Recipe library is still loading. Please try again.');return;}
  if(![3,4,5,6,7].includes(manualTarget())){alert('Choose between 3 and 7 dinners.');return;}
  if(!requireHousehold())return;
  // Auto-generated picks are not silently carried into a new personal week.
  // Editing an existing personal week starts from its current choices.
  manualDraft=settings.planMode==='manual' ? [...plan].filter(id=>recipes.some(r=>r.id===id)) : [];
  manualReplaceIndex=null;
  if(Number.isInteger(replaceIndex) && replaceIndex>=0 && replaceIndex<manualDraft.length){
    manualDraft.splice(replaceIndex,1);
    manualReplaceIndex=replaceIndex;
  }
  $('manualSearch').value='';
  $('manualPicker').hidden=false;
  renderManualPicker();
  if(typeof $('manualPicker').scrollIntoView==='function') $('manualPicker').scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelManualPicks(){
  $('manualPicker').hidden=true;
  manualDraft=[];
  manualReplaceIndex=null;
}
function manualEligible(r){return !!r&&!r.reviewRequired&&(!$('excludeUnverified').checked||!r.fishReview);}
function renderManualPicker(){
  if($('manualPicker').hidden)return;
  const n=manualTarget(),total=recipes.length;
  const safeTotal=recipes.filter(manualEligible).length;
  $('manualDescription').textContent=`Choose ${n} dinners from ${safeTotal} available recipes. No meat-count, style or ingredient-overlap limits. The fish/seafood sauce-label exclusion above still applies.`;
  $('manualCount').textContent=`${manualDraft.length} of ${n}`;
  $('manualSelectedList').innerHTML=manualDraft.length
    ?manualDraft.map((id,index)=>{
      const r=recipes.find(r=>r.id===id);
      if(!r)return '';
      return `<div class="manual-picked-row"><span class="manual-pick-number">${index+1}</span><span class="manual-picked-title">${clean(r.title)}${manualEligible(r)?'':' · ⚠ Not available with current label-check settings'}</span><button type="button" data-manual-remove="${clean(id)}" aria-label="Remove ${clean(r.title)}">Remove</button></div>`;
    }).join('')
    :`<p class="manual-empty">No dinners picked yet. Add your favourites below.</p>`;
  const ready=manualDraft.length===n && new Set(manualDraft).size===n && manualDraft.every(id=>manualEligible(recipes.find(r=>r.id===id)));
  $('manualConfirm').disabled=!ready;
  const remaining=n-manualDraft.length;
  $('manualConfirm').textContent=ready?`Use these ${n} dinners →`:remaining<0?`Remove ${-remaining} dinner${remaining===-1?'':'s'}`:`Choose ${remaining} more dinner${remaining===1?'':'s'}`;
  renderManualResults();
}
function renderManualResults(){
  if($('manualPicker').hidden)return;
  const query=$('manualSearch').value.toLocaleLowerCase().trim();
  const terms=query.split(/\s+/).filter(Boolean);
  const matches=recipes.filter(r=>{
    if(!manualEligible(r))return false;
    const haystack=[r.title,r.subtitle,r.category,...r.meats,...r.ingredients.map(i=>i.name)].join(' ').toLocaleLowerCase();
    return terms.every(t=>haystack.includes(t));
  });
  $('manualResultsCount').textContent=`${matches.length} recipe${matches.length===1?'':'s'} found`;
  const full=manualDraft.length>=manualTarget();
  $('manualResults').innerHTML=matches.map(r=>{
    const picked=manualDraft.includes(r.id);
    const buttonText=picked?'✓ Selected':'+ Add';
    return `<div class="manual-result">${dishMedia(r)}<div class="manual-result-content"><strong>${clean(r.title)}</strong><small>${clean(r.minutes)} · ${clean(r.meats.join(' + ')||'Vegetarian')} · ${clean(categoryOf(r))}</small>${r.fishReview?'<small class="manual-label-note">Check sauce label for fish/seafood</small>':''}</div><button type="button" class="manual-add${picked?' is-picked':''}" data-manual-add="${clean(r.id)}" ${picked||full?'disabled':''} aria-label="${picked?'Already selected':'Add'} ${clean(r.title)}">${buttonText}</button></div>`;
  }).join('') || '<p class="muted">No matching recipes. Try another search.</p>';
}
function addManualPick(id){
  if(!manualEligible(recipes.find(r=>r.id===id))||manualDraft.includes(id)||manualDraft.length>=manualTarget())return;
  if(Number.isInteger(manualReplaceIndex)){
    manualDraft.splice(manualReplaceIndex,0,id);
    manualReplaceIndex=null;
  }else manualDraft.push(id);
  renderManualPicker();
}
function removeManualPick(id){
  const index=manualDraft.indexOf(id);
  if(index<0)return;
  manualDraft.splice(index,1);
  manualReplaceIndex=null;
  renderManualPicker();
}
function saveManualPicks(){
  const n=manualTarget();
  if(!requireHousehold())return;
  const monday=validateSelectedWeek();if(!monday)return;
  if(manualDraft.length!==n||new Set(manualDraft).size!==n||manualDraft.some(id=>!manualEligible(recipes.find(r=>r.id===id)))){
    alert(`Please select ${n} different dinners first.`);return;
  }
  const oldPlan=[...plan],oldSettings={...settings};
  const newSettings={...settings,n,numMeals:n,style:$('style').value,planWeekStart:monday,preferredMeats:selectedMeats(),excludeFishReview:$('excludeUnverified').checked,planMode:'manual'};
  try{
    localStorage.setItem('omp_plan',JSON.stringify(manualDraft));
    localStorage.setItem('omp_settings',JSON.stringify(newSettings));
  }catch(e){
    alert('Could not save your choices. Check available device storage. Your previous week has not been replaced.');
    try{localStorage.setItem('omp_plan',JSON.stringify(oldPlan));localStorage.setItem('omp_settings',JSON.stringify(oldSettings));}catch(_){}
    return;
  }
  const editing=oldSettings.planMode==='manual'&&oldPlan.length>0;
  plan=[...manualDraft];
  settings=newSettings;
  // New weeks clear previous extras. Edits keep their extras but ask for a
  // fresh review, so they can still use the standard Lock This Week In flow.
  if(!editing)householdExtras=[];
  extrasReviewed=false;
  Object.keys(localStorage).filter(k=>k.startsWith('omp_tick_')).forEach(k=>localStorage.removeItem(k));
  persistExtras();
  cancelManualPicks();
  markActiveWeek(null); // A new DIY plan has its own checklist.
  renderPlan();
  if(typeof $('planOutput').scrollIntoView==='function') $('planOutput').scrollIntoView({behavior:'smooth',block:'start'});
}
$('makeOwnPicks').onclick=()=>openManualPicker();
$('manualClose').onclick=cancelManualPicks;
$('manualCancel').onclick=cancelManualPicks;
$('manualConfirm').onclick=saveManualPicks;
$('manualSearch').addEventListener('input',renderManualResults);
$('manualSelectedList').addEventListener('click',e=>{
  const b=e.target.closest('[data-manual-remove]');if(b)removeManualPick(b.dataset.manualRemove);
});
$('manualResults').addEventListener('click',e=>{
  const b=e.target.closest('[data-manual-add]');if(b)addManualPick(b.dataset.manualAdd);
});
$('numMeals').addEventListener('change',renderManualPicker);
$('excludeUnverified').addEventListener('change',()=>{if(!$('manualPicker').hidden)renderManualPicker();});

// ------ WYF v1.5.2: one checklist per locked week + optional offline sharing ------
// A saved week owns its checklist. The Shopping tab and Weeks tab are merely
// two views onto the same checks when the current plan matches that locked week.
// Shares are files containing one complete snapshot, not live synchronisation.
const ACTIVE_WEEK_KEY = 'omp_active_locked_week';
const CHECKS_MIGRATION_KEY = 'wyf_v152_check_migrated';
const WEEK_SHARE_FORMAT = 'wyf-locked-week';
const WEEK_SHARE_SCHEMA = 1;
const WEEK_SHARE_MAX_BYTES = 2 * 1024 * 1024;
const shoppingBeforeWeekSync = shopping;
const lockBeforeWeekSync = lockThisWeek;

function foodShoppingId(e){
  return String((e.name||'')+(e.unit||'')+(e.measurable?'':(e.quantity||''))+(e.optional?'optional':''))
    .toLowerCase().replace(/[^a-z0-9]/g,'-');
}
function foodWeekKey(e){return 'food-'+foodShoppingId(e);}
function extraWeekKey(e){return 'extra-'+extraKey(e.name||e.id||'');}
function sameShoppingContext(w){
  if(!w || !Array.isArray(w.meals) || !Array.isArray(w.extras) || !w.settings)return false;
  const ids=getPlan().map(r=>r.id),lockedIds=w.meals.map(r=>r.id);
  if(ids.length!==lockedIds.length || ids.some((id,i)=>id!==lockedIds[i]))return false;
  if(Number(w.settings.adults)!==Number(settings.adults)||Number(w.settings.children)!==Number(settings.children))return false;
  if(Math.abs((Number(w.factor)||householdFactor(w.settings))-householdFactor())>.00001)return false;
  const signature=extras=>extras.map(e=>[extraKey(e.name),String(e.note||'')]).sort((a,b)=>a[0].localeCompare(b[0]));
  return JSON.stringify(signature(w.extras))===JSON.stringify(signature(householdExtras));
}
function activeShoppingWeek(){
  const activeId=localStorage.getItem(ACTIVE_WEEK_KEY);
  const active=lockedWeeks.find(w=>w.id===activeId);
  if(active)return active;
  // Older saved weeks were created before there was an explicit active ID.
  return lockedWeeks.find(w=>historicalWeekStart(w)===selectedWeekStart()&&sameShoppingContext(w))||null;
}
function markActiveWeek(w){
  try{if(w)localStorage.setItem(ACTIVE_WEEK_KEY,w.id);else localStorage.removeItem(ACTIVE_WEEK_KEY);}catch(_){}
}
function chooseShoppingWeek(id){
  const w=lockedWeeks.find(w=>w.id===id);if(!w)return;
  markActiveWeek(w);
  originalTab('shopping'); // A saved week's checklist never requires editing draft extras.
}
function migrateSavedCheckKeys(w){
  if(!w.checks||typeof w.checks!=='object'||Array.isArray(w.checks))w.checks={};
  const groups={};
  (w.shopping||[]).forEach(e=>{if(e&&typeof e.cat==='string')(groups[e.cat]??=[]).push(e);});
  for(const [cat,entries] of Object.entries(groups)){
    entries.forEach((e,i)=>{
      const oldKey='food-'+cat+'-'+i, newKey=foodWeekKey(e);
      if(w.checks[oldKey]===true && w.checks[newKey]===undefined)w.checks[newKey]=true;
      if(oldKey!==newKey)delete w.checks[oldKey];
    });
  }
  (w.extras||[]).forEach((e,i)=>{
    const oldKey='extra-'+i;
    const matching=(w.shopping||[]).find(food=>extraKey(food.name)===extraKey(e.name));
    const newKey=matching?foodWeekKey(matching):extraWeekKey(e);
    if(w.checks[oldKey]===true && w.checks[newKey]===undefined)w.checks[newKey]=true;
    if(oldKey!==newKey)delete w.checks[oldKey];
  });
}
function migratePreviouslyTickedWeeks(){
  if(localStorage.getItem(CHECKS_MIGRATION_KEY)==='yes')return;
  lockedWeeks.forEach(migrateSavedCheckKeys);
  const current=activeShoppingWeek();
  if(current){
    // Existing shopping-tab ticks (the user's kitchen check) take precedence
    // over any older unsynchronised saved-week checkbox in this one migration.
    (current.shopping||[]).forEach(e=>{
      if(localStorage.getItem('omp_tick_'+foodShoppingId(e))==='yes') current.checks[foodWeekKey(e)]=true;
    });
    (current.extras||[]).forEach(e=>{
      if(localStorage.getItem('omp_tick_'+extraWeekKey(e))==='yes'){
        const matching=(current.shopping||[]).find(f=>extraKey(f.name)===extraKey(e.name));
        current.checks[matching?foodWeekKey(matching):extraWeekKey(e)]=true;
      }
    });
    markActiveWeek(current);
  }
  try{
    localStorage.setItem(WEEKS_KEY,JSON.stringify(lockedWeeks));
    localStorage.setItem(CHECKS_MIGRATION_KEY,'yes');
  }catch(_){/* Preserve existing checks, and retry migration on next visit. */}
}
function setWeekSavedTick(w,key,input){
  if(!w)return;
  const checked=input.checked,old=w.checks?.[key];
  w.checks??={};w.checks[key]=checked;
  if(!saveLockedWeeks()){
    if(old===undefined)delete w.checks[key];else w.checks[key]=old;
    input.checked=!checked;
    input.closest('.shopitem')?.classList.toggle('done',!checked);return;
  }
  input.closest('.shopitem')?.classList.toggle('done',checked);
  if(activeShoppingWeek()?.id===w.id && sameShoppingContext(w)){
    const currentKey=key.startsWith('food-')?key.slice(5):key;
    try{localStorage.setItem('omp_tick_'+currentKey,checked?'yes':'no');}catch(_){}
  }
}
function setCurrentSavedTick(input){
  const w=activeShoppingWeek();
  const tick=input.dataset.shopping;
  const key=tick.startsWith('extra-')?tick:'food-'+tick;
  const checked=input.checked;
  if(w){
    const previous=w.checks?.[key];w.checks??={};w.checks[key]=checked;
    if(!saveLockedWeeks()){
      if(previous===undefined)delete w.checks[key];else w.checks[key]=previous;
      input.checked=!checked;
      input.closest('.shopitem')?.classList.toggle('done',!checked);
      return;
    }
  }
  try{localStorage.setItem('omp_tick_'+tick,checked?'yes':'no');}catch(_){}
  input.closest('.shopitem')?.classList.toggle('done',checked);
}
function syncedShoppingView(){
  const w=activeShoppingWeek();
  if(w&&!sameShoppingContext(w)){
    const root=$('shoppingOutput');
    root.innerHTML=`<div class="summary"><b>Shopping for saved week of ${clean(w.weekOf)}</b><br>${clean(householdLabel(w.settings))} · ${w.meals.length} dinners. This is the locked list, even if you've started a new draft.</div>
      <div class="actions"><button type="button" onclick="window.print()">Print / Save PDF</button><button type="button" onclick="shareList()">Share / Copy list</button><button type="button" id="resumeDraftShopping">Return to draft list</button></div>
      ${linkedSavedShopping(w)}`;
    root.querySelectorAll('[data-week-check]').forEach(input=>input.addEventListener('change',()=>setWeekSavedTick(w,input.dataset.weekCheck,input)));
    $('resumeDraftShopping').onclick=()=>{markActiveWeek(null);if(!extrasReviewed&&getPlan().length){openExtras();return;}shopping();};
    return;
  }
  shoppingBeforeWeekSync();
  if(!w)return;
  // Replace checkbox nodes to remove v1.5.1's old inline / addEventListener
  // handlers. Only this one handler may now update a saved week's checklist.
  const root=$('shoppingOutput');
  const rows=[...root.querySelectorAll('.shopgroup .shopitem input[data-shopping]')];
  for(const oldInput of rows){
    const tick=oldInput.dataset.shopping;
    const checked=!!w.checks?.[tick.startsWith('extra-')?tick:'food-'+tick];
    const input=oldInput.cloneNode(true);
    input.removeAttribute('onchange');input.onchange=null;input.checked=checked;
    oldInput.replaceWith(input);
    input.closest('.shopitem')?.classList.toggle('done',checked);
    input.addEventListener('change',()=>setCurrentSavedTick(input));
  }
  const summary=root.querySelector('.summary');
  if(summary)summary.insertAdjacentHTML('afterend',`<p class="linked-week-note">✓ Linked to your saved week of ${clean(w.weekOf)}. Tick an item here or in Weeks, and both checklists stay up to date on this iPhone.</p>`);
}
shopping = syncedShoppingView;

lockThisWeek=function(){
  if(!requireHousehold())return;
  const monday=validateSelectedWeek();if(!monday)return;
  const same=lockedWeeks.find(w=>historicalWeekStart(w)===monday&&sameShoppingContext(w));
  if(same){
    markActiveWeek(same);
    tab('shopping');
    alert('This week is already saved. Your current shopping list and the copy in Weeks share the same ticks.');
    return;
  }
  const idsBefore=new Set(lockedWeeks.map(w=>w.id));
  lockBeforeWeekSync();
  const created=lockedWeeks.find(w=>!idsBefore.has(w.id)&&historicalWeekStart(w)===monday&&sameShoppingContext(w));
  if(created){
    // A user might have checked items before locking. Carry those checks over.
    migrateSavedCheckKeys(created);
    (created.shopping||[]).forEach(e=>{
      if(localStorage.getItem('omp_tick_'+foodShoppingId(e))==='yes')created.checks[foodWeekKey(e)]=true;
    });
    (created.extras||[]).forEach(e=>{
      if(localStorage.getItem('omp_tick_'+extraWeekKey(e))==='yes')created.checks[extraWeekKey(e)]=true;
    });
    saveLockedWeeks();
    markActiveWeek(created);
    if(!$('shopping').hidden)shopping();
  }
};

function linkedSavedShopping(w){
  migrateSavedCheckKeys(w);
  const groups={};(w.shopping||[]).forEach(e=>(groups[e.cat]??=[]).push(e));
  const matchedExtras=new Map();
  const separate=[];
  (w.extras||[]).forEach(e=>{
    const matching=(w.shopping||[]).find(food=>extraKey(food.name)===extraKey(e.name));
    if(matching)matchedExtras.set(foodWeekKey(matching),e);
    else separate.push(e);
  });
  const order=['Meat','Fruit & vegetables','Dairy & eggs','Grains & bread','Tins & jars','Pantry & sauces','Pantry staples'];
  const food=order.filter(k=>groups[k]?.length).map(k=>`<div class="shopgroup"><h3>${clean(k)}</h3>${groups[k].sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{
    const key=foodWeekKey(e),checked=!!w.checks?.[key],extra=matchedExtras.get(key);
    return `<label class="shopitem ${checked?'done':''}"><input type="checkbox" data-week-check="${clean(key)}" ${checked?'checked':''}><span>${clean(titleFirst(e.name))} · <b>${clean(savedAmount(e))}</b>${e.optional?' <small>(optional)</small>':''}${extra?clean(extra.note?' + household: '+extra.note:' + household extra'):''}</span></label>`;
  }).join('')}</div>`).join('');
  const categories=['Food & drink','Home & bathroom','Other extras'];
  const extraGroups=categories.filter(k=>separate.some(e=>e.group===k)).map(k=>{
    const items=separate.filter(e=>e.group===k);
    return `<div class="shopgroup"><h3>${clean(k)} · additional items</h3>${items.map(e=>{
      const key=extraWeekKey(e),checked=!!w.checks?.[key];
      return `<label class="shopitem ${checked?'done':''}"><input type="checkbox" data-week-check="${clean(key)}" ${checked?'checked':''}><span>${clean(titleFirst(e.name))}${e.note?' · <b>'+clean(e.note)+'</b>':''}</span></label>`;
    }).join('')}</div>`;
  }).join('');
  return `<p class="small-hint">Saved shopping quantities for ${clean(householdLabel(w.settings))}. All ticks are included when sharing this week.</p>${food}${extraGroups}`;
}
function syncedWeeksView(){
  const root=$('weeksOutput');
  const importBar=`<div class="week-import-bar"><button type="button" id="importSharedWeek" class="subtle">Import shared week</button><p class="small-hint">Received a WYF week file? Save it to Files, then import it here. Your current plan stays untouched.</p></div>`;
  if(!lockedWeeks.length){root.innerHTML=importBar+'<div class="panel">No saved weeks yet. Choose your dinners, review extras, then Lock This Week In.</div>';}
  else{
    root.innerHTML=importBar+lockedWeeks.map(w=>`<article class="panel saved-week" data-saved-week-id="${clean(w.id)}">
      <h3>Week of ${clean(w.weekOf)}</h3>
      <p class="muted">${w.meals.length} dinners · ${clean(householdLabel(w.settings))}${w.settings?.planMode==='manual'?' · Hand-picked':''}${w.receivedAt?' · Imported copy':''} · Locked ${clean(weekDate(w.createdAt))}</p>
      <details><summary>Dinners & cooking instructions</summary>${w.meals.map((r,i)=>`<div class="saved-dinner"><strong>${i+1}. ${clean(r.title)}</strong><p>${clean(r.minutes||'')}</p><button type="button" data-saved-recipe="${clean(w.id)}" data-meal-index="${i}">Ingredients & cooking steps →</button></div>`).join('')}</details>
      <details class="saved-shopping-details"><summary>Saved shopping list</summary>${linkedSavedShopping(w)}</details>
      <div class="week-actions"><button type="button" class="shop-week" data-shop-week="${clean(w.id)}">Shop this week</button><button type="button" class="share-week" data-share-week="${clean(w.id)}">Share week</button><button type="button" class="delete-week" data-delete-week="${clean(w.id)}">Delete week</button></div>
    </article>`).join('');
  }
  $('importSharedWeek').addEventListener('click',()=>$('weekImportFile').click());
  root.querySelectorAll('[data-saved-recipe]').forEach(b=>b.addEventListener('click',()=>showSavedRecipe(b.dataset.savedRecipe,Number(b.dataset.mealIndex))));
  root.querySelectorAll('[data-delete-week]').forEach(b=>b.addEventListener('click',()=>deleteLockedWeek(b.dataset.deleteWeek)));
  root.querySelectorAll('[data-share-week]').forEach(b=>b.addEventListener('click',()=>shareLockedWeek(b.dataset.shareWeek)));
  root.querySelectorAll('[data-shop-week]').forEach(b=>b.addEventListener('click',()=>chooseShoppingWeek(b.dataset.shopWeek)));
  root.querySelectorAll('[data-week-check]').forEach(inp=>inp.addEventListener('change',()=>{
    const w=lockedWeeks.find(w=>w.id===inp.closest('.saved-week')?.dataset.savedWeekId);
    if(w)setWeekSavedTick(w,inp.dataset.weekCheck,inp);
  }));
}
renderWeeks = syncedWeeksView;

function saveWeekFile(file){
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function shareLockedWeek(id){
  const w=lockedWeeks.find(x=>x.id===id);if(!w)return;
  // Save any earlier-indexed checks as the same stable keys before exporting.
  migrateSavedCheckKeys(w);
  const payload={format:WEEK_SHARE_FORMAT,schemaVersion:WEEK_SHARE_SCHEMA,sharedAt:new Date().toISOString(),week:deepCopy(w)};
  const name='WYF-Week-'+(historicalWeekStart(w)||(w.createdAt||new Date().toISOString()).slice(0,10))+'.json';
  const file=new File([JSON.stringify(payload,null,2)],name,{type:'application/json'});
  const message=`WYF saved week of ${w.weekOf}. Includes meals, recipes and current shopping ticks. On your phone: save this attached file to Files, open WYF → Weeks → Import shared week. This is a snapshot, not live syncing.`;
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({title:'WYF week of '+w.weekOf,text:message,files:[file]});
    }else{
      saveWeekFile(file);
      alert('Week file downloaded. In your iPhone Files app, open the file and choose Share to send it via WhatsApp, AirDrop or another app. Your partner can import it in WYF → Weeks.');
    }
  }catch(err){
    if(err?.name==='AbortError')return;
    saveWeekFile(file);
    alert('Your browser could not share the file directly, so the week was downloaded. Share the JSON file from Files instead.');
  }
}
function validateSharedWeek(data){
  if(!data||data.format!==WEEK_SHARE_FORMAT||data.schemaVersion!==WEEK_SHARE_SCHEMA)throw new Error('This is not a compatible WYF shared-week file.');
  const w=data.week;
  if(!w||typeof w!=='object'||Array.isArray(w)||typeof w.id!=='string'||!/^week-[a-z0-9-]{5,100}$/i.test(w.id))throw new Error('The shared week has an invalid ID.');
  if(typeof w.createdAt!=='string'||!Number.isFinite(Date.parse(w.createdAt))||typeof w.weekOf!=='string'||w.weekOf.length>100)throw new Error('The saved week date is invalid.');
  if(!w.settings||!Number.isFinite(Number(w.settings.adults))||Number(w.settings.adults)<1||Number(w.settings.adults)>20||!Number.isFinite(Number(w.settings.children))||Number(w.settings.children)<0||Number(w.settings.children)>20)throw new Error('The household settings are invalid.');
  if(typeof w.factor!=='number'||w.factor<.25||w.factor>20||!Number.isFinite(w.factor))throw new Error('The recipe serving factor is invalid.');
  if(!Array.isArray(w.meals)||w.meals.length<1||w.meals.length>7||w.meals.some(r=>!r||typeof r.id!=='string'||r.id.length>40||typeof r.title!=='string'||r.title.length>250||!Array.isArray(r.ingredients)||r.ingredients.length>100||!Array.isArray(r.meats)||r.meats.length>4||!Array.isArray(r.steps)&&!Array.isArray(r.stepTemplates)))throw new Error('The shared recipes are incomplete.');
  if(!Array.isArray(w.shopping)||w.shopping.length>400||w.shopping.some(e=>!e||typeof e.name!=='string'||e.name.length>250||typeof e.cat!=='string'||e.cat.length>100||e.measurable&&!Number.isFinite(e.count)))throw new Error('The shopping list is invalid.');
  if(!Array.isArray(w.extras)||w.extras.length>100||w.extras.some(e=>!e||typeof e.name!=='string'||e.name.length>150||typeof e.group!=='string'||e.group.length>100))throw new Error('The additional shopping items are invalid.');
  if(!w.checks||typeof w.checks!=='object'||Array.isArray(w.checks)||Object.keys(w.checks).length>800||Object.entries(w.checks).some(([k,v])=>k.length>250||typeof v!=='boolean'))throw new Error('The shopping checklist is invalid.');
  const result=deepCopy(w);
  if(result.weekStart&&!validWeekStart(result.weekStart))throw new Error('The week commencing date is invalid.');
  result.weekStart=historicalWeekStart(result);
  if(!result.weekStart)throw new Error('No valid Monday was found for the saved week.');
  migrateSavedCheckKeys(result);
  result.receivedAt=new Date().toISOString();
  return result;
}
async function importWeekFromFile(event){
  const input=event.target,file=input.files?.[0];
  input.value='';
  if(!file)return;
  if(file.size>WEEK_SHARE_MAX_BYTES){alert('This week file is too large. Please check that you selected the WYF JSON file.');return;}
  let incoming;
  try{
    incoming=validateSharedWeek(JSON.parse(await file.text()));
  }catch(e){alert('Could not import this week: '+(e?.message||'Invalid file.'));return;}
  const index=lockedWeeks.findIndex(w=>w.id===incoming.id);
  if(index>=0&&!confirm('You already have this saved week. Replace your copy, including its current ticks, with the checklist in this shared file?'))return;
  const previous=lockedWeeks;
  lockedWeeks=index>=0?lockedWeeks.map((w,i)=>i===index?incoming:w):[incoming,...lockedWeeks];
  if(!saveLockedWeeks()){lockedWeeks=previous;return;}
  if(activeShoppingWeek()?.id===incoming.id){
    // The newly imported checklist is now authoritative for the active week.
    (incoming.shopping||[]).forEach(e=>{
      try{localStorage.setItem('omp_tick_'+foodShoppingId(e),incoming.checks[foodWeekKey(e)]?'yes':'no');}catch(_){}
    });
  }
  renderWeeks();
  alert('Week imported, including its shopping ticks! Open its Saved shopping list below. Each phone now has its own copy; share again later to pass on changes.');
}
$('weekImportFile').addEventListener('change',importWeekFromFile);

