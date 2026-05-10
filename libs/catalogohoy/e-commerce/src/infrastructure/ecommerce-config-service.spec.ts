// EcommerceConfigService lives in @catalogohoy/ecommerce-config (which has
// no jest infra). Co-located here so it runs in the e-commerce test target.
//
// These tests pin down the CRITICAL data-layer contracts that the editor
// depends on:
//   * `upsertBusinessHours` writes one row per day via UPSERT on the
//     `(tenant_id, day_of_week)` UNIQUE constraint — NOT delete+insert,
//     because the previous implementation could lose data on partial
//     failure between the DELETE and the INSERT.
//   * `getBusinessHours` always returns a 7-row week, falling back to
//     DEFAULT_BUSINESS_HOURS_WEEK for any day the DB is missing.
//   * `updateConfig` only writes the fields the caller passed — empty
//     update objects must NOT touch the DB.

jest.mock('@catalogohoy/core', () => {
  const fakeClient = {
    from: jest.fn(),
  };
  return {
    SupabaseClientProvider: {
      getInstance: () => fakeClient,
      create: () => fakeClient,
    },
    __fakeClient: fakeClient,
  };
});

import {
  BusinessHoursWeek,
  DEFAULT_BUSINESS_HOURS_WEEK,
  EcommerceConfigService,
} from '@catalogohoy/ecommerce-config';

// Pull the shared mock client back out so tests can drive its responses.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __fakeClient } = jest.requireMock('@catalogohoy/core') as {
  __fakeClient: { from: jest.Mock };
};

/** Helper: build a chainable Supabase-style query that resolves to `result`.
 *
 *  Real Supabase queries are thenable — you can `await` the chain itself for
 *  non-terminal calls like `.update({}).eq('id', x)`. We mirror that with a
 *  `.then` shim so awaiting the chain resolves to the canned `result`. */
function buildChain(
  result: { data?: unknown; error?: unknown }
): Record<string, jest.Mock> & { then: jest.Mock } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const make = () => chain;
  chain.select = jest.fn(make);
  chain.eq = jest.fn(make);
  chain.order = jest.fn(make);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.upsert = jest.fn().mockResolvedValue(result);
  chain.insert = jest.fn().mockResolvedValue(result);
  chain.update = jest.fn(make);
  chain.delete = jest.fn(make);
  chain.then = jest.fn(
    (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
  );
  return chain;
}

describe('EcommerceConfigService', () => {
  let service: EcommerceConfigService;

  beforeEach(() => {
    __fakeClient.from.mockReset();
    service = new EcommerceConfigService();
  });

  // ── upsertBusinessHours ─────────────────────────────────────────────
  describe('upsertBusinessHours', () => {
    it('uses upsert with the (tenant_id, day_of_week) onConflict clause', async () => {
      const chain = buildChain({ error: null });
      __fakeClient.from.mockReturnValue(chain);

      const week: BusinessHoursWeek = DEFAULT_BUSINESS_HOURS_WEEK.map((d) => ({
        ...d,
      }));
      const result = await service.upsertBusinessHours('42', week);

      expect(__fakeClient.from).toHaveBeenCalledWith('tenant_business_hours');
      expect(chain['upsert']).toHaveBeenCalledTimes(1);
      const [rows, opts] = chain['upsert'].mock.calls[0];
      expect(opts).toEqual({ onConflict: 'tenant_id,day_of_week' });
      expect(rows).toHaveLength(7);
      expect(result.isRight()).toBe(true);
    });

    it('does NOT issue a separate delete (regression: prior delete+insert lost data on partial failure)', async () => {
      const chain = buildChain({ error: null });
      __fakeClient.from.mockReturnValue(chain);

      await service.upsertBusinessHours('42', DEFAULT_BUSINESS_HOURS_WEEK);

      // The chain helper exposes `delete` — we should never call it.
      expect(chain['delete']).not.toHaveBeenCalled();
    });

    it('serializes each day with snake_case column names', async () => {
      const chain = buildChain({ error: null });
      __fakeClient.from.mockReturnValue(chain);

      const week: BusinessHoursWeek = [
        { dayOfWeek: 1, openTime: '07:30', closeTime: '19:00', isOpen: true },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isOpen: false },
      ];
      await service.upsertBusinessHours('42', week);

      const [rows] = chain['upsert'].mock.calls[0];
      expect(rows).toEqual([
        {
          tenant_id: 42,
          day_of_week: 1,
          open_time: '07:30',
          close_time: '19:00',
          is_open: true,
        },
        {
          tenant_id: 42,
          day_of_week: 6,
          open_time: '09:00',
          close_time: '14:00',
          is_open: false,
        },
      ]);
    });

    it('returns Either.left when supabase reports an error', async () => {
      const chain = buildChain({ error: { message: 'rls denied' } });
      __fakeClient.from.mockReturnValue(chain);

      const result = await service.upsertBusinessHours(
        '42',
        DEFAULT_BUSINESS_HOURS_WEEK
      );

      expect(result.isLeft()).toBe(true);
      result.mapLeft((err) => expect(err.message).toBe('rls denied'));
    });
  });

  // ── getBusinessHours ────────────────────────────────────────────────
  describe('getBusinessHours', () => {
    it('returns a 7-row week filling missing days with defaults', async () => {
      // DB only knows Mon (1) and Tue (2) for this tenant — the other 5 days
      // must come back as DEFAULT_BUSINESS_HOURS_WEEK entries.
      const chain = buildChain({
        data: [
          {
            day_of_week: 1,
            open_time: '07:00',
            close_time: '15:00',
            is_open: true,
          },
          {
            day_of_week: 2,
            open_time: '08:00',
            close_time: '16:00',
            is_open: false,
          },
        ],
        error: null,
      });
      __fakeClient.from.mockReturnValue(chain);

      const result = await service.getBusinessHours('42');

      expect(result.isRight()).toBe(true);
      result.mapRight((week) => {
        expect(week).toHaveLength(7);
        // Persisted days come back from the DB row...
        expect(week[1]).toEqual({
          dayOfWeek: 1,
          openTime: '07:00',
          closeTime: '15:00',
          isOpen: true,
        });
        expect(week[2]).toEqual({
          dayOfWeek: 2,
          openTime: '08:00',
          closeTime: '16:00',
          isOpen: false,
        });
        // ...and the rest fall back to defaults.
        expect(week[0]).toEqual(DEFAULT_BUSINESS_HOURS_WEEK[0]);
        expect(week[5]).toEqual(DEFAULT_BUSINESS_HOURS_WEEK[5]);
      });
    });

    it('returns the full default week when the DB has no rows', async () => {
      const chain = buildChain({ data: [], error: null });
      __fakeClient.from.mockReturnValue(chain);

      const result = await service.getBusinessHours('42');

      result.mapRight((week) => {
        expect(week).toEqual(DEFAULT_BUSINESS_HOURS_WEEK);
      });
    });

    it('surfaces supabase errors as Either.left', async () => {
      const chain = buildChain({ data: null, error: { message: 'boom' } });
      __fakeClient.from.mockReturnValue(chain);

      const result = await service.getBusinessHours('42');

      expect(result.isLeft()).toBe(true);
    });
  });

  // ── updateConfig ────────────────────────────────────────────────────
  describe('updateConfig', () => {
    it('skips the tenant_ecommerce_config write when no fields changed', async () => {
      // The service receives only `tenantId` — no field updates. It should
      // NOT call `.from('tenant_ecommerce_config')` because there is nothing
      // to upsert.
      const result = await service.updateConfig({ tenantId: '42' });

      expect(__fakeClient.from).not.toHaveBeenCalled();
      expect(result.isRight()).toBe(true);
    });

    it('writes only the fields supplied (no clobbering of unrelated columns)', async () => {
      const chain = buildChain({ error: null });
      __fakeClient.from.mockReturnValue(chain);

      await service.updateConfig({
        tenantId: '42',
        themeColor: '#abcdef',
        showCategoriesSection: false,
      });

      expect(__fakeClient.from).toHaveBeenCalledWith('tenant_ecommerce_config');
      const [row, opts] = chain['upsert'].mock.calls[0];
      expect(opts).toEqual({ onConflict: 'tenant_id' });
      expect(row).toEqual({
        tenant_id: 42,
        theme_color: '#abcdef',
        show_categories_section: false,
      });
      // Crucially: no `logo`, `banner`, `social_links`, etc. in the upsert.
      expect(row).not.toHaveProperty('logo');
      expect(row).not.toHaveProperty('banner');
      expect(row).not.toHaveProperty('social_links');
    });

    it('serializes notifyNewOrders to the snake_case notify_new_orders column', async () => {
      const chain = buildChain({ error: null });
      __fakeClient.from.mockReturnValue(chain);

      await service.updateConfig({ tenantId: '42', notifyNewOrders: false });

      expect(__fakeClient.from).toHaveBeenCalledWith('tenant_ecommerce_config');
      const [row] = chain['upsert'].mock.calls[0];
      expect(row).toEqual({
        tenant_id: 42,
        notify_new_orders: false,
      });
    });

    it('updates the tenant name on the tenants table when name is supplied', async () => {
      // First call → tenants update (name).
      // Second call → tenant_ecommerce_config upsert is skipped because no
      // ecommerce-config columns were supplied.
      const tenantChain = buildChain({ error: null });
      __fakeClient.from.mockReturnValueOnce(tenantChain);

      await service.updateConfig({ tenantId: '42', name: 'Nuevo Nombre' });

      expect(__fakeClient.from).toHaveBeenCalledWith('tenants');
      expect(tenantChain['update']).toHaveBeenCalledWith({
        name: 'Nuevo Nombre',
      });
      expect(tenantChain['eq']).toHaveBeenCalledWith('id', '42');
    });
  });
});
