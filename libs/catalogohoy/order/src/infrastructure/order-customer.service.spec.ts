jest.mock('@catalogohoy/core', () => {
  const fakeClient = { from: jest.fn() };
  return {
    SupabaseClientProvider: { getInstance: () => fakeClient },
    __fakeClient: fakeClient,
  };
});

import {
  OrderCustomerService,
  sanitizeCustomerTerm,
} from './order-customer.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __fakeClient } = jest.requireMock('@catalogohoy/core') as {
  __fakeClient: { from: jest.Mock };
};

function chain(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ['select', 'eq', 'or', 'order', 'limit', 'update']) {
    c[m] = jest.fn(() => c);
  }
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return c;
}

describe('OrderCustomerService', () => {
  beforeEach(() => __fakeClient.from.mockReset());

  it('sanitizes characters that break the PostgREST or filter', () => {
    expect(sanitizeCustomerTerm('  Pérez, (Juan)*  ')).toBe('Pérez Juan');
  });

  it('does not query with fewer than 2 characters', async () => {
    const res = await new OrderCustomerService().search(1, 'a');
    expect(__fakeClient.from).not.toHaveBeenCalled();
    expect(res.isRight() && res.value).toEqual([]);
  });

  it('searches name, alias, document and phone digits without the local 0', async () => {
    const c = chain({ data: [{ id: 1, name: 'Saúl' }], error: null });
    __fakeClient.from.mockReturnValue(c);

    const res = await new OrderCustomerService().search(2421, '0424-125');

    expect(__fakeClient.from).toHaveBeenCalledWith('customers');
    expect(c.eq).toHaveBeenCalledWith('tenant_id', 2421);
    expect(c.or).toHaveBeenCalledWith(
      'name.ilike.%0424-125%,nickname.ilike.%0424-125%,document.ilike.%0424-125%,phone.ilike.%424125%'
    );
    expect(res.isRight() && res.value).toEqual([{ id: 1, name: 'Saúl' }]);
  });

  it('skips the phone filter for plain text', async () => {
    const c = chain({ data: [], error: null });
    __fakeClient.from.mockReturnValue(c);
    await new OrderCustomerService().search(1, 'taller');
    expect(c.or).toHaveBeenCalledWith(
      'name.ilike.%taller%,nickname.ilike.%taller%,document.ilike.%taller%'
    );
  });

  it('saves the alias by tenant + phone and ignores empty values', async () => {
    const c = chain({ data: null, error: null });
    __fakeClient.from.mockReturnValue(c);
    const svc = new OrderCustomerService();

    await svc.saveNickname(5, '+58 4241252048', '  ');
    expect(__fakeClient.from).not.toHaveBeenCalled();

    await svc.saveNickname(5, '+58 4241252048', 'Saulacho');
    expect(c.update).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: 'Saulacho' })
    );
    expect(c.eq).toHaveBeenCalledWith('tenant_id', 5);
    expect(c.eq).toHaveBeenCalledWith('phone', '+58 4241252048');
  });
});
