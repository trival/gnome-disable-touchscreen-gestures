import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Disable Touchscreen Gestures Extension
 *
 * Disables GNOME Shell's multi-touch gesture recognition to prevent system gestures
 * (Activities panel, workspace switching) from triggering during multi-finger touch input.
 *
 * Technical approach:
 * 1. Disable all ClutterGestureAction instances on global.stage
 * 2. Explicitly disable SwipeTracker instances (Activities, workspace switching)
 * 3. Monitor focus changes to re-apply disabling (handles edge cases)
 * 4. Store original state for clean restoration on disable
 */
export default class DisableTouchscreenGestures extends Extension {
  enable() {
    this._savedState = [];

    // Initial disable of all gestures
    this._disableGestures();

    // Monitor focus changes to re-apply disabling
    // Some apps or GNOME Shell actions might re-enable gesture actions
    this._focusWindowId = global.display.connect(
      'notify::focus-window',
      this._disableGestures.bind(this)
    );

    // Monitor fullscreen changes
    this._fullscreenId = global.display.connect(
      'in-fullscreen-changed',
      this._disableGestures.bind(this)
    );

    console.log('Disable Touchscreen Gestures: enabled');
  }

  _disableGestures() {
    // Clear any existing saved state
    this._savedState = [];

    // Disable all gesture actions on the stage
    // This is the main mechanism that disables both touchscreen and touchpad gestures
    global.stage.get_actions().forEach(action => {
      this._savedState.push({
        action: action,
        wasEnabled: action.enabled
      });
      action.enabled = false;
    });

    // Also explicitly disable SwipeTracker instances for redundancy
    // These handle the Activities panel and workspace switching specifically

    // Disable Activities overview swipe tracker
    try {
      if (Main.overview._swipeTracker) {
        Main.overview._swipeTracker.enabled = false;
      }
    } catch (e) {
      console.warn('Disable Touchscreen Gestures: Could not disable overview swipe tracker:', e);
    }

    // Disable workspace animation swipe tracker
    try {
      if (Main.wm._workspaceAnimation && Main.wm._workspaceAnimation._swipeTracker) {
        Main.wm._workspaceAnimation._swipeTracker.enabled = false;
      }
    } catch (e) {
      console.warn('Disable Touchscreen Gestures: Could not disable workspace animation swipe tracker:', e);
    }
  }

  disable() {
    // Disconnect signal handlers
    if (this._focusWindowId) {
      global.display.disconnect(this._focusWindowId);
      this._focusWindowId = null;
    }

    if (this._fullscreenId) {
      global.display.disconnect(this._fullscreenId);
      this._fullscreenId = null;
    }

    // Restore original gesture states
    this._savedState.forEach(({action, wasEnabled}) => {
      action.enabled = wasEnabled;
    });
    this._savedState = [];

    // Re-enable SwipeTracker instances
    try {
      if (Main.overview._swipeTracker) {
        Main.overview._swipeTracker.enabled = true;
      }
    } catch (e) {
      console.warn('Disable Touchscreen Gestures: Could not re-enable overview swipe tracker:', e);
    }

    try {
      if (Main.wm._workspaceAnimation && Main.wm._workspaceAnimation._swipeTracker) {
        Main.wm._workspaceAnimation._swipeTracker.enabled = true;
      }
    } catch (e) {
      console.warn('Disable Touchscreen Gestures: Could not re-enable workspace animation swipe tracker:', e);
    }

    console.log('Disable Touchscreen Gestures: disabled');
  }
}
