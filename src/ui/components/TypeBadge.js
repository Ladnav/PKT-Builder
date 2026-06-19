// src/ui/components/TypeBadge.js
import { TYPE_COLORS, TYPE_NAMES_PT, TYPE_ICONS } from '../../engine/types.js';

export function TypeBadge(type) {
  const color = TYPE_COLORS[type] || '#888';
  const name  = TYPE_NAMES_PT[type] || type;
  const icon  = TYPE_ICONS[type] || '?';
  return `<span class="type-badge" style="background:${color}" data-type="${type}"><span style="margin-right:4px">${icon}</span> ${name}</span>`;
}

export function TypeBadgeSmall(type) {
  const color = TYPE_COLORS[type] || '#888';
  const icon  = TYPE_ICONS[type] || '?';
  return `<span class="type-badge type-badge-sm" style="background:${color}" data-type="${type}">${icon}</span>`;
}
