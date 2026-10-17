// WYF v1.4.1. Household data stays on this device. No recipe photographs.
const WYF_VERSION = '1.4.1';
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

// Photos deliberately disabled, even if an old recipe-images.js is still hosted.
function dishMedia(r,large=false,action=''){
  const content=`<span class="dishfallback" aria-hidden="true">${icon(r)}</span>`;
  return large ? `<div class="dishpic dishpic-large" role="img" aria-label="Meal symbol, not a photograph">${content}</div>` :
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
  $('portionSummary').innerHTML=h.valid?`<strong>Cooking for ${clean(householdLabel(h))}</strong><br>${formatNumber(h.adults+h.childPortions)} adult-sized portions. Ingredients, shopping and cooking amounts update together.`:
    '<strong>Choose an age and portion for each child.</strong><br>WYF will do the adding up. Age never sets portion size automatically.';
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
  settings={...settings,n,numMeals:n,style,preferredMeats:selectedMeats(),excludeFishReview:$('excludeUnverified').checked};
  localStorage.setItem('omp_settings',JSON.stringify(settings));
  save();renderPlan();return true;
}
function getPlan(){return plan.map(id=>recipes.find(r=>r.id===id)).filter(Boolean).map(resolveRecipe)}
function renderPlan(){
  const meals=getPlan();
  const species=[...new Set(meals.flatMap(r=>r.meats))];
  const heading=`Your ${meals.length} dinners`;
  $('planOutput').innerHTML=meals.length
    ?`<div class="sectionhead"><h2>${heading}</h2><button onclick="generate()">↻ Regenerate</button></div>
      <div class="summary"><b>${clean(species.join(' + ')||'Vegetarian')}</b> · ${species.length}/${meatLimit(meals.length)} meat types · ${clean(householdLabel())} · Draft on this device</div>
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
  childProfiles=Array.isArray(settings.childProfiles)?deepCopy(settings.childProfiles):[];
  if(Array.isArray(settings.preferredMeats))document.querySelectorAll('.checks input').forEach(x=>x.checked=settings.preferredMeats.includes(x.value));
  if(typeof settings.excludeFishReview==='boolean')$('excludeUnverified').checked=settings.excludeFishReview;
  renderChildDropdowns();updateHousehold(false);householdLoaded=true;
  updateMeatRule();renderPlan();library();
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
  const data={};Object.keys(localStorage).filter(k=>k.startsWith('omp_')||k==='wyf_device_profile'||k==='wyf_recipe_variants').forEach(k=>data[k]=localStorage.getItem(k));
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


// ------ v1.4.1: immutable, device-local locked week snapshots ------
// Each week contains full recipe data, shopping allocations and household extras.
const WEEKS_KEY='omp_locked_weeks';
let lockedWeeks=readLocal(WEEKS_KEY,[]);
if(!Array.isArray(lockedWeeks)) lockedWeeks=[];
lockedWeeks=lockedWeeks.filter(w=>w&&typeof w.id==='string'&&Array.isArray(w.meals));
const deepCopy=x=>JSON.parse(JSON.stringify(x));
function weekDate(iso){return new Date(iso).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'});}
function weekMonday(date){let d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d.toLocaleDateString('en-IE',{day:'numeric',month:'long',year:'numeric'});}
function weekFingerprint(meals){return JSON.stringify({ids:meals.map(r=>[r.id,r.variantId||'',r.dataVersion||WYF_VERSION]),household:{adults:settings.adults,children:settings.children,childPortions:settings.childPortions},extras:householdExtras.map(e=>({id:e.id,note:e.note})).sort((a,b)=>a.id.localeCompare(b.id))});}
function lockThisWeek(){
  if(!requireHousehold())return;
  updateHousehold();
  const meals=getPlan();if(!meals.length){tab('plan');return;}
  const fingerprint=weekFingerprint(meals);
  const prior=lockedWeeks.find(w=>w.fingerprint===fingerprint&&w.weekOf===weekMonday(new Date()));
  if(prior){tab('shopping');alert('This exact week is already saved in Weeks. No duplicate was created.');return;}
  const now=new Date();
  const factor=householdFactor();
  const record={id:'week-'+now.getTime()+'-'+Math.random().toString(36).slice(2,7),createdAt:now.toISOString(),weekOf:weekMonday(now),fingerprint,
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
  root.innerHTML=lockedWeeks.map(w=>`<article class="panel saved-week"><h3>Week of ${clean(w.weekOf)}</h3><p class="muted">${w.meals.length} dinners · ${clean(householdLabel(w.settings))} · Locked ${clean(weekDate(w.createdAt))} at ${clean(new Date(w.createdAt).toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'}))}</p>
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
  const before=lockedWeeks;lockedWeeks=lockedWeeks.filter(x=>x.id!==id);if(saveLockedWeeks())renderWeeks();else lockedWeeks=before;
}
const tabBeforeWeeks=tab;
tab=function(id){if(id==='weeks'){originalTab(id);renderWeeks();return;}return tabBeforeWeeks(id);};
