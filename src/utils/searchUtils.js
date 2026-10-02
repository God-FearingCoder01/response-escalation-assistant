/**
 * Helper utility to prioritize templates when searching.
 * Templates matching by template name are ranked higher than templates matching only by body or category.
 * Exact name match > Starts-with name match > Contains name match > Category match > Body match.
 */
export function sortTemplatesBySearchRelevance(templates, searchQuery) {
  if (!templates || !Array.isArray(templates) || templates.length === 0) return [];
  const q = (searchQuery || "").trim().toLowerCase();
  if (!q) return templates;

  const getRankScore = (t) => {
    const name = (t.name || "").toLowerCase().trim();
    const body = (t.body || "").toLowerCase();
    const cat = (t.category || "").toLowerCase();
    const subcat = (t.subcategory || "").toLowerCase();

    // 1. Exact match on template name
    if (name === q) return 1;

    // 2. Template name starts with search query
    if (name.startsWith(q)) return 2;

    // 3. Template name contains search query
    if (name.includes(q)) return 3;

    // 4. Exact category / subcategory match
    if (cat === q || subcat === q) return 4;

    // 5. Category / subcategory starts with search query
    if (cat.startsWith(q) || subcat.startsWith(q)) return 5;

    // 6. Category / subcategory contains search query
    if (cat.includes(q) || subcat.includes(q)) return 6;

    // 7. Body starts with search query
    if (body.startsWith(q)) return 7;

    // 8. Body contains search query
    if (body.includes(q)) return 8;

    // 9. Default lower priority match
    return 9;
  };

  return [...templates].sort((a, b) => getRankScore(a) - getRankScore(b));
}
