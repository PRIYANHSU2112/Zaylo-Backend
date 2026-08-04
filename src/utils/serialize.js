export function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeCode(prefix) {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}`;
}

/** Map Mongo doc to API shape with `id` string. */
export function serialize(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = obj._id?.toString?.() || obj.id;
  delete obj._id;
  delete obj.__v;
  delete obj.password;
  return { id, ...obj };
}

export function serializeMany(docs = []) {
  return docs.map(serialize);
}
