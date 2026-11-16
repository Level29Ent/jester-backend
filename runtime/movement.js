// Shared by local play and server replay. Speed caps remain unchanged; only
// approach/braking are smoothed. No inertia is added to a neutral lateral axis.
export function steerRacer(p, x, z, speed, dt) {
  if (p.stun > 0) return;
  if (p.dashing) {
    p.vx = x * 22;
    p.vz = (x === 0 && z === 0 ? 1 : z) * 22;
    return;
  }
  const grounded = p.y <= 1.05 && p.vy <= 0;
  const rate = grounded ? 100 : 60;
  const step = Math.max(0, dt) * rate;
  const approach = (value, target) => value + Math.sign(target-value) * Math.min(Math.abs(target-value), step);
  // Release-to-stop remains crisp, particularly on mobile. A held axis eases
  // into starts/reversals rather than instantly changing from -speed to +speed.
  p.vx = x === 0 ? 0 : approach(p.vx, x * speed);
  p.vz = z === 0 ? 0 : approach(p.vz, z * speed);
}
