import { app, BrowserWindow, screen, shell, type BrowserWindowConstructorOptions } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { ProcessingHelper } from "./ProcessingHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { TranscriptionHelper } from "./TranscriptionHelper"
import { initAutoUpdater } from "./autoUpdater"
import { configHelper } from "./ConfigHelper"
import * as dotenv from "dotenv"

// Constants
const isDev = process.env.NODE_ENV === "development"

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,
  isManuallyResized: false, // Track if user manually resized the window

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as ProcessingHelper | null,
  transcriptionHelper: null as TranscriptionHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as unknown,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => unknown
  setProblemInfo: (info: unknown) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
  resizeWindow: (deltaWidth: number, deltaHeight: number) => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  transcriptionHelper: TranscriptionHelper | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: () => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.transcriptionHelper = new TranscriptionHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step),
    resizeWindow: (deltaWidth: number, deltaHeight: number) => resizeWindow(deltaWidth, deltaHeight)
  } as IShortcutsHelperDeps)
}

// Auth callback handler

// Register the interview-coder protocol
if (process.platform === "darwin") {
  app.setAsDefaultProtocolClient("interview-coder")
} else {
  app.setAsDefaultProtocolClient("interview-coder", process.execPath, [
    path.resolve(process.argv[1] || "")
  ])
}

// Handle the protocol. In this case, we choose to show an Error Box.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("interview-coder", process.execPath, [
    path.resolve(process.argv[1])
  ])
}

// Force Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", (_event, _commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore()
      state.mainWindow.show()
      state.mainWindow.focus()
      state.mainWindow.moveTop()
      state.isWindowVisible = true

      // Protocol handler removed - no longer using auth callbacks
    }
  })
}

// Auth callback removed as we no longer use Supabase authentication

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 60
  state.currentY = 50

  // Calculate 1/4 of screen size
  const windowWidth = Math.floor(workArea.width / 4)
  const windowHeight = Math.floor(workArea.height / 4)

  const windowSettings: BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
    minWidth: 400,
    minHeight: 300,
    maxWidth: undefined, // Allow resizing to any width
    maxHeight: undefined, // Allow resizing to any height
    x: state.currentX,
    y: 50,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    opacity: 0.95,  // Start with 95% opacity (will be overridden by config)
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: false, // Show in Dock so user can easily quit
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true,
    resizable: true // Enable window resizing
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading")
  })
  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      console.error("Window failed to load:", errorCode, errorDescription)
      if (isDev) {
        // In development, retry loading after a short delay
        console.log("Retrying to load development server...")
        setTimeout(() => {
          state.mainWindow?.loadURL("http://localhost:54321").catch((error) => {
            console.error("Failed to load dev server on retry:", error)
          })
        }, 1000)
      }
    }
  )

  if (isDev) {
    // In development, load from the dev server
    console.log("Loading from development server: http://localhost:54321")
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      console.error("Failed to load dev server, falling back to local file:", error)
      // Fallback to local file if dev server is not available
      const indexPath = path.join(__dirname, "../dist/index.html")
      console.log("Falling back to:", indexPath)
      if (fs.existsSync(indexPath)) {
        state.mainWindow.loadFile(indexPath)
      } else {
        console.error("Could not find index.html in dist folder")
      }
    })
  } else {
    // In production, load from the built files
    const indexPath = path.join(__dirname, "../dist/index.html")
    console.log("Loading production build:", indexPath)
    
    if (fs.existsSync(indexPath)) {
      state.mainWindow.loadFile(indexPath)
    } else {
      console.error("Could not find index.html in dist folder")
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1)
  
  // Enable window dragging even without frame - make entire window draggable
  // This will be handled via CSS in the renderer, but we ensure the window is movable
  state.mainWindow.setMovable(true)
  state.mainWindow.setResizable(true)
  
  // DevTools disabled - uncomment the line below if you need to debug
  // if (isDev) {
  //   state.mainWindow.webContents.openDevTools()
  // }
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Attempting to open URL:", url)
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname;
      const allowedHosts = ["google.com", "supabase.co"];
      if (allowedHosts.includes(hostname) || hostname.endsWith(".google.com") || hostname.endsWith(".supabase.co")) {
        shell.openExternal(url);
        return { action: "deny" }; // Do not open this URL in a new Electron window
      }
    } catch (error) {
      console.error("Invalid URL %d in setWindowOpenHandler: %d" , url , error);
      return { action: "deny" }; // Deny access as URL string is malformed or invalid
    }
    return { action: "allow" };
  })

  // Enhanced screen capture resistance (disable when showing window)
  // state.mainWindow.setContentProtection(true) // Will be set when needed

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

  // Additional screen capture settings for macOS
  if (process.platform === "darwin") {
    // Keep visible in Mission Control and App Switcher
    state.mainWindow.setHiddenInMissionControl(false)
    state.mainWindow.setWindowButtonVisibility(false)
    state.mainWindow.setBackgroundColor("#00000000")

    // Show in Dock so user can easily quit the application
    state.mainWindow.setSkipTaskbar(false)
    if (app.dock) {
      app.dock.show()
    }

    // Disable window shadow
    state.mainWindow.setHasShadow(false)
  }

  // Prevent the window from being captured by screen recording
  state.mainWindow.webContents.setBackgroundThrottling(false)
  state.mainWindow.webContents.setFrameRate(60)

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true
  
  // Always keep window visible and listening
  const savedOpacity = configHelper.getOpacity();
  console.log(`Initial opacity from config: ${savedOpacity}`);
  
  // Always show the window - keep it visible all the time
  const finalOpacity = savedOpacity > 0.1 ? savedOpacity : 1.0;
  console.log(`Setting initial opacity to ${finalOpacity} and keeping window visible`);
  state.mainWindow.setOpacity(finalOpacity);
  state.mainWindow.show();
  state.mainWindow.focus();
  state.isWindowVisible = true;
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
  // Mark as manually resized if the size changed significantly (more than 10px difference)
  // This prevents auto-resize from overriding user's manual resize
  state.isManuallyResized = true
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Window visibility functions
function hideMainWindow(): void {
  // Window should always be visible - do nothing
  console.log('hideMainWindow called but window stays visible (always-on mode)');
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    // Ensure window is on primary screen first
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workAreaSize;
    const bounds = state.mainWindow.getBounds();
    
    // If window is off-screen or invalid position, reset to center
    if (bounds.x < -bounds.width || bounds.x > workArea.width || 
        bounds.y < -bounds.height || bounds.y > workArea.height ||
        !state.windowPosition) {
      const windowWidth = state.windowSize?.width || 800;
      const windowHeight = state.windowSize?.height || 600;
      const centerX = Math.floor(workArea.width / 2 - windowWidth / 2);
      const centerY = 50;
      state.mainWindow.setPosition(centerX, centerY);
      console.log(`Window repositioned to center: ${centerX}, ${centerY}`);
    } else if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize
      });
    }
    
    // Configure window properties for visibility BEFORE showing
    state.mainWindow.setIgnoreMouseEvents(false);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    });
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    
    // Disable content protection completely when showing (don't re-enable immediately)
    state.mainWindow.setContentProtection(false);
    
    // Set opacity from config and show the window
    const savedOpacity = configHelper.getOpacity();
    const finalOpacity = savedOpacity > 0.1 ? savedOpacity : 0.95;
    state.mainWindow.setOpacity(finalOpacity);
    state.mainWindow.show();
    state.mainWindow.focus();
    
    // Bring to front forcefully
    state.mainWindow.moveTop();
    
    // Log window position for debugging
    const finalBounds = state.mainWindow.getBounds();
    console.log(`Window shown: position (${finalBounds.x}, ${finalBounds.y}), size ${finalBounds.width}x${finalBounds.height}, opacity: ${state.mainWindow.getOpacity()}`);
    
    state.isWindowVisible = true;
  }
}

function toggleMainWindow(): void {
  // Window should always be visible - just ensure it's shown and focused
  if (!state.mainWindow?.isDestroyed()) {
    console.log('Toggle requested but window stays visible (always-on mode)');
    state.mainWindow.show();
    state.mainWindow.focus();
    state.mainWindow.moveTop();
    state.isWindowVisible = true;
  }
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  state.currentX = updateFn(state.currentX)
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  )
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const newY = updateFn(state.currentY)
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3

  // Log the current state and limits
  console.log({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY
  })

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    )
  }
}

// Window dimension functions
// This is used for automatic content-based sizing, but should not override manual resizing
function setWindowDimensions(width: number, height: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    // Don't auto-resize if user manually resized the window
    if (state.isManuallyResized) {
      console.log('Skipping auto-resize - window was manually resized by user')
      return
    }
    
    const [currentX, currentY] = state.mainWindow.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    
    // Don't limit width - allow full screen width if needed
    // Only ensure it doesn't exceed screen bounds
    const maxWidth = workArea.width - 20 // Small margin from screen edge
    const requestedWidth = width + 32

    state.mainWindow.setBounds({
      x: Math.min(currentX, workArea.width - Math.min(requestedWidth, maxWidth)),
      y: currentY,
      width: Math.min(requestedWidth, maxWidth),
      height: Math.ceil(height)
    })
    
    // Update state to reflect new size
    state.windowSize = { 
      width: Math.min(requestedWidth, maxWidth), 
      height: Math.ceil(height) 
    }
  }
}

// Window resize function
function resizeWindow(deltaWidth: number, deltaHeight: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    
    const newWidth = Math.max(400, Math.min(workArea.width, bounds.width + deltaWidth))
    const newHeight = Math.max(300, Math.min(workArea.height, bounds.height + deltaHeight))
    
    state.mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: newWidth,
      height: newHeight
    })
    
    // Update state and mark as manually resized
    state.windowSize = { width: newWidth, height: newHeight }
    state.isManuallyResized = true
    console.log(`Window resized to ${newWidth}x${newHeight}`)
  }
}

// Environment setup
function loadEnvVariables() {
  if (isDev) {
    console.log("Loading env variables from:", path.join(process.cwd(), ".env"))
    dotenv.config({ path: path.join(process.cwd(), ".env") })
  } else {
    console.log(
      "Loading env variables from:",
      path.join(process.resourcesPath, ".env")
    )
    dotenv.config({ path: path.join(process.resourcesPath, ".env") })
  }
  console.log("Environment variables loaded for open-source version")
}

// Initialize application
async function initializeApp() {
  // Set app name for macOS (visible in Force Quit and Activity Monitor)
  app.setName("Int");
  app.setAboutPanelOptions({
    applicationName: "Int",
    applicationVersion: "1.0.19"
  });
  
  // Ensure the app does NOT auto-start on login/wake (macOS)
  if (process.platform === 'darwin') {
    try {
      app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false });
    } catch (e) {
      console.warn('Could not set login item settings:', e);
    }
  }
  
  try {
    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(app.getPath('appData'), 'interview-coder-v1')
    const sessionPath = path.join(appDataPath, 'session')
    const tempPath = path.join(appDataPath, 'temp')
    const cachePath = path.join(appDataPath, 'cache')
    
    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    
    app.setPath('userData', appDataPath)
    // Do not set unsupported 'sessionData'; pre-create expected subdirectories instead
    app.setPath('temp', tempPath)
    app.setPath('cache', cachePath)

    // Pre-create Chromium session cache structure to avoid cache errors
    // Chromium uses both appDataPath directly and sessionPath for cache
    const sharedDictCacheSession = path.join(sessionPath, 'Shared Dictionary', 'cache')
    const httpCacheDataSession = path.join(sessionPath, 'Cache', 'Cache_Data')
    const sharedDictCacheAppData = path.join(appDataPath, 'Shared Dictionary', 'cache')
    const httpCacheDataAppData = path.join(appDataPath, 'Cache', 'Cache_Data')
    
    for (const dir of [
      sessionPath, 
      sharedDictCacheSession, 
      httpCacheDataSession,
      sharedDictCacheAppData,
      httpCacheDataAppData
    ]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
      
    loadEnvVariables()
    
    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      console.log("No API key found in configuration. User will need to set up.")
    }
    
    initializeHelpers()
    
    // Listen for config updates to update window opacity in real-time
    configHelper.on('config-updated', (newConfig) => {
      if (newConfig.opacity !== undefined && state.mainWindow && !state.mainWindow.isDestroyed()) {
        const opacity = Math.max(0.1, Math.min(1.0, newConfig.opacity));
        state.mainWindow.setOpacity(opacity);
        console.log(`Window opacity updated to ${opacity}`);
      }
    });
    
    // Also listen for opacity changes specifically (even if config-updated is not emitted)
    // We'll handle this in the updateConfig handler
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      transcriptionHelper: state.transcriptionHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    await createWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    console.log(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    console.error("Failed to initialize application:", error)
    app.quit()
  }
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  console.log("open-url event received:", url)
  event.preventDefault()
})

// Handle second instance (removed auth callback handling)
app.on("second-instance", (event, commandLine) => {
  console.log("second-instance event received:", commandLine)
  
  // Focus or create the main window - always ensure it's visible
  if (!state.mainWindow) {
    createWindow()
  } else {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.show()
    state.mainWindow.focus()
    state.mainWindow.moveTop()
    state.isWindowVisible = true
  }
})

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
      state.mainWindow = null
    }
  })
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (state.mainWindow) {
    // Ensure window is always visible when app is activated
    state.mainWindow.show()
    state.mainWindow.focus()
    state.mainWindow.moveTop()
    state.isWindowVisible = true
  }
})

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): unknown {
  return state.problemInfo
}

function setProblemInfo(problemInfo: unknown): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available")
  // Window stays visible during screenshot - pass no-op functions
  return (
    state.screenshotHelper?.takeScreenshot(
      () => { /* Window stays visible */ },
      () => { /* Window stays visible */ }
    ) || ""
  )
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || ""
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  )
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  resizeWindow,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged
}

app.whenReady().then(initializeApp)
