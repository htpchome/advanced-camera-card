import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CameraUIAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getCameraURLManager().openURL();
  }
}
