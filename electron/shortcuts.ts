import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;
    
    let currentOpacity = mainWindow.getOpacity();
    let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    console.log(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);
    
    mainWindow.setOpacity(newOpacity);
    
    // Save the opacity setting to config without re-initializing the client
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      console.error('Error saving opacity to config:', error);
    }
    
    // Window always visible - ensure it's shown and interaction is enabled
    if (newOpacity > 0.1) {
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        console.log("Taking screenshot...")
        try {
          const screenshotPath = await this.deps.takeScreenshot()
          const preview = await this.deps.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.deps.processingHelper?.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(
        "Command + R pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests()

      // Clear both screenshot queues
      this.deps.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.deps.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    })

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      console.log("Command/Ctrl + Left pressed. Moving window left.")
      this.deps.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Right", () => {
      console.log("Command/Ctrl + Right pressed. Moving window right.")
      this.deps.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+Down", () => {
      console.log("Command/Ctrl + down pressed. Moving window down.")
      this.deps.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+Up", () => {
      console.log("Command/Ctrl + Up pressed. Moving window Up.")
      this.deps.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+B", () => {
      console.log("Command/Ctrl + B pressed. Window stays visible (always-on mode).")
      // Window always visible - just ensure it's focused
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.moveTop()
      }
    })

    globalShortcut.register("CommandOrControl+Q", () => {
      console.log("Command/Ctrl + Q pressed. Quitting application.")
      app.quit()
    })

    // Emergency hard-exit shortcut (kills the process even if Electron is stuck)
    globalShortcut.register("CommandOrControl+Shift+Q", () => {
      console.log("Command/Ctrl + Shift + Q pressed. Forcing process exit.")
      try {
        // Attempt graceful quit first
        app.exit(0)
      } catch (e) {
        // Fallback to hard exit
        // eslint-disable-next-line no-process-exit
        process.exit(0)
      }
    })

    // Adjust opacity shortcuts
    globalShortcut.register("CommandOrControl+[", () => {
      console.log("Command/Ctrl + [ pressed. Decreasing opacity.")
      this.adjustOpacity(-0.1)
    })

    globalShortcut.register("CommandOrControl+]", () => {
      console.log("Command/Ctrl + ] pressed. Increasing opacity.")
      this.adjustOpacity(0.1)
    })
    
    // Zoom controls
    globalShortcut.register("CommandOrControl+-", () => {
      console.log("Command/Ctrl + - pressed. Zooming out.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
      }
    })
    
    globalShortcut.register("CommandOrControl+0", () => {
      console.log("Command/Ctrl + 0 pressed. Resetting zoom.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
      }
    })
    
    globalShortcut.register("CommandOrControl+=", () => {
      console.log("Command/Ctrl + = pressed. Zooming in.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
      }
    })
    
    // Delete last screenshot shortcut
    globalShortcut.register("CommandOrControl+L", () => {
      console.log("Command/Ctrl + L pressed. Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        // Send an event to the renderer to delete the last screenshot
        mainWindow.webContents.send("delete-last-screenshot")
      }
    })
    
    // Reply to question in transcript shortcut
    globalShortcut.register("CommandOrControl+Shift+M", async () => {
      console.log("Command/Ctrl + Shift + M pressed. Replying to question in transcript.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          // Trigger reply generation via IPC
          await mainWindow.webContents.executeJavaScript(`
            (async () => {
              try {
                const result = await window.electronAPI.replyToQuestion();
                if (result.success) {
                  console.log("Reply generated successfully");
                } else {
                  console.error("Failed to generate reply:", result.error);
                }
              } catch (error) {
                console.error("Error generating reply:", error);
              }
            })()
          `)
        } catch (error) {
          console.error("Error triggering reply:", error)
        }
      }
    })
    
    // Window resize shortcuts - make window bigger
    globalShortcut.register("CommandOrControl+Shift+=", () => {
      console.log("Command/Ctrl + Shift + = pressed. Expanding window.")
      this.deps.resizeWindow(50, 50)
    })
    
    // Window resize shortcuts - make window smaller
    globalShortcut.register("CommandOrControl+Shift+-", () => {
      console.log("Command/Ctrl + Shift + - pressed. Shrinking window.")
      this.deps.resizeWindow(-50, -50)
    })
    
    // Window resize shortcuts - width only
    globalShortcut.register("CommandOrControl+Shift+Right", () => {
      console.log("Command/Ctrl + Shift + Right pressed. Expanding width.")
      this.deps.resizeWindow(50, 0)
    })
    
    globalShortcut.register("CommandOrControl+Shift+Left", () => {
      console.log("Command/Ctrl + Shift + Left pressed. Shrinking width.")
      this.deps.resizeWindow(-50, 0)
    })
    
    // Window resize shortcuts - height only
    globalShortcut.register("CommandOrControl+Shift+Up", () => {
      console.log("Command/Ctrl + Shift + Up pressed. Expanding height.")
      this.deps.resizeWindow(0, 50)
    })
    
    globalShortcut.register("CommandOrControl+Shift+Down", () => {
      console.log("Command/Ctrl + Shift + Down pressed. Shrinking height.")
      this.deps.resizeWindow(0, -50)
    })
    
    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
