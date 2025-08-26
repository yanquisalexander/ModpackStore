// NOTA: Asegúrate de tener `tauri-plugin-http` configurado en tu proyecto.
use crate::core::instance_manager::get_instance_by_id;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;
use tauri_plugin_http::reqwest;

// Función auxiliar para obtener (y crear si no existe) el directorio de íconos.
fn get_icons_dir() -> Result<PathBuf, String> {
    // Usamos el directorio de datos locales de la aplicación para almacenar los íconos.
    let data_dir =
        dirs::data_local_dir().ok_or("No se pudo encontrar el directorio de datos locales")?;
    let icons_dir = data_dir.join("dev.alexitoo.modpackstore").join("icons");
    fs::create_dir_all(&icons_dir)
        .map_err(|e| format!("No se pudo crear el directorio de íconos: {}", e))?;
    Ok(icons_dir)
}

#[command]
pub async fn create_shortcut(instance_id: String) -> Result<String, String> {
    // 1. Obtener la instancia por ID para verificar que existe y obtener sus datos.
    let instance = get_instance_by_id(instance_id.clone())
        .map_err(|e| format!("Error: {}", e))?
        .ok_or("Instancia no encontrada")?;

    // Obtener la ruta del ejecutable actual.
    let exe_path = env::current_exe()
        .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {}", e))?;

    // Obtener la ruta del escritorio.
    let desktop_path = dirs::desktop_dir().ok_or("No se encontró la carpeta de escritorio")?;

    // Usar el nombre de la instancia para el archivo de acceso directo.
    let shortcut_name = &instance.instanceName;

    // 2. Manejar el ícono: Descargar desde URL si es necesario.
    let mut downloaded_icon_path: Option<PathBuf> = None;
    if let Some(ref icon_url) = instance.iconUrl {
        if !icon_url.is_empty() {
            let icons_dir = get_icons_dir()?;
            // Usar el ID de la instancia para un nombre de archivo único y predecible.
            let file_name = format!("{}.png", instance_id);
            let destination_path = icons_dir.join(&file_name);

            // Descargar el ícono solo si no existe localmente.
            if !destination_path.exists() {
                let response = reqwest::get(icon_url)
                    .await
                    .map_err(|e| format!("Error al iniciar la descarga del ícono: {}", e))?;

                if response.status().is_success() {
                    let content = response
                        .bytes()
                        .await
                        .map_err(|e| format!("Error al leer los bytes del ícono: {}", e))?;
                    fs::write(&destination_path, &content)
                        .map_err(|e| format!("No se pudo guardar el ícono en disco: {}", e))?;
                } else {
                    // Si la descarga falla, podemos continuar sin el ícono de la URL.
                    eprintln!(
                        "La descarga del ícono falló con estado: {}",
                        response.status()
                    );
                }
            }

            // Si el archivo existe (ya sea porque se acaba de descargar o ya estaba), lo usamos.
            if destination_path.exists() {
                downloaded_icon_path = Some(destination_path);
            }
        }
    }

    // Decidir qué ruta de ícono usar: la descargada tiene prioridad.
    let specific_icon_path = downloaded_icon_path.as_deref();

    #[cfg(target_os = "windows")]
    {
        let lnk_path = desktop_path.join(format!("{}.lnk", shortcut_name));
        // Si no hay un ícono específico, usar el del propio ejecutable como fallback.
        let icon_to_use = specific_icon_path.or(Some(&exe_path));
        create_windows_shortcut(&exe_path, &lnk_path, &instance_id, icon_to_use)?;
        return Ok(lnk_path.to_string_lossy().to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let desktop_file = desktop_path.join(format!("{}.desktop", shortcut_name));
        // Si no hay un ícono específico, usar el del propio ejecutable como fallback.
        let icon_to_use = specific_icon_path.or(Some(&exe_path));
        create_linux_shortcut(
            &exe_path,
            &desktop_file,
            &instance_id,
            shortcut_name,
            icon_to_use,
        )?;
        return Ok(desktop_file.to_string_lossy().to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let app_bundle_path = desktop_path.join(format!("{}.app", shortcut_name));
        // Para macOS, la función create_macos_shortcut ya tiene un fallback interno a "AppIcon.icns".
        create_macos_shortcut(
            &exe_path,
            &app_bundle_path,
            &instance_id,
            shortcut_name,
            specific_icon_path,
        )?;
        return Ok(app_bundle_path.to_string_lossy().to_string());
    }

    // Fallback para sistemas operativos no soportados explícitamente.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    Err("Sistema operativo no soportado para la creación de accesos directos.".to_string())
}

#[cfg(target_os = "windows")]
fn create_windows_shortcut(
    exe: &Path,
    lnk: &Path,
    instance_id: &str,
    icon: Option<&Path>,
) -> Result<(), String> {
    use mslnk::ShellLink;

    let mut builder = ShellLink::new(exe).map_err(|e| format!("Error creando el enlace: {}", e))?;
    builder.set_arguments(Some(format!("--instance={}", instance_id)));

    if let Some(icon_path) = icon {
        if let Some(icon_str) = icon_path.to_str() {
            builder.set_icon_location(Some(icon_str.to_string()));
        }
    }

    builder
        .create_lnk(lnk)
        .map_err(|e| format!("Error guardando el archivo .lnk: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn create_linux_shortcut(
    exe: &Path,
    path: &Path,
    instance_id: &str,
    name: &str,
    icon: Option<&Path>,
) -> Result<(), String> {
    // Usar la ruta del ícono si está disponible, de lo contrario un valor por defecto.
    let icon_entry = icon.map_or("modstore".to_string(), |p| p.to_string_lossy().to_string());

    let content = format!(
        "[Desktop Entry]\n\
         Version=1.0\n\
         Name={}\n\
         Comment=Acceso directo a la instancia {}\n\
         Exec=\"{}\" --instance={}\n\
         Icon={}\n\
         Type=Application\n\
         Terminal=false\n",
        name,
        name,
        exe.to_string_lossy(),
        instance_id,
        icon_entry
    );
    fs::write(path, content)
        .map_err(|e| format!("Error escribiendo el archivo .desktop: {}", e))?;

    // Hacer el archivo ejecutable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn create_macos_shortcut(
    exe: &Path,
    app_bundle: &Path,
    instance_id: &str,
    name: &str,
    icon: Option<&Path>,
) -> Result<(), String> {
    let contents_path = app_bundle.join("Contents");
    let macos_path = contents_path.join("MacOS");
    let resources_path = contents_path.join("Resources");

    fs::create_dir_all(&macos_path)
        .map_err(|e| format!("Error creando la estructura del bundle: {}", e))?;
    fs::create_dir_all(&resources_path)
        .map_err(|e| format!("Error creando la carpeta de recursos: {}", e))?;

    // 1. Crear el script lanzador
    let script_path = macos_path.join(name);
    let script_content = format!(
        "#!/bin/sh\n\
         cd \"$(dirname \"$0\")\"\n\
         \"{}\" --instance={}\n",
        exe.to_string_lossy(),
        instance_id
    );
    fs::write(&script_path, script_content)
        .map_err(|e| format!("Error escribiendo el script de lanzamiento: {}", e))?;

    // Dar permisos de ejecución al script
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    // 2. Copiar el ícono si existe
    let icon_filename = if let Some(icon_path) = icon {
        let filename = icon_path.file_name().unwrap_or_default();
        let dest_icon_path = resources_path.join(filename);
        fs::copy(icon_path, &dest_icon_path)
            .map_err(|e| format!("No se pudo copiar el ícono: {}", e))?;
        filename.to_string_lossy().to_string()
    } else {
        // Un ícono por defecto si no se proporciona uno.
        // macOS buscará un .icns con este nombre en Resources.
        "AppIcon.icns".to_string()
    };

    // 3. Crear el archivo Info.plist
    let info_plist_path = contents_path.join("Info.plist");
    let info_plist_content = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n\
         <dict>\n\
         \t<key>CFBundleExecutable</key>\n\
         \t<string>{}</string>\n\
         \t<key>CFBundleIconFile</key>\n\
         \t<string>{}</string>\n\
         \t<key>CFBundleIdentifier</key>\n\
         \t<string>dev.alexitoo.modpackstore.instance.{}</string>\n\
         \t<key>CFBundleName</key>\n\
         \t<string>{}</string>\n\
         \t<key>CFBundlePackageType</key>\n\
         \t<string>APPL</string>\n\
         </dict>\n\
         </plist>",
        name,
        icon_filename,
        instance_id, // Usar un identificador único
        name
    );
    fs::write(info_plist_path, info_plist_content)
        .map_err(|e| format!("Error escribiendo Info.plist: {}", e))?;

    Ok(())
}
