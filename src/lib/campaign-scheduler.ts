export interface CampaignEventInput {
  product_id: string;
  group_jid: string;
  batch_index: number;
  send_order: number;
  scheduled_at: Date;
  status: string;
}

// Fisher-Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Random integer between min and max (inclusive)
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Type 2 (Broadcast): One product -> all groups sequentially with random delays
 */
export function generateBroadcastSchedule(
  productIds: string[],
  groupJids: string[],
  startAt: Date,
  delayMinSeconds: number,
  delayMaxSeconds: number,
  jitterSeconds: number = 120,
  waveDelayMinSeconds: number = 60,
  waveDelayMaxSeconds: number = 300,
  waveStartTimes?: Date[]
): CampaignEventInput[] {
  if (productIds.length === 0 || groupJids.length === 0) return [];

  const events: CampaignEventInput[] = [];
  const startJitter = randomInt(0, jitterSeconds);
  let currentScheduledAt = new Date(startAt.getTime() + startJitter * 1000);

  let absoluteOrder = 0;

  for (let pIdx = 0; pIdx < productIds.length; pIdx++) {
    const productId = productIds[pIdx];
    const shuffledGroups = shuffle(groupJids);

    // If manual wave start times are provided, align this wave's start time
    if (waveStartTimes && waveStartTimes[pIdx]) {
      currentScheduledAt = new Date(waveStartTimes[pIdx]);
    }

    for (let gIdx = 0; gIdx < shuffledGroups.length; gIdx++) {
      const groupJid = shuffledGroups[gIdx];

      if (absoluteOrder > 0) {
        if (gIdx === 0) {
          // Only apply inter-wave delay if not manually scheduled
          if (!(waveStartTimes && waveStartTimes[pIdx])) {
            const waveDelay = randomInt(waveDelayMinSeconds, waveDelayMaxSeconds);
            currentScheduledAt = new Date(currentScheduledAt.getTime() + waveDelay * 1000);
          }
        } else {
          // Intra-wave delay applied between messages in the same wave
          const delay = randomInt(delayMinSeconds, delayMaxSeconds);
          currentScheduledAt = new Date(currentScheduledAt.getTime() + delay * 1000);
        }
      }

      events.push({
        product_id: productId,
        group_jid: groupJid,
        batch_index: pIdx,
        send_order: gIdx,
        scheduled_at: new Date(currentScheduledAt),
        status: 'pending',
      });

      absoluteOrder++;
    }
  }

  return events;
}

/**
 * Type 1 (Bulk Product Distribution): Stub for now, implemented in US4
 */
export function generateBulkSchedule(
  productIds: string[],
  groupJids: string[],
  startAt: Date,
  delayMinSeconds: number,
  delayMaxSeconds: number,
  jitterSeconds: number = 120
): CampaignEventInput[] {
  if (productIds.length === 0 || groupJids.length === 0) return [];

  // 1. Shuffle product order
  const shuffledProducts = shuffle(productIds);
  const batchesGroups: string[][] = [];

  // 2. For each product, shuffle group order independently
  for (let i = 0; i < shuffledProducts.length; i++) {
    let currentBatchGroups = shuffle(groupJids);

    // 3. Constraint: if batch[n] last group === batch[n+1] first group OR consecutive batches start with the same group -> reshuffle
    if (i > 0) {
      const prevBatchLastGroup = batchesGroups[i - 1][batchesGroups[i - 1].length - 1];
      const prevBatchFirstGroup = batchesGroups[i - 1][0];
      let attempts = 0;
      // Reshuffle up to 50 times to find a valid arrangement. If groups count is 1, we can't avoid it.
      while (
        (currentBatchGroups[0] === prevBatchLastGroup || currentBatchGroups[0] === prevBatchFirstGroup) &&
        attempts < 50 &&
        groupJids.length > 1
      ) {
        currentBatchGroups = shuffle(groupJids);
        attempts++;
      }
    }

    batchesGroups.push(currentBatchGroups);
  }

  // 4. Calculate cumulative scheduled_at with random delays
  const events: CampaignEventInput[] = [];
  const startJitter = randomInt(0, jitterSeconds);
  let currentScheduledAt = new Date(startAt.getTime() + startJitter * 1000);

  let absoluteOrder = 0;

  for (let pIdx = 0; pIdx < shuffledProducts.length; pIdx++) {
    const productId = shuffledProducts[pIdx];
    const batchGroups = batchesGroups[pIdx];

    for (let gIdx = 0; gIdx < batchGroups.length; gIdx++) {
      const groupJid = batchGroups[gIdx];

      if (absoluteOrder > 0) {
        const delay = randomInt(delayMinSeconds, delayMaxSeconds);
        currentScheduledAt = new Date(currentScheduledAt.getTime() + delay * 1000);
      }

      events.push({
        product_id: productId,
        group_jid: groupJid,
        batch_index: pIdx,
        send_order: gIdx,
        scheduled_at: new Date(currentScheduledAt),
        status: 'pending',
      });

      absoluteOrder++;
    }
  }

  return events;
}
