import {CATALOG, UPGRADES} from './catalog.js';

// Every signature piece is a real shop item, never an unobtainable bot exclusive.
export const RIVALS = [
  ['Crown Collector', 'A royal finish-line flex.', 12, 5, 9, 16],
  ['Neon Nomad', 'Street stripes and a rocket pack.', 24, 10, 18, 6],
  ['Golden Groove', 'Bring your own victory soundtrack.', 32, 14, 6, 12],
  ['Rose Halo', 'Float through the chaos in pink.', 3, 19, 15, 18],
  ['Mint Magician', 'Top-hat trouble, trail-ready soles.', 28, 12, 12, 4],
  ['Flame Runner', 'Fast shoes. Louder colors.', 35, 8, 17, 7],
  ['Midnight Monarch', 'Dark checks and a gold crown.', 16, 4, 8, 15],
  ['Ivory Echo', 'A bright suit with a boom box.', 27, 17, 2, 13],
  ['Crimson Captain', 'Camo cargo meets street style.', 39, 11, 14, 9],
  ['Emerald Ace', 'Green stripes. Championship energy.', 21, 6, 19, 11],
  ['Ocean Trickster', 'Blue checks and jester mischief.', 14, 3, 11, 8]
].map(([name, description, outfit, hat, shoes, pack]) => ({
  name, description, loadout: {outfit: `outfit-${outfit}`, hat: `hat-${hat}`, shoes: `shoes-${shoes}`, pack: `pack-${pack}`}
}));

export function missingLookCost(rival, profile) {
  return Object.values(rival.loadout).reduce((sum, id) => sum + (profile.owned.includes(id) ? 0 : CATALOG.find(i => i.id === id).price), 0);
}

export function renderRivalShop(container, profile, {preview, purchase}) {
  const intro = document.createElement('section');
  intro.className = 'rival-intro';
  const title = document.createElement('h3'); title.textContent = 'Race them. Earn their style.';
  const text = document.createElement('p');
  text.textContent = '11 signature bot looks. Every piece is available for earned game cash. Cosmetics change your look; Perks & upgrades improve speed, jumping, dash recharge and coin pickup.';
  const rewards = document.createElement('p');
  rewards.textContent = 'EARN CASH: 5 per coin · 100 first-place bonus · 50 other finishes. No real-money purchases.';
  intro.append(title, text, rewards); container.append(intro);
  for (const rival of RIVALS) {
    const card = document.createElement('article'); card.className = 'shop-card rival-card';
    const outfit = CATALOG.find(i => i.id === rival.loadout.outfit);
    const swatches = document.createElement('div'); swatches.className = `rival-swatch pattern-${outfit.variant}`;
    for (const [slot, id] of Object.entries(rival.loadout)) {
      const item = CATALOG.find(i => i.id === id);
      const swatch = document.createElement('span');
      swatch.style.backgroundColor = item.color; swatch.title = item.name;
      swatch.textContent = slot; swatches.append(swatch);
    }
    const name = document.createElement('h3'); name.textContent = rival.name;
    const description = document.createElement('p'); description.textContent = rival.description;
    const cost = missingLookCost(rival, profile);
    const goal = document.createElement('p'); goal.className = 'rival-goal';
    goal.textContent = cost ? `Look goal: ${cost} cash · ${Math.max(0, cost - profile.cash)} more to earn` : 'Full look collected!';
    const progress = document.createElement('progress');
    progress.max = 4; progress.value = Object.values(rival.loadout).filter(id => profile.owned.includes(id)).length;
    progress.setAttribute('aria-label', `${rival.name} pieces owned`);
    const tryOn = document.createElement('button'); tryOn.textContent = 'Try on full look';
    tryOn.addEventListener('click', () => preview(rival));
    card.append(swatches, name, description, goal, progress, tryOn);
    for (const id of Object.values(rival.loadout)) {
      const item = CATALOG.find(i => i.id === id), owned = profile.owned.includes(id);
      const equipped = profile.equipped[item.slot] === id;
      const button = document.createElement('button');
      button.className = 'rival-piece';
      button.textContent = `${item.name} · ${equipped ? 'Equipped' : owned ? 'Equip' : `${item.price} cash`}`;
      button.disabled = equipped || (!owned && profile.cash < item.price);
      button.addEventListener('click', () => purchase(owned ? 'equip' : 'buy', {item: id}));
      card.append(button);
    }
    container.append(card);
  }
}

export function upgradeGoal(key, profile) {
  const upgrade = UPGRADES[key], level = profile.upgrades[key] || 0;
  if (level >= upgrade.max) return 'Fully upgraded';
  const remaining = Math.max(0, upgrade.cost(level) - profile.cash);
  return remaining ? `${remaining} more cash to earn` : 'Ready to upgrade';
}
