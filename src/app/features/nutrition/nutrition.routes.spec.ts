import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { NUTRITION_ROUTES } from './nutrition.routes';

describe('NUTRITION_ROUTES', () => {
  it('asks before leaving the goals page with unsaved changes', () => {
    const goals = NUTRITION_ROUTES[0].children?.find((route) => route.path === 'goals');

    expect(goals?.canDeactivate).toEqual([unsavedChangesGuard]);
  });
});
