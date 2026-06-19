// src/ui/components/TypeBadge.js
import { TYPE_COLORS, TYPE_NAMES_PT, TYPE_ICONS } from '../../engine/types.js';

export function TypeBadge(type) {
  const color = TYPE_COLORS[type] || '#888';
  const name  = TYPE_NAMES_PT[type] || type;
  const icon  = TYPE_ICONS[type] || '';
  return `<span class="type-badge" style="background:${color}20; border: 1px solid ${color}80; color:${color};" data-type="${type}">${icon}<span style="margin-left:5px;">${name}</span></span>`;
}

export function TypeBadgeSmall(type) {
  const color = TYPE_COLORS[type] || '#888';
  const icon  = TYPE_ICONS[type] || '';
  return `<span class="type-badge type-badge-sm" style="background:${color}20; border: 1px solid ${color}80; color:${color};" data-type="${type}" title="${TYPE_NAMES_PT[type] || type}">${icon}</span>`;
}

