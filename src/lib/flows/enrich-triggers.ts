export async function enrichTriggersWithRates(
  triggers: any[],
  fetchRates: (triggerId: string) => Promise<any[]>
) {
  return Promise.all(
    triggers.map(async (t) => {
      if (t.trigger_variants && t.trigger_variants.length > 0) {
        const rates = await fetchRates(t.id);
        return { ...t, rates };
      }
      return t;
    })
  );
}
