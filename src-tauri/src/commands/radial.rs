use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{command, AppHandle, Emitter, Manager};

/// Find which monitor the cursor is on and capture that monitor
#[command]
pub fn capture_screen() -> Result<String, String> {
    let enigo = enigo::Enigo::new(&Default::default()).map_err(|e| format!("{}", e))?;
    let (mx, my) = {
        use enigo::Mouse;
        enigo.location().map_err(|e| format!("{}", e))?
    };

    let screens = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;

    // Find the monitor containing the cursor
    let target = screens
        .iter()
        .find(|m| {
            let x = m.x().unwrap_or(0);
            let y = m.y().unwrap_or(0);
            let w = m.width().unwrap_or(0) as i32;
            let h = m.height().unwrap_or(0) as i32;
            mx >= x && mx < x + w && my >= y && my < y + h
        })
        .or_else(|| screens.iter().find(|m| m.is_primary().unwrap_or(false)))
        .or(screens.first())
        .ok_or("No monitor found")?;

    let image = target
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    let mut png_bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    image
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes)))
}

#[command]
pub fn get_cursor_position() -> Result<(i32, i32), String> {
    let enigo = enigo::Enigo::new(&Default::default()).map_err(|e| format!("{}", e))?;
    use enigo::Mouse;
    enigo.location().map_err(|e| format!("{}", e))
}

/// Show radial menu on the monitor where the cursor is
#[command]
pub fn show_radial_menu(app: AppHandle) -> Result<(), String> {
    // Get cursor position to determine which monitor
    let enigo = enigo::Enigo::new(&Default::default()).map_err(|e| format!("{}", e))?;
    let (mx, my) = {
        use enigo::Mouse;
        enigo.location().map_err(|e| format!("{}", e))?
    };

    // Find the right monitor
    if let Ok(monitors) = app.available_monitors() {
        let target_monitor = monitors
            .iter()
            .find(|m| {
                let pos = m.position();
                let size = m.size();
                mx >= pos.x
                    && mx < pos.x + size.width as i32
                    && my >= pos.y
                    && my < pos.y + size.height as i32
            })
            .or_else(|| app.primary_monitor().ok().flatten().as_ref().map(|_| monitors.first().unwrap()));

        if let Some(monitor) = target_monitor {
            let pos = monitor.position();
            let size = monitor.size();

            if let Some(window) = app.get_webview_window("radial_menu") {
                // Move and resize to the correct monitor
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: pos.x,
                    y: pos.y,
                }));
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: size.width,
                    height: size.height,
                }));
                let _ = window.set_always_on_top(true);
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("radial-show", ());
            }
        }
    }
    Ok(())
}

#[command]
pub fn hide_radial_menu(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("radial_menu") {
        let _ = window.hide();
        let _ = app.emit("radial-hide", ());
    }
    Ok(())
}
