export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base, suffix) {
  const slug = slugify(base);
  if (suffix) return `${slug}-${suffix.slice(0, 8)}`;
  return slug;
}
