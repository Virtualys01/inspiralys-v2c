use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{command, AppHandle, Emitter, Manager};

#[command]
pub fn capture_screen() -> Result<String, String> {
    let screens = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
    let primary = screens
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| xcap::Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or("No monitor found")?;

    let image = primary
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

#[command]
pub fn show_radial_menu(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("radial_menu") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("radial-show", ());
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
