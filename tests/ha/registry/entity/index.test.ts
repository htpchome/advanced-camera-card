import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityRegistryManagerLive } from '../../../../src/ha/registry/entity';
import { EntityCache } from '../../../../src/ha/registry/entity/types';
import { homeAssistantWSRequest } from '../../../../src/ha/ws-request';
import { createHASS, createRegistryEntity } from '../../../test-utils.js';

vi.mock('../../../../src/ha/ws-request');
vi.spyOn(global.console, 'warn').mockImplementation(() => true);

describe('EntityRegistryManager', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntity', () => {
    it('should not fetch when cached', async () => {
      const cache = new EntityCache();
      const testEntity = createRegistryEntity({ entity_id: 'test' });

      cache.set('test', testEntity);

      const manager = new EntityRegistryManagerLive(cache);
      expect(await manager.getEntity(createHASS(), 'test')).toEqual(testEntity);

      expect(homeAssistantWSRequest).not.toHaveBeenCalled();
    });

    it('should fetch and cache when not cached', async () => {
      const testEntity = createRegistryEntity({ entity_id: 'test' });

      const manager = new EntityRegistryManagerLive(new EntityCache());
      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(testEntity);

      expect(await manager.getEntity(createHASS(), 'test')).toEqual(testEntity);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      expect(await manager.getEntity(createHASS(), 'test')).toEqual(testEntity);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);
    });

    it('should return null when entity does not exist', async () => {
      vi.mocked(homeAssistantWSRequest).mockRejectedValueOnce(new Error('Not found'));

      const manager = new EntityRegistryManagerLive(new EntityCache());
      expect(await manager.getEntity(createHASS(), 'missing')).toBeNull();

      vi.mocked(expect(console.warn)).toBeCalledWith('Not found');
    });
  });

  it('getEntities', async () => {
    const cachedEntity = createRegistryEntity({ entity_id: 'cached' });
    const notCachedEntity = createRegistryEntity({ entity_id: 'not-cached' });

    const cache = new EntityCache();
    cache.set('cached', cachedEntity);

    const manager = new EntityRegistryManagerLive(cache);
    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(notCachedEntity);
    vi.mocked(homeAssistantWSRequest).mockRejectedValueOnce(new Error('Not found'));

    expect(
      await manager.getEntities(createHASS(), ['cached', 'not-cached', 'missing']),
    ).toEqual(
      new Map([
        ['cached', cachedEntity],
        ['not-cached', notCachedEntity],
      ]),
    );

    vi.mocked(expect(console.warn)).toBeCalledWith('Not found');
  });

  describe('fetchEntityList', async () => {
    it('should fetch entire entity list once', async () => {
      const hass = createHASS();
      const entity = createRegistryEntity({ entity_id: 'cached' });
      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce([entity]);

      const manager = new EntityRegistryManagerLive(new EntityCache());

      await manager.fetchEntityList(hass);

      expect(homeAssistantWSRequest).toBeCalledTimes(1);
      expect(homeAssistantWSRequest).toBeCalledWith(
        expect.anything(),
        expect.anything(),
        {
          type: 'config/entity_registry/list',
        },
      );

      expect(await manager.getEntity(hass, 'cached')).toEqual(entity);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      await manager.fetchEntityList(hass);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);
    });

    it('should log to console on error', async () => {
      const hass = createHASS();
      vi.mocked(homeAssistantWSRequest).mockRejectedValueOnce(new Error('Fetch error'));

      const manager = new EntityRegistryManagerLive(new EntityCache());

      await manager.fetchEntityList(hass);

      vi.mocked(expect(console.warn)).toBeCalledWith('Fetch error');
    });
  });

  it('getMatchingEntities', async () => {
    const matchingEntity = createRegistryEntity({ entity_id: 'matching' });
    const notMatchingEntity = createRegistryEntity({ entity_id: 'not-matching' });
    const hass = createHASS();

    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce([
      matchingEntity,
      notMatchingEntity,
    ]);

    const manager = new EntityRegistryManagerLive(new EntityCache());
    expect(
      await manager.getMatchingEntities(
        hass,
        (entity) => entity.entity_id == 'matching',
      ),
    ).toEqual([matchingEntity]);
  });
});
