import { parseRepositoryFullName } from './parse-repository-full-name';

describe('parseRepositoryFullName', () => {
  it('splits owner and name', () => {
    expect(parseRepositoryFullName('acme/api')).toEqual({ owner: 'acme', name: 'api' });
  });

  it('accepts dots, dashes and underscores and trims spaces', () => {
    expect(parseRepositoryFullName('  my-org/repo.name_v2  ')).toEqual({
      owner: 'my-org',
      name: 'repo.name_v2',
    });
  });

  it.each(['', 'acme', 'acme/', '/api', 'acme/api/extra', 'acme api'])('rejects %p', (value) => {
    expect(parseRepositoryFullName(value)).toBeUndefined();
  });
});
