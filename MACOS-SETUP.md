# macOS Setup Instructions

## Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build the Application
```bash
npm run build
```

This will create the necessary files in:
- `dist/` - React frontend
- `dist-electron/` - Electron backend

### Step 3: Run the Application

**Option A: Development Mode (with hot-reload)**
```bash
npm run dev
```

**Option B: Production Mode (using built files)**
```bash
npm run run-prod
```

**Option C: Use the stealth-run script**
```bash
chmod +x stealth-run.sh
./stealth-run.sh
```

## ⚠️ IMPORTANT: Window is Invisible by Default!

The application launches in invisible mode. To see the window:

**Press: `Cmd + B`** (or `Ctrl + B`)

You can use this shortcut repeatedly to show/hide the window.

### Application Icon in Dock

The application **now appears in the Dock** (bottom bar) so you can:
- Right-click the icon → Quit
- Click and drag to Trash (while running)
- Easily identify when the app is running

This makes it much easier to quit the application if needed!

### If Window Still Doesn't Appear

1. Check if window is off-screen:
   - Try using `Cmd + →` or `Cmd + ←` to move the window
   - The window might be positioned outside your screen bounds

2. Check window opacity:
   - Press `Cmd + ]` multiple times to increase opacity
   - The window might be fully transparent

3. Check Dock:
   - Look for the "Interview Coder" icon in the Dock
   - Right-click it to Quit if window is not responding

4. Force restart:
   ```bash
   # Kill any running instances
   pkill -f "Interview Coder"
   pkill -f "electron.*main.js"
   
   # Then run again
   npm run run-prod
   ```

## Step 4: Configure API Key

After opening the window (Cmd+B):

1. **If first time:**
   - You'll see a welcome screen with "Open Settings" button
   - Click "Open Settings"
   
2. **If already running:**
   - Click the **Settings** icon (⚙️) in the top-right corner
   
3. **In Settings window:**
   - Select **API Provider** (OpenAI, Gemini, or Anthropic)
   - Enter your **API Key** in the password field
   - Optionally select models for Extraction, Solution, and Debugging
   - Click **"Save Settings"**
   - The app will automatically reload

## Essential Keyboard Shortcuts

- **`Cmd + B`** - Show/Hide window (MOST IMPORTANT!)
- **`Cmd + H`** - Take screenshot
- **`Cmd + L`** - Delete last screenshot
- **`Cmd + Enter`** - Process screenshots (generate solution)
- **`Cmd + R`** - Reset (new problem)
- **`Cmd + Q`** - Quit application (graceful)
- **`Cmd + Shift + Q`** - Force quit application (emergency kill)
- **`Cmd + [ / ]`** - Decrease/Increase window opacity
- **Arrow keys with `Cmd`** - Move window

## Quitting the Application

You have multiple ways to quit:

1. **Keyboard shortcut:** `Cmd + Q` (graceful quit)
2. **Emergency kill:** `Cmd + Shift + Q` (force quit if stuck)
3. **Dock icon:** Right-click the icon in Dock → Quit
4. **Activity Monitor:** Find "Interview Coder" and force quit

## macOS Permissions

You may need to grant permissions:

### Screen Recording (Required for Screenshots)
1. System Settings → Privacy & Security → Screen Recording
2. Add Terminal (or the Electron app if it appears)
3. Restart the application after granting permission

### Files and Folders (Optional)
If needed: System Settings → Privacy & Security → Files and Folders

## Building DMG Installer

To create a `.dmg` file for installation:

```bash
npm run package-mac
```

The DMG file will be in the `release/` directory as:
- `Interview-Coder-arm64.dmg` (for Apple Silicon - M1/M2/M3)
- `Interview-Coder-x64.dmg` (for Intel Macs)

### Installing from DMG

1. Double-click the DMG file
2. Drag "Interview Coder" to Applications folder
3. Eject the DMG
4. Open Applications and launch "Interview Coder"
5. **Remember: Press `Cmd + B` to show the window!**

## Troubleshooting

### Window Not Visible?
- Press `Cmd + B` multiple times
- Try `Cmd + ]` to increase opacity
- Check Dock for the app icon - right-click to quit if needed
- Check Activity Monitor to verify the app is running
- The window might be off-screen - use arrow keys with Cmd to move it

### App Won't Quit?
- Use `Cmd + Shift + Q` for emergency force quit
- Right-click the Dock icon → Quit
- **Force Quit Applications** (`Cmd + Option + Esc`) → Look for "Int" → Force Quit
- Activity Monitor → Search for "Int" → Force Quit

### Killing "Electron Helper (Plugin)" Processes

If you see "Electron Helper (Plugin)" processes using resources and can't identify which app they belong to:

**Step 1: Identify all Electron Helper (Plugin) processes and their parent apps**
```bash
ps -axo pid,ppid,comm | grep -i "Electron Helper (Plugin)" | grep -v grep | while read pid ppid comm; do
  parent=$(ps -o comm= -p $ppid 2>/dev/null | head -1)
  echo "PID=$pid PPID=$ppid PARENT=$parent"
done
```

**Step 2: Find processes belonging to "Int" app**
```bash
# Look for processes with "Int" or "interview-coder" in their path
ps aux | grep -i "Int\|interview-coder" | grep -v grep | grep -v "Brave\|Cursor\|Slack"
```

**Step 3: Kill all processes for a specific PID (replace 12345 with actual PID)**
```bash
PID=12345
# First, try graceful termination
kill -TERM $PID
kill -TERM $(ps -o ppid= -p $PID | tr -d ' ')

# Wait a few seconds, then force kill if needed
sleep 2
kill -9 $PID 2>/dev/null
kill -9 $(ps -o ppid= -p $PID | tr -d ' ') 2>/dev/null
```

**Step 4: Kill all Electron Helper processes (BE CAREFUL - kills ALL Electron apps)**
```bash
# Only use this if you want to kill ALL Electron apps (Brave, Cursor, Slack, etc.)
pkill -9 "Electron Helper (Plugin)"
```

**Step 5: Kill specific app by bundle path (safest method)**
```bash
# Find the bundle path
lsof -p <PID> | grep "\.app/Contents/MacOS" | head -1

# If it's the Int app, kill it
pkill -9 -f "interview-coder\|Int\.app"
```

### Build Errors?
```bash
npm run clean
npm run build
npm run run-prod
```

### API Key Issues?
- Verify the key is correct
- Check if you have credits/limits in your API account
- Try logging out and back in (Log Out button in Settings)
- Configuration is saved at: `~/Library/Application Support/interview-coder-v1/config.json`

### Console Errors?
Most console messages are informational. Errors related to window visibility have been fixed. If you see persistent errors, check:
- Node.js version (should be v16+)
- All dependencies installed (`npm install`)
- macOS version compatibility

## Configuration File Location

Your settings are stored in:
```
~/Library/Application Support/interview-coder-v1/config.json
```

You can manually edit this file if needed, but restart the app afterward.

## You're Ready! 🎉

The application should now work. Remember:
1. Use **`Cmd + B`** to show the window
2. Enter your API Key in Settings
3. Take screenshot of the problem (`Cmd + H`)
4. Process it (`Cmd + Enter`)
5. **The app icon appears in Dock** - easy to quit anytime!

Good luck with your interviews! 🚀
