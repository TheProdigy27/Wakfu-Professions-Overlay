import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({ rename: vi.fn(), writeFile: vi.fn() }));
const fsSyncMock = vi.hoisted(() => ({ renameSync: vi.fn(), writeFileSync: vi.fn() }));
vi.mock('node:fs/promises', () => fsMock);
vi.mock('node:fs', () => fsSyncMock);

const { renameWithRetry, writeFileAtomic, writeFileAtomicSync } = await import('../../../src/main/store/atomicWrite');

const fsError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  fsMock.rename.mockReset();
  fsMock.writeFile.mockReset();
  fsSyncMock.renameSync.mockReset();
  fsSyncMock.writeFileSync.mockReset();
});

describe('writeFileAtomicSync', () => {
  it('écrit un fichier temporaire puis le renomme, en réessayant si le fichier est verrouillé', () => {
    fsSyncMock.renameSync.mockImplementationOnce(() => {
      throw fsError('EPERM');
    });
    writeFileAtomicSync('state.json', '{}');
    expect(fsSyncMock.writeFileSync).toHaveBeenCalledWith('state.json.tmp', '{}');
    expect(fsSyncMock.renameSync).toHaveBeenCalledTimes(2);
    expect(fsSyncMock.renameSync).toHaveBeenLastCalledWith('state.json.tmp', 'state.json');
  });

  it('abandonne après le nombre de tentatives prévu, ou tout de suite sur une erreur définitive', () => {
    fsSyncMock.renameSync.mockImplementation(() => {
      throw fsError('EBUSY');
    });
    expect(() => writeFileAtomicSync('state.json', '{}', 2)).toThrow('EBUSY');
    expect(fsSyncMock.renameSync).toHaveBeenCalledTimes(2);
    fsSyncMock.renameSync.mockReset().mockImplementation(() => {
      throw fsError('ENOSPC');
    });
    expect(() => writeFileAtomicSync('state.json', '{}')).toThrow('ENOSPC');
    expect(fsSyncMock.renameSync).toHaveBeenCalledTimes(1);
  });
});

describe('renameWithRetry', () => {
  it('réessaie quand Windows verrouille brièvement le fichier (antivirus, indexeur)', async () => {
    fsMock.rename.mockRejectedValueOnce(fsError('EPERM')).mockRejectedValueOnce(fsError('EBUSY')).mockResolvedValueOnce(undefined);
    await renameWithRetry('a.tmp', 'a');
    expect(fsMock.rename).toHaveBeenCalledTimes(3);
  });

  it('abandonne après le nombre de tentatives prévu', async () => {
    fsMock.rename.mockRejectedValue(fsError('EACCES'));
    await expect(renameWithRetry('a.tmp', 'a', 2)).rejects.toThrow('EACCES');
    expect(fsMock.rename).toHaveBeenCalledTimes(2);
  });

  it('ne réessaie pas une erreur définitive', async () => {
    fsMock.rename.mockRejectedValue(fsError('ENOENT'));
    await expect(renameWithRetry('a.tmp', 'a')).rejects.toThrow('ENOENT');
    fsMock.rename.mockRejectedValue(new Error('sans code'));
    await expect(renameWithRetry('a.tmp', 'a')).rejects.toThrow('sans code');
    expect(fsMock.rename).toHaveBeenCalledTimes(2);
  });
});

describe('writeFileAtomic', () => {
  it('écrit un fichier temporaire puis le renomme', async () => {
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.rename.mockResolvedValue(undefined);
    await writeFileAtomic('data/index.json', '{}');
    expect(fsMock.writeFile).toHaveBeenCalledWith('data/index.json.tmp', '{}');
    expect(fsMock.rename).toHaveBeenCalledWith('data/index.json.tmp', 'data/index.json');
  });
});
