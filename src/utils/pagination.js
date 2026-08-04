/**
 * Offset pagination for admin tables + optional cursor for public lists.
 */

export function parseListQuery(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const sortField = typeof query.sort === 'string' && query.sort ? query.sort : 'createdAt';
  const order = query.order === 'asc' ? 1 : -1;
  const q = typeof query.q === 'string' ? query.q.trim() : '';

  return {
    page,
    limit,
    skip,
    sort: { [sortField]: order },
    q,
    cursor: typeof query.cursor === 'string' ? query.cursor : null,
  };
}

export function buildMeta({ page, limit, total, nextCursor = null }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
    hasMore: page * limit < total || Boolean(nextCursor),
    nextCursor,
  };
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
