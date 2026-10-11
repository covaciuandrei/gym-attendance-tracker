import { CanDeactivateFn } from '@angular/router';

/** A page that can hold edits the user has not saved yet. */
export interface HasUnsavedChanges {
  /** Asked before the user leaves the page. Returning false keeps them there. */
  canLeave(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => component.canLeave();
