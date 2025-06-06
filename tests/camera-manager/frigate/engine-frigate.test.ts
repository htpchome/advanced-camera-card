import { describe, expect, it } from 'vitest';
import { RecordingSegmentsCache } from '../../../src/camera-manager/cache';
import { FrigateCameraManagerEngine } from '../../../src/camera-manager/frigate/engine-frigate';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
} from '../../../src/camera-manager/frigate/media';
import { FrigateEvent, eventSchema } from '../../../src/camera-manager/frigate/types.js';
import { CameraManagerRequestCache } from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { CameraConfig } from '../../../src/config/schema/cameras';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { TestViewMedia, createCameraConfig, createHASS } from '../../test-utils';

const createEngine = (): FrigateCameraManagerEngine => {
  return new FrigateCameraManagerEngine(
    new EntityRegistryManagerMock(),
    new StateWatcher(),
    new RecordingSegmentsCache(),
    new CameraManagerRequestCache(),
  );
};

const createRecordingMedia = (): FrigateRecordingViewMedia => {
  return new FrigateRecordingViewMedia(
    ViewMediaType.Recording,
    'camera-1',
    {
      cameraID: 'camera-1',
      startTime: new Date('2023-06-16T20:00:00Z'),
      endTime: new Date('2023-06-16T20:59:59Z'),
      events: 1,
    },
    'recording-id',
    'recording-content-id',
    'recording-title',
  );
};

const createEvent = (): FrigateEvent => {
  return eventSchema.parse({
    camera: 'camera-1',
    end_time: 1686974399,
    false_positive: false,
    has_clip: true,
    has_snapshot: true,
    id: 'event-id',
    label: 'person',
    sub_label: null,
    start_time: 1686970800,
    top_score: 0.8,
    zones: [],
    retain_indefinitely: true,
  });
};

const createClipMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Clip,
    'camera-1',
    createEvent(),
    'event-clip-content-id',
    'event-clip-thumbnail',
  );
};

const createSnapshotMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Snapshot,
    'camera-1',
    createEvent(),
    'event-snapshot-content-id',
    'event-snapshot-thumbnail',
  );
};

const createFrigateCameraConfig = (
  config?: RawAdvancedCameraCardConfig,
): CameraConfig => {
  return createCameraConfig({
    frigate: {
      camera_name: 'camera-1',
    },
    camera_entity: 'camera.office',
    ...config,
  });
};

describe('getMediaDownloadPath', () => {
  it('should get event with clip download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createClipMedia(),
    );

    expect(endpoint).toEqual({
      endpoint: '/api/frigate/frigate/notifications/event-id/clip.mp4?download=true',
      sign: true,
    });
  });

  it('should get event with snapshot download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createSnapshotMedia(),
    );

    expect(endpoint).toEqual({
      endpoint: '/api/frigate/frigate/notifications/event-id/snapshot.jpg?download=true',
      sign: true,
    });
  });

  it('should get recording download path', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      createRecordingMedia(),
    );

    expect(endpoint).toEqual({
      endpoint:
        '/api/frigate/frigate/recording/camera-1/start/1686945600/end/1686949199?download=true',
      sign: true,
    });
  });

  it('should get no path for unknown type', async () => {
    const endpoint = await createEngine().getMediaDownloadPath(
      createHASS(),
      createFrigateCameraConfig(),
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-1',
      }),
    );
    expect(endpoint).toBeNull();
  });
});

describe('getCameraEndpoints', () => {
  it('should get basic endpoints', () => {
    const endpoints = createEngine().getCameraEndpoints(createFrigateCameraConfig());

    expect(endpoints).toEqual({
      go2rtc: {
        endpoint: '/api/frigate/frigate/mse/api/ws?src=camera-1',
        sign: true,
      },
      jsmpeg: {
        endpoint: '/api/frigate/frigate/jsmpeg/camera-1',
        sign: true,
      },
      webrtcCard: {
        endpoint: 'camera.office',
      },
    });
  });

  describe('should get overridden go2rtc url', () => {
    it('when local HA path', () => {
      const endpoints = createEngine().getCameraEndpoints(
        createFrigateCameraConfig({
          go2rtc: {
            url: '/local/path',
          },
        }),
      );

      expect(endpoints).toEqual(
        expect.objectContaining({
          go2rtc: {
            endpoint: '/local/path/api/ws?src=camera-1',
            sign: true,
          },
        }),
      );
    });

    it('when remote', () => {
      const endpoints = createEngine().getCameraEndpoints(
        createFrigateCameraConfig({
          go2rtc: {
            url: 'https://my.custom.go2rtc',
          },
        }),
      );

      expect(endpoints).toEqual(
        expect.objectContaining({
          go2rtc: {
            endpoint: 'https://my.custom.go2rtc/api/ws?src=camera-1',
            sign: false,
          },
        }),
      );
    });
  });

  it('should not set webrtc_card endpoint without camera name', () => {
    const endpoints = createEngine().getCameraEndpoints(createCameraConfig());

    expect(endpoints).not.toEqual(
      expect.objectContaining({
        webrtcCard: expect.anything(),
      }),
    );
  });

  describe('should include UI endpoint', () => {
    it('with basic url', () => {
      const endpoints = createEngine().getCameraEndpoints(
        createCameraConfig({
          frigate: {
            url: 'http://my.frigate',
          },
        }),
      );

      expect(endpoints).not.toEqual(
        expect.objectContaining({
          ui: {
            url: 'http://my.frigate',
          },
        }),
      );
    });

    it('with camera name', () => {
      const endpoints = createEngine().getCameraEndpoints(
        createCameraConfig({
          frigate: {
            url: 'http://my.frigate',
            camera_name: 'my-camera',
          },
        }),
      );

      expect(endpoints).not.toEqual(
        expect.objectContaining({
          ui: {
            url: 'http://my.frigate/cameras/my-camera',
          },
        }),
      );
    });

    describe('with event media type', () => {
      it.each([[ViewMediaType.Clip], [ViewMediaType.Snapshot]])(
        '%s',
        (mediaType: ViewMediaType) => {
          const endpoints = createEngine().getCameraEndpoints(
            createCameraConfig({
              frigate: {
                url: 'http://my.frigate',
                camera_name: 'my-camera',
              },
            }),
            {
              media: new TestViewMedia({ mediaType: mediaType }),
            },
          );

          expect(endpoints).not.toEqual(
            expect.objectContaining({
              ui: {
                url: 'http://my.frigate/events?camera=my-camera',
              },
            }),
          );
        },
      );
    });

    describe('with recording media type', () => {
      it('with start time', () => {
        const startTime = new Date('2023-10-07T16:42:00');
        const endpoints = createEngine().getCameraEndpoints(
          createCameraConfig({
            frigate: {
              url: 'http://my.frigate',
              camera_name: 'my-camera',
            },
          }),
          {
            media: new TestViewMedia({
              mediaType: ViewMediaType.Recording,
              startTime: startTime,
            }),
          },
        );

        expect(endpoints).not.toEqual(
          expect.objectContaining({
            ui: {
              url: 'http://my.frigate/recording/my-camera/2023-10-07/16',
            },
          }),
        );
      });

      it('without start time', () => {
        const endpoints = createEngine().getCameraEndpoints(
          createCameraConfig({
            frigate: {
              url: 'http://my.frigate',
              camera_name: 'my-camera',
            },
          }),
          {
            media: new TestViewMedia({ mediaType: ViewMediaType.Recording }),
          },
        );

        expect(endpoints).not.toEqual(
          expect.objectContaining({
            ui: {
              url: 'http://my.frigate/recording/my-camera/',
            },
          }),
        );
      });
    });

    describe('with view', () => {
      it('live', () => {
        const endpoints = createEngine().getCameraEndpoints(
          createCameraConfig({
            frigate: {
              url: 'http://my.frigate',
              camera_name: 'my-camera',
            },
          }),
          {
            view: 'live',
          },
        );

        expect(endpoints).not.toEqual(
          expect.objectContaining({
            ui: {
              url: 'http://my.frigate/cameras/my-camera',
            },
          }),
        );
      });

      it.each([
        ['clip' as const],
        ['clips' as const],
        ['snapshot' as const],
        ['snapshots' as const],
      ])('%s', (viewName: AdvancedCameraCardView) => {
        const endpoints = createEngine().getCameraEndpoints(
          createCameraConfig({
            frigate: {
              url: 'http://my.frigate',
              camera_name: 'my-camera',
            },
          }),
          {
            view: viewName,
          },
        );

        expect(endpoints).not.toEqual(
          expect.objectContaining({
            ui: {
              url: 'http://my.frigate/events?camera=my-camera',
            },
          }),
        );
      });

      it.each([['recording' as const], ['recordings' as const]])(
        '%s',
        (viewName: AdvancedCameraCardView) => {
          const endpoints = createEngine().getCameraEndpoints(
            createCameraConfig({
              frigate: {
                url: 'http://my.frigate',
                camera_name: 'my-camera',
              },
            }),
            {
              view: viewName,
            },
          );

          expect(endpoints).not.toEqual(
            expect.objectContaining({
              ui: {
                url: 'http://my.frigate/recording/my-camera/',
              },
            }),
          );
        },
      );
    });
  });
});
