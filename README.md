# Disable Touchscreen Gestures - GNOME Extension

A GNOME Shell extension that disables multi-touch touchscreen gestures system-wide, preventing the Activities panel and other gesture-based system actions from triggering during multi-finger touchscreen input.

## Why This Extension?

### The Problem
When using applications that require multi-finger touchscreen input (MIDI controllers, music production software, drawing apps, etc.), GNOME Shell's built-in gesture recognition intercepts these touches and triggers system actions:

- **3-finger swipe up** → Opens Activities panel
- **4-finger swipe left/right** → Switches workspaces
- **Application loses focus** when these gestures activate

This makes it impossible to use applications that need more than 2 simultaneous touch points.

### The Solution
This extension disables GNOME Shell's gesture recognition layer, allowing applications to receive all touch input without system gestures interfering.

**Important**: Existing touchpad gesture extensions don't solve this problem. Touchpad and touchscreen gestures are handled through completely different code paths in GNOME Shell. This extension specifically targets touchscreen gesture recognition.

## What Gets Disabled

When this extension is enabled:
- Multi-touch system gestures (3+ fingers) are disabled
- Activities panel won't open on 3-finger swipe
- Workspace switching gestures disabled
- **Individual touch points continue working normally**
- Mouse and keyboard input unaffected

When disabled:
- All gestures return to normal behavior

## Compatibility

- **GNOME Shell**: 45, 46
- **Tested on**: Ubuntu 24.04 (GNOME 46)
- **Session**: Wayland (recommended), X11 (may work)
- **Architecture**: Works on all architectures

## Installation

### Prerequisites
- GNOME Shell 45 or 46
- Wayland session (for best touchscreen support)
- Git (for cloning repository)

### Step 1: Clone Repository
```bash
mkdir -p ~/code/config
cd ~/code/config
git clone <your-repo-url> gnome-disable-touchscreen-gestures
```

Or if you have the files locally:
```bash
mkdir -p ~/code/config/gnome-disable-touchscreen-gestures
# Copy files to this directory
```

### Step 2: Create Symlink
GNOME Shell loads extensions from `~/.local/share/gnome-shell/extensions/`. We'll create a symlink from our development directory to this location.

```bash
# Create extensions directory if it doesn't exist
mkdir -p ~/.local/share/gnome-shell/extensions/

# Create symlink (UUID must match metadata.json)
ln -s ~/code/config/gnome-disable-touchscreen-gestures \
      ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com
```

**Important**: The symlink name (`disable-touchscreen-gestures@yourname.com`) must exactly match the `uuid` field in `metadata.json`.

### Step 3: Enable Extension
```bash
gnome-extensions enable disable-touchscreen-gestures@yourname.com
```

### Step 4: Restart GNOME Shell
**On Wayland** (Ubuntu 24.04 default):
- Log out and log back in

**On X11**:
- Press `Alt+F2`
- Type `r` and press Enter

### Step 5: Verify Installation
Check if extension is enabled:
```bash
gnome-extensions list --enabled | grep disable-touchscreen
```

You should see: `disable-touchscreen-gestures@yourname.com`

## Usage

### Enable Gestures Disabling
```bash
gnome-extensions enable disable-touchscreen-gestures@yourname.com
```

Then log out and log back in (Wayland) or restart GNOME Shell (X11).

### Disable Gestures Disabling (Return to Normal)
```bash
gnome-extensions disable disable-touchscreen-gestures@yourname.com
```

Then log out and log back in (Wayland) or restart GNOME Shell (X11).

### Using GNOME Extensions App
You can also enable/disable the extension using the GNOME Extensions application:
1. Open "Extensions" app
2. Find "Disable Touchscreen Gestures"
3. Toggle the switch

**Note**: On Wayland, you'll need to log out/in for changes to take effect.

## Recreating on Other Machines

To set up this extension on another machine:

1. **Copy the repository**:
   ```bash
   # On original machine
   cd ~/code/config
   tar czf gnome-disable-touchscreen-gestures.tar.gz gnome-disable-touchscreen-gestures/

   # Transfer to new machine, then:
   mkdir -p ~/code/config
   cd ~/code/config
   tar xzf gnome-disable-touchscreen-gestures.tar.gz
   ```

   Or use git:
   ```bash
   cd ~/code/config
   git clone <your-repo-url> gnome-disable-touchscreen-gestures
   ```

2. **Create symlink**:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/
   ln -s ~/code/config/gnome-disable-touchscreen-gestures \
         ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com
   ```

3. **Enable extension**:
   ```bash
   gnome-extensions enable disable-touchscreen-gestures@yourname.com
   ```

4. **Log out and log back in**

## How It Works

### Technical Overview
GNOME Shell uses different mechanisms for touchpad vs touchscreen gestures:

- **Touchpad**: Gestures are interpreted by libinput (at input device level) before reaching GNOME Shell
- **Touchscreen**: Raw touch events are sent to GNOME Shell, which performs gesture recognition

This extension works by disabling GNOME Shell's gesture recognition layer:
1. Disables all `ClutterGestureAction` instances on the global stage
2. Explicitly disables `SwipeTracker` instances (Activities panel, workspace switching)
3. Monitors window focus changes to re-apply disabling (handles edge cases)
4. Stores original state for clean restoration when disabled

**Key point**: The extension only disables gesture *recognition*, not touch *input*. Individual touch points continue working normally in applications.

For detailed technical information, see [implementation.md](implementation.md).

## Troubleshooting

### Gestures Still Trigger After Enabling
**Possible causes**:
- Extension not properly enabled
- GNOME Shell not restarted (Wayland requires logout)
- Extension crashed

**Solutions**:
1. Verify extension is enabled:
   ```bash
   gnome-extensions list --enabled | grep disable-touchscreen
   ```

2. Check GNOME Shell logs for errors:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

3. Try disabling and re-enabling:
   ```bash
   gnome-extensions disable disable-touchscreen-gestures@yourname.com
   gnome-extensions enable disable-touchscreen-gestures@yourname.com
   ```

4. Log out and log back in (required on Wayland)

### Extension Won't Enable
**Possible causes**:
- UUID mismatch between symlink name and metadata.json
- Syntax errors in extension.js
- Wrong GNOME Shell version in metadata.json

**Solutions**:
1. Verify UUID matches:
   ```bash
   # Check symlink name
   ls -la ~/.local/share/gnome-shell/extensions/ | grep disable-touchscreen

   # Check metadata.json uuid
   cat ~/code/config/gnome-disable-touchscreen-gestures/metadata.json | grep uuid
   ```
   These must match exactly.

2. Check GNOME Shell version compatibility:
   ```bash
   gnome-shell --version
   ```
   Must be listed in `shell-version` array in metadata.json.

3. Look for specific errors:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell | grep disable-touchscreen
   ```

### Symlink Broken After Update
If system updates break the symlink:
```bash
# Remove old symlink
rm ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com

# Recreate symlink
ln -s ~/code/config/gnome-disable-touchscreen-gestures \
      ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com
```

### Extension Doesn't Persist After Reboot
Ensure extension is enabled and set to auto-start:
```bash
gnome-extensions enable disable-touchscreen-gestures@yourname.com
```

The extension should survive reboots once enabled.

### Touch Input Not Working in Applications
**This should not happen** - the extension only disables gesture recognition, not touch input itself.

If touch input stops working:
1. Disable the extension to verify it's the cause
2. Check if the application has its own gesture handling
3. Report as a bug with specific application details

## Uninstallation

To completely remove the extension:

1. **Disable extension**:
   ```bash
   gnome-extensions disable disable-touchscreen-gestures@yourname.com
   ```

2. **Remove symlink**:
   ```bash
   rm ~/.local/share/gnome-shell/extensions/disable-touchscreen-gestures@yourname.com
   ```

3. **Optionally, remove repository**:
   ```bash
   rm -rf ~/code/config/gnome-disable-touchscreen-gestures
   ```

4. **Log out and log back in** to fully unload the extension

## Development

### Directory Structure
```
~/code/config/gnome-disable-touchscreen-gestures/
├── .git/                    # Git repository
├── README.md               # This file (user documentation)
├── implementation.md       # Technical documentation and research
├── metadata.json          # Extension manifest
└── extension.js           # Main extension code
```

### Modifying the Extension
1. Edit files in `~/code/config/gnome-disable-touchscreen-gestures/`
2. Changes are immediately available (via symlink)
3. Restart GNOME Shell to reload changes:
   - Wayland: Log out and log back in
   - X11: `Alt+F2`, type `r`, Enter

### Testing
Monitor logs in real-time:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Test gesture disabling:
- 3-finger swipe up should NOT open Activities
- 4-finger swipe should NOT switch workspaces
- Individual touches should work normally in apps

## Credits and References

This extension is based on research and techniques from:
- [Disable Gestures Wayland](https://github.com/csaladenes/disable-gestures-wayland) by csaladenes
- [Disable Gestures 2021](https://github.com/VeryCrazyDog/gnome-disable-gestures) by VeryCrazyDog
- [GNOME Extension Development Guide](https://gjs.guide/extensions/)
- GNOME Shell and Mutter source code analysis

## Contributing

Contributions are welcome! Please:
1. Test changes on GNOME 45 and 46
2. Update documentation if adding features
3. Follow existing code style
4. Report bugs with specific details (GNOME version, logs, steps to reproduce)

## License

[Choose appropriate license - e.g., GPL-3.0, MIT, etc.]

## Support

For issues, questions, or suggestions:
- Check [implementation.md](implementation.md) for technical details
- Search existing issues
- Open a new issue with detailed information

## FAQ

### Does this work on X11?
It may work on X11, but Wayland is recommended for proper touchscreen support.

### Will this affect my touchpad?
Yes, touchpad gestures will also be disabled since the extension disables GNOME Shell's gesture recognition system globally.

### Can I make it toggle-able with a keyboard shortcut?
The current version requires enable/disable via command or Extensions app. A keyboard shortcut feature could be added in a future version.

### Does this work with external touchscreens?
Yes, it works with any touchscreen device recognized by GNOME Shell.

### Will future GNOME updates break this?
The extension uses mostly stable public APIs. If GNOME Shell internals change, the extension includes error handling to prevent crashes, though some functionality might be affected. Check for updates after major GNOME releases.
