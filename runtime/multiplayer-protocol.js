import {COURSES} from './course.js';
import {TRACK_VERSION} from './progression.js';
// Deterministic geometry fingerprint, so stale three-course or different-layout
// servers never masquerade as compatible with this renderer.
let hash=2166136261;
for(const char of JSON.stringify(COURSES)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
export const NETWORK_PROTOCOL=`jester-network-3:${TRACK_VERSION}:${(hash>>>0).toString(16)}`;
