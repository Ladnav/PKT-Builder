// src/ui/components/TypeBadge.js
import { TYPE_COLORS, TYPE_NAMES_PT } from '../../engine/types.js';

export function TypeBadge(type) {
  const color = TYPE_COLORS[type] || '#888';
  const name  = TYPE_NAMES_PT[type] || type;
  return `<span class="type-badge" style="background:${color}20; border: 1px solid ${color}80; color:${color};" data-type="${type}">${name}</span>`;
}

export function TypeBadgeSmall(type) {
  const color = TYPE_COLORS[type] || '#888';
  const name  = TYPE_NAMES_PT[type] || type;
  return `<span class="type-badge type-badge-sm" style="background:${color}20; border: 1px solid ${color}80; color:${color};" data-type="${type}" title="${name}">${name}</span>`;
}

