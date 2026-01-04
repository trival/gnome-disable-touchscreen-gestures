# Implementation Details: Disable Touchscreen Gestures GNOME Extension

## Research Summary

This document contains comprehensive technical details about implementing a GNOME Shell extension to disable multi-touch touchscreen gestures on Wayland.

## Problem Statement

### The Issue
When using multi-finger touch input on a touchscreen (e.g., MIDI controller GUI applications), GNOME Shell's gesture recognition system intercepts 3+ finger touches and triggers system actions:
- 3-finger swipe up → Opens Activities panel
- 4-finger swipe → Switches workspaces
- Application loses focus when these gestures trigger

### Why Existing Solutions Don't Work
**Existing touchpad gesture extensions don't affect touchscreens** because touchpad and touchscreen gestures use completely different code paths in GNOME Shell.

## Touchscreen vs Touchpad Gesture Handling

### Critical Architectural Difference

#### Touchpad Gestures
- **Processing layer**: libinput (input device level)
- **Behavior**: libinput interprets multi-finger gestures before events reach GNOME Shell
- **Event types**: Pre-processed gesture events
  - `Clutter.EventType.TOUCHPAD_SWIPE`
  - `Clutter.EventType.TOUCHPAD_PINCH`
- **Signal access**: `global.stage` signal `capture-event::touchpad`
- **Characteristics**: Gestures are already recognized when they arrive at compositor

#### Touchscreen Gestures
- **Processing layer**: GNOME Shell / Mutter (compositor level)
- **Behavior**: libinput does NOT interpret touchscreen gestures
- **Event types**: Raw touch point events
  - `Clutter.EventType.TOUCH_BEGIN` - New touch point makes contact
  - `Clutter.EventType.TOUCH_UPDATE` - Touch point moves
  - `Clutter.EventType.TOUCH_END` - Touch point lifts
  - `Clutter.EventType.TOUCH_CANCEL` - Touch sequence cancelled
- **Gesture recognition**: Performed by GNOME Shell's gesture layer (ClutterGestureAction, SwipeTracker)
- **Characteristics**: Better native support, more flexible gesture recognition

### Why This Matters
Since touchscreen gestures are recognized by GNOME Shell itself (not libinput), we can disable the gesture recognition layer directly in GNOME Shell. Touchpad gesture extensions that work at the event filtering level don't affect touchscreens because they're intercepting different event types.

## GNOME Shell Gesture Recognition Architecture

### Gesture Handling Components

#### 1. ClutterGestureAction
- Base class for gesture recognition in Clutter (GNOME Shell's UI toolkit)
- Attached to `global.stage` as actions
- Can be enabled/disabled via `.enabled` property
- Used for swipe, pinch, zoom, and other multi-touch gestures

#### 2. SwipeTracker
GNOME Shell's high-level swipe gesture handler. Key instances:
- **`Main.overview._swipeTracker`**: Handles vertical swipe to open Activities panel
- **`Main.wm._workspaceAnimation._swipeTracker`**: Handles horizontal swipe for workspace switching
- Both have `.enabled` property for toggling

#### 3. Touch Event Sequences
Each touch point has a unique sequence identifier:
- Multiple simultaneous touches = multiple active sequences
- Tracking active sequences allows detection of multi-touch gestures
- Can intercept at `global.stage` level using `captured-event` signal

## Implementation Approaches

### Approach 1: Disable All Stage Actions (Recommended)
**Mechanism**: Disable all ClutterGestureAction instances on `global.stage`

```javascript
// Save original state
this._savedState = [];
global.stage.get_actions().forEach(action => {
  this._savedState.push({
    action: action,
    wasEnabled: action.enabled
  });
  action.enabled = false;
});
```

**Advantages**:
- Simple and comprehensive
- Affects both touchscreen and touchpad gestures
- Minimal code

**Disadvantages**:
- Disables ALL gestures globally
- May affect gestures you want to keep

### Approach 2: Target Specific SwipeTrackers
**Mechanism**: Disable only the SwipeTracker instances causing issues

```javascript
// Disable Activities panel swipe
if (Main.overview._swipeTracker) {
  Main.overview._swipeTracker.enabled = false;
}

// Disable workspace switching swipe
if (Main.wm._workspaceAnimation?._swipeTracker) {
  Main.wm._workspaceAnimation._swipeTracker.enabled = false;
}
```

**Advantages**:
- Targeted approach
- May preserve other gestures

**Disadvantages**:
- More fragile (internal API changes)
- May miss some gesture handlers
- More complex state management

### Approach 3: Low-Level Event Interception
**Mechanism**: Intercept touch events at stage level before gesture recognition

```javascript
this._captureEventId = global.stage.connect('captured-event', (actor, event) => {
  let type = event.type();
  if (type === Clutter.EventType.TOUCH_BEGIN ||
      type === Clutter.EventType.TOUCH_UPDATE ||
      type === Clutter.EventType.TOUCH_END) {
    // Track simultaneous touches
    // Block events for 3+ finger gestures
    // Return Clutter.EVENT_STOP to block
  }
  return Clutter.EVENT_PROPAGATE;
});
```

**Advantages**:
- Maximum control
- Can selectively block only multi-finger gestures
- Can allow 2-finger gestures while blocking 3+

**Disadvantages**:
- Most complex to implement correctly
- Need to track all active touch sequences
- May miss gestures if logic is incomplete

### Chosen Implementation: Hybrid Approach
**Combination of Approach 1 + Approach 2 + Focus Monitoring**

1. Disable all stage actions (comprehensive coverage)
2. Explicitly disable SwipeTracker instances (redundancy for critical gestures)
3. Monitor focus changes to re-apply disabling (handles edge cases)

This provides maximum reliability while maintaining code simplicity.

## GNOME Extension Structure

### Required Files

#### metadata.json
Extension manifest following GNOME 45+ format:

```json
{
  "uuid": "disable-touchscreen-gestures@yourname.com",
  "name": "Disable Touchscreen Gestures",
  "description": "Disables multi-touch touchscreen gestures to prevent Activities panel from appearing",
  "shell-version": ["45", "46"],
  "url": "https://github.com/yourname/disable-touchscreen-gestures"
}
```

**Key requirements**:
- `uuid` must match extension directory name
- `shell-version` array lists compatible GNOME Shell versions
- No settings/prefs files needed for simple on/off approach

#### extension.js
Main extension code using GNOME 45+ ESModule syntax:

```javascript
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class DisableTouchscreenGestures extends Extension {
  enable() {
    // Called when extension is enabled
  }

  disable() {
    // Called when extension is disabled
  }
}
```

**Legacy vs Modern Syntax**:
- GNOME 45+ uses ESModules (`import`/`export`)
- Pre-GNOME 45 used CommonJS-style requires
- This implementation targets GNOME 45+ only

## Detailed Implementation

### Extension Class Implementation

```javascript
export default class DisableTouchscreenGestures extends Extension {
  enable() {
    this._savedState = [];

    // Initial disable
    this._disableGestures();

    // Monitor focus changes to re-apply disabling
    this._focusWindowId = global.display.connect(
      'notify::focus-window',
      this._disableGestures.bind(this)
    );

    // Monitor fullscreen changes
    this._fullscreenId = global.display.connect(
      'in-fullscreen-changed',
      this._disableGestures.bind(this)
    );
  }

  _disableGestures() {
    // Clear any existing saved state
    this._savedState = [];

    // Disable all gesture actions on the stage
    global.stage.get_actions().forEach(action => {
      this._savedState.push({
        action: action,
        wasEnabled: action.enabled
      });
      action.enabled = false;
    });

    // Also explicitly disable SwipeTracker instances
    try {
      if (Main.overview._swipeTracker) {
        Main.overview._swipeTracker.enabled = false;
      }
    } catch (e) {
      console.warn('Could not disable overview swipe tracker:', e);
    }

    try {
      if (Main.wm._workspaceAnimation?._swipeTracker) {
        Main.wm._workspaceAnimation._swipeTracker.enabled = false;
      }
    } catch (e) {
      console.warn('Could not disable workspace animation swipe tracker:', e);
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

    // Re-enable SwipeTrackers
    try {
      if (Main.overview._swipeTracker) {
        Main.overview._swipeTracker.enabled = true;
      }
    } catch (e) {
      console.warn('Could not re-enable overview swipe tracker:', e);
    }

    try {
      if (Main.wm._workspaceAnimation?._swipeTracker) {
        Main.wm._workspaceAnimation._swipeTracker.enabled = true;
      }
    } catch (e) {
      console.warn('Could not re-enable workspace animation swipe tracker:', e);
    }
  }
}
```

### Key Implementation Details

#### State Management
- `this._savedState`: Array storing original enabled state of each action
- Allows clean restoration when extension is disabled
- Prevents permanently breaking gesture system

#### Signal Handling
- `notify::focus-window`: Triggered when window focus changes
- `in-fullscreen-changed`: Triggered when fullscreen state toggles
- Both re-call `_disableGestures()` to handle edge cases where gestures might re-enable

#### Error Handling
- SwipeTracker access wrapped in try-catch blocks
- GNOME Shell internal APIs may change between versions
- Warnings logged but extension continues functioning
- Prevents extension crash from API changes

#### Why Re-apply on Focus Changes
Some applications or GNOME Shell actions might re-enable gesture actions:
- Fullscreen transitions
- Window management operations
- Extension conflicts
- Signal handlers catch these and re-disable

## Installation and Deployment

### Directory Structure
```
~/code/config/gnome-disable-touchscreen-gestures/
├── .git/                    # Git repository
├── README.md               # User documentation
├── implementation.md       # This file (technical docs)
├── metadata.json          # Extension manifest
└── extension.js           # Main extension code
```

### Symlink Setup
GNOME Shell loads extensions from:
- **System**: `/usr/share/gnome-shell/extensions/`
- **User**: `~/.local/share/gnome-shell/extensions/`

We use a symlink for development:
```bash
ln -s ~/code/config/gnome-disable-touchscreen-gestures \
      ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com
```

**UUID Matching**: The symlink name MUST match the `uuid` in metadata.json

### Installation Steps
1. Clone/create repository in `~/code/config/gnome-disable-touchscreen-gestures/`
2. Create symlink (see command above)
3. Enable extension: `gnome-extensions enable disable-touchscreen-gestures@yourname.com`
4. Log out and log back in (required on Wayland to reload GNOME Shell)

### Testing
Check GNOME Shell logs for errors:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Test gesture disabling:
- Try 3-finger swipe up → Activities should NOT open
- Try 4-finger swipe → Workspaces should NOT switch
- Test individual touches still work in applications

## Compatibility Notes

### GNOME Version Compatibility
- **Tested**: GNOME 45, 46
- **Platform**: Ubuntu 24.04 (GNOME 46)
- **Session**: Wayland (required for proper touchscreen support)
- **X11**: May work but Wayland recommended

### API Stability
**Potentially breaking changes**:
- `Main.overview._swipeTracker` (internal API)
- `Main.wm._workspaceAnimation._swipeTracker` (internal API)
- Action structure on `global.stage`

**Stable APIs**:
- `global.stage.get_actions()` (public API)
- `action.enabled` property (public API)
- Extension lifecycle (`enable()`, `disable()`)

### Future-Proofing
The implementation uses mostly public APIs. If GNOME Shell changes:
1. Try-catch blocks prevent crashes
2. Core functionality (stage actions) should remain stable
3. SwipeTracker disabling is optional redundancy

## Performance Considerations

### Minimal Overhead
- Extension runs only during `enable()` and `disable()` lifecycle
- Signal handlers are lightweight callbacks
- No polling or continuous monitoring
- Negligible performance impact

### Memory Usage
- Stores references to gesture actions
- Stores two signal handler IDs
- Total: <1KB of memory

## Security and Safety

### What This Extension Does
- Disables gesture recognition layer
- Does NOT intercept or log touch data
- Does NOT modify system files
- Does NOT require elevated privileges

### Reversibility
- Completely reversible by disabling extension
- Original gesture states restored
- No permanent changes to system
- Safe to enable/disable repeatedly

## Troubleshooting

### Gestures Still Trigger
**Causes**:
- Extension not properly enabled
- GNOME Shell not restarted (Wayland requires logout)
- Extension crashed (check logs)

**Solutions**:
1. Verify: `gnome-extensions list --enabled | grep disable-touchscreen`
2. Check logs: `journalctl -f -o cat /usr/bin/gnome-shell`
3. Try disabling and re-enabling
4. Log out and log back in

### Extension Won't Enable
**Causes**:
- UUID mismatch between directory name and metadata.json
- Syntax errors in extension.js
- Wrong GNOME Shell version in metadata.json

**Solutions**:
1. Verify UUID matches: `ls ~/.local/share/gnome-shell/extensions/`
2. Check logs for specific error messages
3. Validate JSON syntax in metadata.json

### Touch Input Not Working in Apps
**Should not happen** - extension only disables gesture recognition, not touch input itself.

**If it does occur**:
1. Disable extension to verify it's the cause
2. Check if application has its own gesture handling
3. Report as bug - may need refined implementation

## References and Resources

### Documentation
- [GNOME Extension Development Guide](https://gjs.guide/extensions/)
- [Anatomy of an Extension](https://gjs.guide/extensions/overview/anatomy.html)
- [Port Extensions to GNOME Shell 45](https://gjs.guide/extensions/upgrading/gnome-shell-45.html)
- [Clutter Events Reference](https://developer-old.gnome.org/clutter/stable/clutter-Events.html)
- [Clutter Touch Events](https://valadoc.org/clutter-1.0/Clutter.EventType.TOUCH_BEGIN.html)

### Existing Extensions (Reference)
- [Disable Gestures Wayland](https://github.com/csaladenes/disable-gestures-wayland) - Most comprehensive solution
- [Disable Gestures 2021](https://github.com/VeryCrazyDog/gnome-disable-gestures) - Alternative approach

### GNOME/Mutter Internals
- [Projects/Mutter/Gestures – GNOME Wiki](https://wiki.gnome.org/Projects/Mutter/Gestures)
- [Gestures — libinput documentation](https://wayland.freedesktop.org/libinput/doc/latest/gestures.html)

### Tutorials
- [Hacking the GNOME Shell - Create Extensions](https://itnext.io/hacking-the-gnome-shell-create-extensions-ef3e4ecac325)

## Credits

This implementation is based on research and techniques from:
- csaladenes' Disable Gestures Wayland extension
- VeryCrazyDog's GNOME Disable Gestures extension
- GNOME Shell source code analysis
- libinput gesture handling documentation

## License Considerations

If publishing this extension:
- Choose appropriate open source license (GPL, MIT, etc.)
- Credit referenced extensions and resources
- Follow GNOME extension licensing guidelines
