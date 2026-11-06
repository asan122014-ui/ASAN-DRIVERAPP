// Older installations have a non-sparse unique driverId index. It enforces
// stronger uniqueness than the current sparse index; never drop it on import.
export async function initializeEnrollmentDriver(Driver) {
  try {
    await Driver.init();
  } catch (error) {
    if (![85, 86].includes(error.code)) throw error;
    const indexes = await Driver.collection.listIndexes().toArray();
    const legacy = indexes.find(index => index.name === 'driverId_1'
      && JSON.stringify(index.key) === JSON.stringify({ driverId: 1 })
      && index.unique === true && !index.sparse && !index.partialFilterExpression && !index.collation);
    if (!legacy) throw error;
    // init stops at the conflict. Explicitly finish every other declared index;
    // any unrelated mismatch still fails rather than weakening a constraint.
    for (const [key, options] of Driver.schema.indexes()) {
      if (JSON.stringify(key) === JSON.stringify({ driverId: 1 }) && options.unique && options.sparse) continue;
      await Driver.collection.createIndex(key, options);
    }
  }
}
