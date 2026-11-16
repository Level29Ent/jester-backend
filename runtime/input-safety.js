// Never let a form/dialog interaction become race movement through a legacy
// keyboard listener, gamepad poll or a previously held touch/keyboard state.
export function gameplayInputAllowed(doc,target=doc.activeElement){
 if(doc.hidden||doc.querySelector('dialog[open]'))return false;
 if(target?.closest?.('input,select,textarea,[contenteditable="true"]'))return false;
 // Visible legacy overlays use hidden rather than native <dialog>.
 for(const id of ['instructions','profile-dialog','global-dialog','store-dialog','signin-dialog']){const node=doc.getElementById(id);if(node&&!node.hidden)return false;}
 return true;
}
export function raceKey(room){return `${room.code}:${room.round}:${room.course}:${room.raceId??''}`;}
