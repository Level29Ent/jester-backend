export const PLAYER_SCALE = 1;
export const SKIN_TONES = Object.freeze([
  {id: 'porcelain', name: 'Porcelain', color: '#f3d6c4'},
  {id: 'peach', name: 'Peach', color: '#e8b99b'},
  {id: 'golden', name: 'Golden', color: '#d6a16f'},
  {id: 'tan', name: 'Tan', color: '#c98f67'},
  {id: 'olive', name: 'Olive', color: '#a67d50'},
  {id: 'brown', name: 'Brown', color: '#925e40'},
  {id: 'deep', name: 'Deep brown', color: '#69432e'},
  {id: 'espresso', name: 'Espresso', color: '#422d25'}
]);
export const COMPLEXIONS = Object.freeze([
  {id: 'natural', name: 'Natural'}, {id: 'freckles', name: 'Freckles'}, {id: 'rosy', name: 'Rosy cheeks'}
]);
export const BODY_TYPES = Object.freeze({
  slim: {name: 'Slim', torsoX: [.135, .105, .13, .17, .16], torsoZ: [.09, .075, .09, .1, .09], limb: .8, hip: .085, shoulder: .185},
  athletic: {name: 'Athletic', torsoX: [.16, .135, .16, .205, .19], torsoZ: [.105, .09, .11, .12, .105], limb: 1, hip: .095, shoulder: .22},
  fuller: {name: 'Fuller', torsoX: [.205, .235, .24, .24, .215], torsoZ: [.14, .175, .18, .155, .13], limb: 1.3, hip: .12, shoulder: .255}
});
export const HAIR_STYLES = Object.freeze([
  {id:'bald',name:'Bald'}, {id:'crop',name:'Short crop'}, {id:'curls',name:'Curls'},
  {id:'mohawk',name:'Mohawk'}, {id:'ponytail',name:'Ponytail'}
]);
export const HAIR_COLORS = Object.freeze([
  {id:'black',name:'Black',color:'#241b20'}, {id:'brown',name:'Brown',color:'#70452f'},
  {id:'blonde',name:'Blonde',color:'#e6be69'}, {id:'red',name:'Auburn',color:'#a64e34'},
  {id:'purple',name:'Level 29 purple',color:'#9359ed'}, {id:'green',name:'Jester green',color:'#72ce47'}
]);
export const DEFAULT_APPEARANCE = Object.freeze({skinTone: 'tan', complexion: 'natural', bodyType: 'athletic', hairStyle:'bald', hairColor:'black', showHat:true});
export function normalizeAppearance(value) {
  return {
    skinTone: SKIN_TONES.some(t => t.id === value?.skinTone) ? value.skinTone : DEFAULT_APPEARANCE.skinTone,
    complexion: COMPLEXIONS.some(c => c.id === value?.complexion) ? value.complexion : DEFAULT_APPEARANCE.complexion,
    hairStyle: HAIR_STYLES.some(s=>s.id===value?.hairStyle) ? value.hairStyle : DEFAULT_APPEARANCE.hairStyle,
    hairColor: HAIR_COLORS.some(c=>c.id===value?.hairColor) ? value.hairColor : DEFAULT_APPEARANCE.hairColor,
    showHat: value?.showHat !== false && value?.showHat !== 'no',
    bodyType: Object.hasOwn(BODY_TYPES, value?.bodyType || '') ? value.bodyType : DEFAULT_APPEARANCE.bodyType
  };
}
export function racerLookKey(player) {
  return JSON.stringify({loadout: player.loadout, appearance: normalizeAppearance(player.appearance)});
}

export function mountAppearance({save, available = true}) {
  const selects = ['skinTone', 'complexion', 'bodyType', 'hairStyle', 'hairColor', 'showHat'].map(key => [key, document.querySelector(`[data-appearance="${key}"]`)]);
  const status = document.getElementById('appearance-status');
  const options = {hairStyle:HAIR_STYLES, hairColor:HAIR_COLORS, showHat:[{id:'yes',name:'Wear equipped hat'},{id:'no',name:'Show hair · hide hat'}], skinTone: SKIN_TONES, complexion: COMPLEXIONS, bodyType: Object.entries(BODY_TYPES).map(([id, value]) => ({id, name: value.name}))};
  let busy = false;
  for (const [key, select] of selects) {
    for (const value of options[key]) { const option = document.createElement('option'); option.value = value.id; option.textContent = value.name; select.append(option); }
    select.disabled = !available;
    select.addEventListener('change', async () => {
      if (busy) return;
      busy = true; selects.forEach(([, element]) => { element.disabled = true; });
      status.textContent = 'Saving your look…';
      try {
        await save(Object.fromEntries(selects.map(([field, element]) => [field, element.value])));
        status.textContent = 'Look saved in this browser. Same race stats for every body type.';
      } catch { status.textContent = 'Could not save this look. Please try again.'; }
      finally { busy = false; selects.forEach(([, element]) => { element.disabled = !available; }); }
    });
  }
  if (!available) status.textContent = 'Appearance saving is available in local practice; the remote race server needs support.';
  return {update(value) { const normalized = normalizeAppearance(value); for (const [key, select] of selects) select.value = key==='showHat' ? (normalized.showHat?'yes':'no') : normalized[key]; }};
}
