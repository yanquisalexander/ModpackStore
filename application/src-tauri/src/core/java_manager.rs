use anyhow::{anyhow, Context, Result};
use dirs;
use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, create_dir_all, File};
use std::io::{self, copy, Cursor, Read, Write};
use std::path::{Path, PathBuf};
use tar::Archive;
use tauri_plugin_http::reqwest;
use zip::ZipArchive;

// Estructuras para deserializar la información de java
#[derive(Debug, Deserialize)]
pub struct JavaVersion {
    pub component: String,
    pub major_version: u8,
}

// Estructura principal del JavaManager
pub struct JavaManager {
    // Directorio base para las versiones de Java
    base_path: PathBuf,
}

impl JavaManager {
    /// Inicializa un nuevo JavaManager con el directorio base configurado
    pub fn new() -> Result<Self> {
        let config_path = dirs::config_dir()
            .ok_or_else(|| anyhow!("No se pudo obtener el directorio de configuración"))?
            .join("dev.alexitoo.modpackstore")
            .join("_java_versions");

        // Crear el directorio si no existe
        if !config_path.exists() {
            create_dir_all(&config_path)
                .context("No se pudo crear el directorio para las versiones de Java")?;
        }

        Ok(JavaManager {
            base_path: config_path,
        })
    }

    /// Returns a reference to the base path where Java versions are stored
    pub fn base_path(&self) -> &PathBuf {
        &self.base_path
    }

    /// Obtiene la ruta al ejecutable de Java para una versión específica
    /// Si la versión no está instalada, la descarga
    pub async fn get_java_path(&self, major_version: &str) -> Result<PathBuf> {
        let version_num = major_version
            .parse::<u8>()
            .context("La versión de Java no es un número válido")?;
        let version_dir = self.base_path.join(format!("java{}", major_version));

        // Comprobar si la versión ya está instalada
        if !self.is_java_installed(&version_dir) {
            // Si no está instalada, la descargamos
            self.download_java(version_num, &version_dir).await?;
        }

        Ok(self.get_java_directory(major_version))
    }

    /// Comprueba si Java está instalado en el directorio especificado
    fn is_java_installed(&self, version_dir: &PathBuf) -> bool {
        if !version_dir.exists() {
            return false;
        }

        // Si no es una raíz directa de JDK, intentar auto-sanar (ej. Contents/Home de macOS)
        if !Self::is_jdk_root(version_dir) {
            let _ = Self::heal_java_directory(version_dir);
        }

        if !version_dir.exists() {
            return false;
        }

        // Verificar que el ejecutable de Java existe
        let java_exec = self.get_java_executable(version_dir);
        java_exec.ok().filter(|p| p.exists()).is_some()
    }

    /// Busca en _java_versions la primera versión de Java que funcione
    /// Retorna la ruta al directorio de la versión encontrada (ej: _java_versions/java17)
    pub fn find_existing_app_java(&self) -> Option<String> {
        // Auto-sanar versiones existentes primero
        for version in &["17", "21", "8"] {
            let version_dir = self.base_path.join(format!("java{}", version));
            if version_dir.exists() {
                let _ = Self::heal_java_directory(&version_dir);
            }
        }

        // Buscar versiones en orden de preferencia: 17, 21, 8
        for version in &["17", "21", "8"] {
            let version_dir = self.base_path.join(format!("java{}", version));
            if self.is_java_installed(&version_dir) {
                // Verificar que realmente funciona ejecutando java -version
                let java_exe = self.get_java_executable(&version_dir).ok()?;
                if let Ok(version_str) = self.get_java_version(&java_exe) {
                    log::info!("Java {} found at {} (version {})", version, version_dir.display(), version_str);
                    return Some(version_dir.to_string_lossy().to_string());
                }
            }
        }
        None
    }

    fn get_java_directory(&self, version: &str) -> PathBuf {
        self.base_path.join(format!("java{}", version))
    }

    /// Obtiene la ruta al ejecutable de Java según el sistema operativo
    fn get_java_executable(&self, version_dir: &PathBuf) -> Result<PathBuf> {
        let bin_dir = version_dir.join("bin");

        #[cfg(target_os = "windows")]
        let java_exe = bin_dir.join("javaw.exe");

        #[cfg(not(target_os = "windows"))]
        let java_exe = bin_dir.join("java");

        if java_exe.exists() {
            Ok(java_exe)
        } else {
            // Fallback para bundles de macOS (Contents/Home/bin/java)
            let bundle_exe = version_dir
                .join("Contents")
                .join("Home")
                .join("bin")
                .join(if cfg!(target_os = "windows") { "javaw.exe" } else { "java" });
            if bundle_exe.exists() {
                return Ok(bundle_exe);
            }

            Err(anyhow!(
                "El ejecutable de Java no existe en {}",
                bin_dir.display()
            ))
        }
    }

    /// Descarga e instala la versión de Java especificada
    async fn download_java(&self, version: u8, target_dir: &PathBuf) -> Result<()> {
        // Determinar la URL de descarga según la plataforma y arquitectura
        let download_url = self.get_download_url(version).await?;

        println!("Descargando Java {} desde {}", version, download_url);

        // Crear el directorio si no existe
        if !target_dir.exists() {
            create_dir_all(target_dir)
                .context("No se pudo crear el directorio para la versión de Java")?;
        }

        // Obtener la extensión del archivo desde la URL
        let extension = if download_url.ends_with(".zip") {
            "zip"
        } else if download_url.ends_with(".tar.gz") {
            "tar.gz"
        } else {
            return Err(anyhow!("Formato de archivo no soportado: {}", download_url));
        };

        // Crear el archivo temporal con la extensión adecuada
        let temp_file = target_dir.join(format!("java_temp_archive.{}", extension));

        // Crear un cliente con tiempo de espera personalizado
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300)) // 5 minutos
            .build()?;

        // Iniciar la descarga
        let response = client
            .get(&download_url)
            .send()
            .await
            .context("Error al iniciar la descarga de Java")?;

        if !response.status().is_success() {
            return Err(anyhow!("Error al descargar Java: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(0);
        println!("Tamaño total: {} bytes", total_size);

        // Preparar archivo para guardar
        let mut file = File::create(&temp_file).context("No se pudo crear el archivo temporal")?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        // Descargar el archivo mostrando progreso
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Error al descargar fragmento")?;
            io::copy(&mut Cursor::new(&chunk), &mut file).context("Error al escribir fragmento")?;

            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64) * 100.0;
                println!(
                    "Descargado: {:.2}% ({}/{} bytes)",
                    progress, downloaded, total_size
                );
            } else {
                println!("Descargado: {} bytes", downloaded);
            }
        }

        println!("Descarga completada. Extrayendo...");

        // Extraer el archivo según su tipo
        self.extract_java_archive(&temp_file, target_dir)?;

        // Eliminar el archivo temporal
        fs::remove_file(&temp_file).context("No se pudo eliminar el archivo temporal")?;

        // macOS-specific: Fix permissions after extraction
        #[cfg(target_os = "macos")]
        {
            if let Err(e) = crate::core::macos_permissions::repair_java_path_permissions(target_dir)
            {
                log::warn!(
                    "[java_manager] Failed to repair macOS permissions after download: {}",
                    e
                );
            }
        }

        // Verificar que la instalación fue correcta
        if !self.is_java_installed(target_dir) {
            return Err(anyhow!("La instalación de Java {} falló", version));
        }

        println!("Java {} instalado correctamente", version);
        Ok(())
    }

    /// Determina la URL de descarga de OpenJDK según la plataforma, arquitectura y versión
    /// Usa la API de Adoptium para obtener la URL de descarga más reciente
    pub async fn get_download_url(&self, version: u8) -> Result<String> {
        #[derive(Debug, Deserialize)]
        struct Asset {
            binary: Binary,
        }

        #[derive(Debug, Deserialize)]
        struct Binary {
            package: Package,
        }

        #[derive(Debug, Deserialize)]
        struct Package {
            link: String,
        }

        let os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "mac"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            return Err(anyhow!("Sistema operativo no soportado"));
        };

        let arch = if cfg!(target_arch = "x86_64") {
            "x64"
        } else if cfg!(target_arch = "aarch64") {
            "aarch64"
        } else {
            return Err(anyhow!("Arquitectura no soportada"));
        };

        let api_url = format!(
            "https://api.adoptium.net/v3/assets/latest/{}/hotspot?os={}&architecture={}&image_type=jdk",
            version, os, arch
        );

        println!("Consultando API de Adoptium: {}", api_url);

        let response = reqwest::get(&api_url)
            .await
            .context("Error al consultar la API de Adoptium")?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Error en la consulta a la API de Adoptium: {}",
                response.status()
            ));
        }

        let assets: Vec<Asset> = response
            .json()
            .await
            .context("Error al parsear la respuesta de la API")?;

        if let Some(asset) = assets.first() {
            Ok(asset.binary.package.link.clone())
        } else {
            let fallback_url = match os {
                "windows" => format!(
                    "https://github.com/adoptium/temurin{}-binaries/releases/download/jdk-{}.0.2%2B7/OpenJDK{}U-jdk_{}_windows_hotspot_{}.zip",
                    version, version, version, arch, version
                ),
                "mac" => format!(
                    "https://github.com/adoptium/temurin{}-binaries/releases/download/jdk-{}.0.2%2B7/OpenJDK{}U-jdk_{}_mac_hotspot_{}.tar.gz",
                    version, version, version, arch, version
                ),
                "linux" => format!(
                    "https://github.com/adoptium/temurin{}-binaries/releases/download/jdk-{}.0.2%2B7/OpenJDK{}U-jdk_{}_linux_hotspot_{}.tar.gz",
                    version, version, version, arch, version
                ),
                _ => return Err(anyhow!("Sistema operativo no soportado")),
            };

            println!(
                "No se encontraron binarios en la API, usando URL predeterminada: {}",
                fallback_url
            );

            Ok(fallback_url)
        }
    }

    /// Extrae el archivo de Java descargado usando bibliotecas nativas de Rust
    fn extract_java_archive(&self, archive_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        let archive_str = archive_path.to_string_lossy().to_string();

        if archive_str.ends_with(".zip") {
            // En Windows, extraer ZIP usando la biblioteca zip-rs
            self.extract_zip(archive_path, target_dir)?;
        } else if archive_str.ends_with(".tar.gz") {
            // En macOS y Linux, extraer tar.gz usando las bibliotecas flate2 y tar
            self.extract_tar_gz(archive_path, target_dir)?;
        } else {
            return Err(anyhow!("Formato de archivo no soportado: {}", archive_str));
        }

        // Mover los archivos del subdirectorio al directorio principal
        self.fix_extracted_directory(target_dir)?;

        Ok(())
    }

    /// Extrae un archivo ZIP usando la biblioteca zip-rs
    fn extract_zip(&self, zip_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        let file = File::open(zip_path).context("No se pudo abrir el archivo ZIP")?;
        let mut archive = ZipArchive::new(file).context("No se pudo leer el archivo ZIP")?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .context("No se pudo acceder al archivo en el ZIP")?;
            let outpath = match file.enclosed_name() {
                Some(path) => target_dir.join(path),
                None => continue,
            };

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)
                    .context("No se pudo crear directorio durante la extracción")?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .context("No se pudo crear directorio padre durante la extracción")?;
                    }
                }
                let mut outfile = File::create(&outpath)
                    .context("No se pudo crear archivo durante la extracción")?;
                io::copy(&mut file, &mut outfile)
                    .context("No se pudo copiar contenido del archivo ZIP")?;

                // Preservar permisos de ejecución en sistemas Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if file.unix_mode().unwrap_or(0) & 0o111 != 0 {
                        let mut perms = fs::metadata(&outpath)?.permissions();
                        perms.set_mode(0o755);
                        fs::set_permissions(&outpath, perms)?;
                    }
                }
            }
        }

        Ok(())
    }

    /// Extrae un archivo tar.gz usando las bibliotecas flate2 y tar
    fn extract_tar_gz(&self, tar_gz_path: &PathBuf, target_dir: &PathBuf) -> Result<()> {
        let file = File::open(tar_gz_path).context("No se pudo abrir el archivo tar.gz")?;
        let gz_decoder = GzDecoder::new(file);
        let mut archive = Archive::new(gz_decoder);

        archive
            .unpack(target_dir)
            .context("No se pudo extraer el archivo tar.gz")?;

        // En sistemas Unix, restaurar permisos de ejecución
        #[cfg(unix)]
        {
            self.fix_permissions(target_dir)?;
        }

        Ok(())
    }

    /// Restaura permisos de ejecución para archivos en el directorio bin
    #[cfg(unix)]
    fn fix_permissions(&self, dir: &PathBuf) -> Result<()> {
        Self::fix_unix_permissions(dir)
    }

    /// Restaura permisos de ejecución para archivos en el directorio bin
    #[cfg(unix)]
    pub fn fix_unix_permissions(dir: &Path) -> Result<()> {
        use std::os::unix::fs::PermissionsExt;

        let bin_dir = if dir.join("bin").exists() {
            dir.join("bin")
        } else if dir.join("Contents").join("Home").join("bin").exists() {
            dir.join("Contents").join("Home").join("bin")
        } else {
            return Ok(());
        };

        if bin_dir.exists() {
            for entry in fs::read_dir(&bin_dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_file() {
                    let mut perms = fs::metadata(&path)?.permissions();
                    perms.set_mode(0o755); // rwxr-xr-x
                    fs::set_permissions(&path, perms)?;
                }
            }
        }

        Ok(())
    }

    /// Determina si un directorio contiene directamente bin/java o bin/java.exe
    pub fn is_jdk_root(path: &Path) -> bool {
        let bin_dir = path.join("bin");
        if !bin_dir.is_dir() {
            return false;
        }
        bin_dir.join("java").exists()
            || bin_dir.join("java.exe").exists()
            || bin_dir.join("javaw.exe").exists()
    }

    /// Busca recursivamente el directorio raíz real del JDK dentro de un directorio
    pub fn locate_jdk_root(dir: &Path, max_depth: usize) -> Option<PathBuf> {
        if Self::is_jdk_root(dir) {
            return Some(dir.to_path_buf());
        }
        // Verificar Contents/Home (típico de bundles en macOS)
        let contents_home = dir.join("Contents").join("Home");
        if Self::is_jdk_root(&contents_home) {
            return Some(contents_home);
        }

        if max_depth == 0 {
            return None;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    // Evitar descender a carpetas temporales
                    if name.contains("temp_") {
                        continue;
                    }
                    if let Some(found) = Self::locate_jdk_root(&path, max_depth - 1) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }

    /// Aplana el contenido de real_root directamente en target_dir
    pub fn flatten_to_target(real_root: &Path, target_dir: &Path) -> Result<()> {
        if real_root == target_dir {
            return Ok(());
        }

        let parent_dir = target_dir.parent().unwrap_or(target_dir);
        let temp_dir = parent_dir.join(format!(
            "{}_temp_flatten_{}",
            target_dir.file_name().and_then(|n| n.to_str()).unwrap_or("java"),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ));

        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        create_dir_all(&temp_dir).context("No se pudo crear directorio temporal para aplanar JDK")?;

        // Mover o copiar todo de real_root a temp_dir
        for entry in fs::read_dir(real_root)? {
            let entry = entry?;
            let dest = temp_dir.join(entry.file_name());
            Self::copy_dir_recursive(&entry.path(), &dest)?;
        }

        // Limpiar target_dir completamente
        if let Ok(entries) = fs::read_dir(target_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let _ = fs::remove_dir_all(&p);
                } else {
                    let _ = fs::remove_file(&p);
                }
            }
        }

        // Mover desde temp_dir a target_dir
        for entry in fs::read_dir(&temp_dir)? {
            let entry = entry?;
            let dest = target_dir.join(entry.file_name());
            Self::copy_dir_recursive(&entry.path(), &dest)?;
        }

        let _ = fs::remove_dir_all(&temp_dir);
        Ok(())
    }

    /// Corrige la estructura de directorios después de la extracción
    /// ya que OpenJDK suele extraerse a un subdirectorio o bundle (macOS)
    fn fix_extracted_directory(&self, target_dir: &PathBuf) -> Result<()> {
        if let Some(real_root) = Self::locate_jdk_root(target_dir, 3) {
            if real_root != *target_dir {
                log::info!(
                    "[java_manager] JDK extraído en subdirectorio {}. Aplanando a {}",
                    real_root.display(),
                    target_dir.display()
                );
                Self::flatten_to_target(&real_root, target_dir)?;
            }
        } else {
            log::warn!(
                "[java_manager] No se encontró la raíz del JDK dentro de {}",
                target_dir.display()
            );
        }

        Ok(())
    }

    /// Auto-sana una instalación existente de Java en _java_versions.
    /// Si tiene estructura Contents/Home o carpetas anidadas, las aplana.
    /// Si está corrupta o vacía, la limpia para no bloquear futuras descargas.
    pub fn heal_java_directory(version_dir: &Path) -> Result<bool> {
        if !version_dir.exists() {
            return Ok(false);
        }

        // Limpiar archivos o carpetas temporales residuales
        for temp_name in &["temp_move", "java_temp_archive.zip", "java_temp_archive.tar.gz"] {
            let temp_path = version_dir.join(temp_name);
            if temp_path.exists() {
                if temp_path.is_dir() {
                    let _ = fs::remove_dir_all(&temp_path);
                } else {
                    let _ = fs::remove_file(&temp_path);
                }
            }
        }

        // Si no tiene bin/java directamente, buscar si está anidado
        if !Self::is_jdk_root(version_dir) {
            if let Some(real_root) = Self::locate_jdk_root(version_dir, 3) {
                log::info!(
                    "[java_manager] Auto-sanando directorio Java anidado: {} -> {}",
                    real_root.display(),
                    version_dir.display()
                );
                let _ = Self::flatten_to_target(&real_root, version_dir);
            }
        }

        // Si ahora es una raíz válida
        if Self::is_jdk_root(version_dir) {
            #[cfg(unix)]
            {
                let _ = Self::fix_unix_permissions(version_dir);
            }
            #[cfg(target_os = "macos")]
            {
                let _ = crate::core::macos_permissions::repair_java_path_permissions(version_dir);
            }
            return Ok(true);
        }

        // Si tras intentar sanar sigue sin tener ejecutable, verificar si está corrupto o vacío
        log::warn!(
            "[java_manager] Carpeta {} corrupta o sin ejecutable válido. Limpiando para permitir nueva instalación.",
            version_dir.display()
        );
        let _ = fs::remove_dir_all(version_dir);
        Ok(false)
    }

    /// Copia un directorio de forma recursiva (fallback para fs::rename cross-volume)
    fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<()> {
        if src.is_dir() {
            create_dir_all(dest)?;
            for entry in fs::read_dir(src)? {
                let entry = entry?;
                let dest_child = dest.join(entry.file_name());
                Self::copy_dir_recursive(&entry.path(), &dest_child)?;
            }
        } else {
            fs::copy(src, dest)?;
        }
        Ok(())
    }

    pub fn is_version_installed(&self, version: &str) -> bool {
        let version_dir = self.base_path.join(format!("{}", version));
        version_dir.exists()
    }

    /// Valida la ruta de Java guardada en la configuración interna
    /// Verifica tanto la existencia de la ruta como la funcionalidad del ejecutable
    pub fn validate_configured_java(&self, java_path: &str) -> Result<bool, String> {
        let java_dir = std::path::PathBuf::from(java_path);

        // Verificación 1: La ruta debe existir
        if !java_dir.exists() {
            return Ok(false);
        }

        // Verificación 2: El ejecutable debe existir y funcionar
        let java_exe = if cfg!(target_os = "windows") {
            let exe = java_dir.join("bin").join("java.exe");
            if exe.exists() {
                exe
            } else {
                java_dir.join("bin").join("javaw.exe")
            }
        } else {
            let exe = java_dir.join("bin").join("java");
            if exe.exists() {
                exe
            } else {
                java_dir.join("Contents").join("Home").join("bin").join("java")
            }
        };

        if !java_exe.exists() {
            return Ok(false);
        }

        // Verificación 3: Intentar ejecutar java -version
        match self.get_java_version(&java_exe) {
            Ok(version) => {
                if self.is_java_version_supported(&version) {
                    Ok(true)
                } else {
                    Ok(false)
                }
            }
            Err(_) => {
                // On macOS, try to repair permissions before giving up
                #[cfg(target_os = "macos")]
                {
                    log::info!(
                        "[java_manager] Java validation failed, attempting macOS permission repair for: {}",
                        java_path
                    );
                    if let Err(e) = crate::core::macos_permissions::repair_java_path_permissions(&java_dir)
                    {
                        log::warn!("[java_manager] Permission repair failed: {}", e);
                    }

                    // Retry validation after repair
                    match self.get_java_version(&java_exe) {
                        Ok(version) => {
                            if self.is_java_version_supported(&version) {
                                log::info!(
                                    "[java_manager] Java validation succeeded after permission repair"
                                );
                                Ok(true)
                            } else {
                                Ok(false)
                            }
                        }
                        Err(_) => Ok(false),
                    }
                }
                #[cfg(not(target_os = "macos"))]
                Ok(false)
            }
        }
    }

    /// Busca instalaciones de Java en ubicaciones comunes del sistema
    /// Retorna la primera instalación funcional encontrada
    pub fn scan_local_java_installations(&self) -> Result<Option<String>, String> {
        let mut search_paths = Vec::new();

        // Agregar rutas comunes según el sistema operativo
        #[cfg(target_os = "windows")]
        {
            if let Ok(program_files) = std::env::var("ProgramFiles") {
                search_paths.push(std::path::PathBuf::from(program_files.clone()).join("Java"));
                search_paths
                    .push(std::path::PathBuf::from(program_files.clone()).join("Eclipse Adoptium"));
                search_paths.push(std::path::PathBuf::from(program_files.clone()).join("OpenJDK"));
            }
            if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
                search_paths.push(std::path::PathBuf::from(program_files_x86.clone()).join("Java"));
                search_paths.push(
                    std::path::PathBuf::from(program_files_x86.clone()).join("Eclipse Adoptium"),
                );
                search_paths
                    .push(std::path::PathBuf::from(program_files_x86.clone()).join("OpenJDK"));
            }
        }

        #[cfg(target_os = "macos")]
        {
            search_paths.push(std::path::PathBuf::from(
                "/Library/Java/JavaVirtualMachines",
            ));
            search_paths.push(std::path::PathBuf::from(
                "/System/Library/Java/JavaVirtualMachines",
            ));
            if let Some(home) = dirs::home_dir() {
                search_paths.push(home.join("Library/Java/JavaVirtualMachines"));
            }
        }

        #[cfg(target_os = "linux")]
        {
            search_paths.push(std::path::PathBuf::from("/usr/lib/jvm"));
            search_paths.push(std::path::PathBuf::from("/usr/java"));
            search_paths.push(std::path::PathBuf::from("/opt/java"));
            search_paths.push(std::path::PathBuf::from("/opt/openjdk"));
            if let Some(home) = dirs::home_dir() {
                search_paths.push(home.join(".sdkman/candidates/java"));
                search_paths.push(home.join(".jenv/versions"));
            }
        }

        // Buscar en cada ruta
        for search_path in search_paths {
            if let Ok(entries) = std::fs::read_dir(&search_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        // Verificar si esta ruta contiene una instalación funcional de Java
                        if let Ok(true) = self.validate_configured_java(&path.to_string_lossy()) {
                            return Ok(Some(path.to_string_lossy().to_string()));
                        }

                        // En macOS, las instalaciones están en Contents/Home
                        #[cfg(target_os = "macos")]
                        {
                            let macos_java_home = path.join("Contents/Home");
                            if macos_java_home.exists() {
                                if let Ok(true) = self
                                    .validate_configured_java(&macos_java_home.to_string_lossy())
                                {
                                    return Ok(Some(macos_java_home.to_string_lossy().to_string()));
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    /// Verifica si Java está disponible en el sistema
    /// Prioriza JAVA_HOME, luego busca en PATH
    pub fn validate_system_java(&self) -> Result<Option<String>, String> {
        // Primero verificar JAVA_HOME
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let java_exe = if cfg!(target_os = "windows") {
                std::path::PathBuf::from(&java_home)
                    .join("bin")
                    .join("java.exe")
            } else {
                std::path::PathBuf::from(&java_home)
                    .join("bin")
                    .join("java")
            };

            if java_exe.exists() {
                // Verificar que es una versión válida ejecutando java -version
                if let Ok(version) = self.get_java_version(&java_exe) {
                    if self.is_java_version_supported(&version) {
                        return Ok(Some(java_home));
                    }
                }
            }
        }

        // Si JAVA_HOME no funciona, buscar en PATH
        let java_command = if cfg!(target_os = "windows") {
            "java.exe"
        } else {
            "java"
        };

        let mut command = std::process::Command::new(java_command);
        command.arg("-version");

        // En Windows, usar CREATE_NO_WINDOW para evitar que aparezca una ventana de CMD
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match command.output() {
            Ok(output) => {
                if output.status.success() {
                    let version_output = String::from_utf8_lossy(&output.stderr);
                    if let Some(version) = self.parse_java_version(&version_output) {
                        if self.is_java_version_supported(&version) {
                            // Si java está en PATH pero no tenemos JAVA_HOME, intentar encontrar la instalación
                            if let Ok(java_path) = which::which(java_command) {
                                if let Some(java_home) = java_path.parent().and_then(|p| p.parent())
                                {
                                    return Ok(Some(java_home.to_string_lossy().to_string()));
                                }
                            }
                            return Ok(Some("java".to_string())); // Fallback: usar 'java' desde PATH
                        }
                    }
                }
            }
            Err(_) => {
                // Java no está disponible en PATH
            }
        }

        Ok(None)
    }

    /// Obtiene la versión de Java ejecutando java -version
    pub fn get_java_version(&self, java_exe: &std::path::Path) -> Result<String, String> {
        let mut command = std::process::Command::new(java_exe);
        command.arg("-version");

        // En Windows, usar CREATE_NO_WINDOW para evitar que aparezca una ventana de CMD
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        match command.output() {
            Ok(output) => {
                if output.status.success() {
                    let version_output = String::from_utf8_lossy(&output.stderr);
                    if let Some(version) = self.parse_java_version(&version_output) {
                        Ok(version)
                    } else {
                        Err("No se pudo parsear la versión de Java".to_string())
                    }
                } else {
                    Err("Error al ejecutar java -version".to_string())
                }
            }
            Err(e) => Err(format!("Error al ejecutar java: {}", e)),
        }
    }

    /// Parsea la salida de java -version para obtener el número de versión
    fn parse_java_version(&self, version_output: &str) -> Option<String> {
        // Buscar patrones como "java version "1.8.0_XXX"" o "openjdk version "11.0.X""
        for line in version_output.lines() {
            if line.contains("version") {
                if let Some(start) = line.find('"') {
                    if let Some(end) = line[start + 1..].find('"') {
                        let version = &line[start + 1..start + 1 + end];
                        // Extraer el número de versión principal
                        if version.starts_with("1.") {
                            // Java 8 y anteriores: "1.8.0_XXX" -> "8"
                            if let Some(major) = version.split('.').nth(1) {
                                return Some(major.to_string());
                            }
                        } else {
                            // Java 9+: "11.0.X" -> "11"
                            if let Some(major) = version.split('.').nth(0) {
                                return Some(major.to_string());
                            }
                        }
                    }
                }
            }
        }
        None
    }

    /// Verifica si la versión de Java es compatible (Java 8 o superior)
    fn is_java_version_supported(&self, version: &str) -> bool {
        match version.parse::<u8>() {
            Ok(version_num) => version_num >= 8,
            Err(_) => false,
        }
    }

    /// Repairs permissions for all Java installations on macOS.
    /// This is useful when encountering "Permission denied" errors.
    #[cfg(target_os = "macos")]
    pub fn repair_all_permissions(&self) -> Result<(), String> {
        // Synchronous version - just call the synchronous parts
        let base_path = &self.base_path;
        if !base_path.exists() {
            return Ok(());
        }

        for version in &["8", "17", "21"] {
            let version_dir = base_path.join(format!("java{}", version));
            if version_dir.exists() {
                if let Err(e) = crate::core::macos_permissions::repair_java_path_permissions(&version_dir) {
                    log::warn!(
                        "[java_manager] Failed to repair Java {} permissions: {}",
                        version,
                        e
                    );
                }
            }
        }

        Ok(())
    }

    /// Attempts to repair permissions and re-validate a Java installation.
    /// Returns true if the Java is now working, false otherwise.
    #[cfg(target_os = "macos")]
    pub fn try_repair_and_validate(&self, version_dir: &PathBuf) -> Result<bool, String> {
        // First, try to repair permissions
        crate::core::macos_permissions::repair_java_path_permissions(version_dir)?;

        // Then validate again
        self.is_java_installed(version_dir)
            .then_some(true)
            .ok_or_else(|| "Java still not working after permission repair".to_string())
    }
}

// Ejemplo de uso:
/*
#[tokio::main]
async fn main() -> Result<()> {
    let java_manager = JavaManager::new()?;

    // Obtener la ruta de Java para la versión 17
    let java_path = java_manager.get_java_path("17").await?;
    println!("Java 17 instalado en: {}", java_path.display());

    Ok(())
}
*/
